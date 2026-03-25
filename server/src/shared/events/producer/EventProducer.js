import { EVENT_TYPES } from "../EventContracts";

export class EventProducer {
    /**
     * Creates an instance of EventProducer.
     * @param {object} channelManager - Manages RabbitMQ channel lifecycle (getChannel, close).
     * @param {object} circuitBreaker - Circuit breaker controlling publish attempts.
     * @param {object} retryStrategy - Retry strategy with shouldRetry, wait, and isRetryable methods.
     * @param {string} queueName - The name of the RabbitMQ queue to publish to.
     * @param {object} [logger=console] - Logger instance with info/error methods.
     * @throws {Error} If any required dependency is missing.
     */
    constructor(channelManager, circuitBreaker, retryStrategy, queueName, logger) {
        if (!channelManager) {
            throw new Error("EventProducer requires channelManager");
        }
        if (!circuitBreaker) {
            throw new Error("EventProducer requires circuitBreaker");
        }
        if (!retryStrategy) {
            throw new Error("EventProducer requires retryStrategy");
        }
        if (!queueName) {
            throw new Error("EventProducer requires queueName");
        }

        this._channelManager = channelManager;
        this._circuitBreaker = circuitBreaker;
        this._retryStrategy = retryStrategy;
        this._queueName = queueName;
        this._logger = logger ?? console;
        this._shuttingDown = false;

        this._metrics = {
            published: 0,
            failed: 0,
            retriesExhausted: 0,
        };
    }

    /**
     * Increments a named metric counter by 1.
     * @param {string} metric - The metric key to increment (e.g. 'published', 'failed').
     */
    _incrementMetric(metric) {
        this._metrics[metric] = (this._metrics[metric] || 0) + 1;
    }

    /**
     * Builds and publishes a message to RabbitMQ for the given event data.
     * Handles back-pressure detection via the channel's drain event.
     * @param {object} eventData - The event payload to publish.
     * @param {object} context - Publish context options.
     * @param {string} context.correlationId - Correlation ID to attach to the message.
     * @param {number} context.attempt - Zero-based attempt index (stored as attempt + 1).
     * @returns {Promise<void>} Resolves when the message is confirmed written.
     * @throws {Error} If the channel publish callback returns an error.
     */
    async _publish(eventData, { correlationId, attempt }) {
        const channel = await this._channelManager.getChannel();

        const message = {
            type: EVENT_TYPES.API_HIT,
            data: eventData,
            publishedAt: new Date().toISOString(),
            attempt: attempt + 1,
        };

        const buffer = Buffer.from(JSON.stringify(message));

        const publishOptions = {
            persistent: true,
            contentType: "application/json",
            messageId: eventData.eventId,
            correlationId,
            timestamp: Math.floor(Date.now() / 1000),
        };

        return new Promise((resolve, reject) => {
            const written = channel.publish(
                " ",
                this._queueName,
                buffer,
                publishOptions,
                (err) => {
                    if (err) return reject(new Error(`publish failed : ${err.message}`));
                    resolve();
                }
            );

            if (!written) {
                this._logger.info(`[EventProducer] back pressure detected, waiting for drain`, {
                    eventId: eventData.eventId,
                });
            }

            const onDrain = () => {
                channel.removeListener("drain", onDrain);
                this._logger.info(`[EventProducer] drain event received`, {
                    eventId: eventData.eventId,
                });
            };

            channel.once("drain", onDrain);
        });
    }

    /**
     * Gracefully shuts down the EventProducer by stopping new publishes
     * and closing the underlying channel manager.
     * @returns {Promise<void>} Resolves once the channel manager is fully closed.
     */
    async shutdown() {
        this._shuttingDown = true;
        this._logger.info(`[EventProducer] shutting down...`);
        await this._channelManager.close();
        this._logger.info(`[EventProducer] shutdown completed`);
    }

    /**
     * Returns a snapshot of current producer metrics and circuit breaker state.
     * @returns {{ metrics: object, circuitBreaker: object }} Current metrics and circuit breaker snapshot.
     */
    getStats() {
        return {
            metrics: { ...this._metrics },
            circuitBreaker: this._circuitBreaker.snapshot(),
        };
    }

    /**
     * Publishes an API hit event to the RabbitMQ queue.
     * Respects shutdown state, circuit breaker, and retry strategy before and during publishing.
     * @param {object} eventData - The data for the API hit event.
     * @param {string} eventData.eventId - Unique identifier for the event.
     * @param {string} [eventData.endpoint] - The API endpoint that was hit.
     * @param {object} [opts={}] - Optional publish parameters.
     * @param {string} [opts.correlationId] - Correlation ID for tracing; defaults to eventData.eventId.
     * @returns {Promise<boolean>} Resolves to true if published successfully, false if rejected by circuit breaker.
     * @throws {Error} With code 'SHUTDOWN_IN_PROGRESS' if the producer is shutting down.
     * @throws {Error} If publish fails and retries are exhausted or the error is non-retryable.
     */
    async publishApiHit(eventData, opts = {}) {
        if (this._shuttingDown) {
            const error = new Error("EventProducer is shutting down");
            error.code = "SHUTDOWN_IN_PROGRESS";
            this._logger.info("[EventProducer] publish rejected — shutting down", {
                eventId: eventData.eventId,
            });
            throw error;
        }

        // Check circuit breaker before attempting to publish the event. If the circuit is open,
        // we reject the publish attempt immediately to avoid overwhelming the message broker
        // and to allow it time to recover. This also helps to fail fast and provide quicker
        // feedback to the caller about the unavailability of the service.
        if (!this._circuitBreaker.allowRequest()) {
            this._logger.info("[EventProducer] circuit breaker rejected publish", {
                eventId: eventData.eventId,
                state: this._circuitBreaker.state,
            });
            return false;
        }

        const correlationId = opts.correlationId ?? eventData.eventId;
        const startMs = Date.now();
        let attempt = 0;

        while (true) {
            try {
                await this._publish(eventData, { correlationId, attempt });
                const latencyMs = Date.now() - startMs;

                this._circuitBreaker.onSuccess();
                this._incrementMetric("published");

                this._logger.info("[EventProducer] published", {
                    eventId: eventData.eventId,
                    correlationId,
                    attempt: attempt + 1,
                    latencyMs,
                    endpoint: eventData.endpoint,
                });

                return true;
            } catch (error) {
                this._logger.error("[EventProducer] publish attempt failed", {
                    eventId: eventData.eventId,
                    correlationId,
                    attempt: attempt + 1,
                    error: error.message,
                });

                const canRetry =
                    this._retryStrategy.isRetryable(error) &&
                    this._retryStrategy.shouldRetry(attempt);

                if (!canRetry) {
                    this._circuitBreaker.onFailure();
                    this._incrementMetric("failed");
                    if (!this._retryStrategy.shouldRetry(attempt)) {
                        this._incrementMetric("retriesExhausted");
                    }
                    throw error;
                }

                await this._retryStrategy.wait(attempt);
                attempt++;
            }
        }
    }
}