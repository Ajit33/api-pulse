import { error } from "winston";
import logger from "../../shared/config/logger";
import { EVENT_TYPES } from "../../shared/events/EventContracts";
import { RetryStrategy } from "../../shared/events/producer/RetryStrategy";

const messageSchema = z.object({
  type: z.enum([EVENT_TYPES.API_HIT]),
  data: z.record(z.String(), z.unknown()),
  messageId: z.String().optional(),
  timeStamp: z.union([z.string(), z.number()]).optional(),
});
class EventConsumer {
  constructor({
    processerService,
    rabbitMQ,
    mongodb,
    postgres,
    config,
    retryStrategy,
    circuitBreaker,
    logger,
  }) {
    this.processerService = processerService;
    this.rabbitMQ = rabbitMQ;
    this.mongodb = mongodb;
    this.postgres = postgres;
    this.config = config;
    this.retryStrategy = retryStrategy;
    this.circuitBreaker = circuitBreaker;
    this.isRunning = false;
    this.channel = null;
    this.stats = {
      processed: 0,
      failed: 0,
      retried: 0,
      dlqRouted: 0,
      lastProcessedAt: null,
    };
    this.processedIds = new Set();
    this.poisonMessages = new Map();
    this.logger = logger;
  }

  async start() {
    try {
      await this._connectDatabases();
      this.channel = await this.rabbitMQ.connect();
      const prefetch = (await this.config.consumer?.prefetch) || 10;
      this.channel.prefetch(prefetch);

      this.channel.on("error", (err) => {
        this.logger.error("RabbitMQ channel error", { error: err });
        this.circuitBreaker.onFailure();
      });
      this.channel.on("close", () => {
        this.logger.warn("RabbitMQ channel closed");
        if (this.isRunning) {
          this._reconnect();
        }
      });
      this.logger.info(
        `Started consuming from queue: ${this.config.rabbitmq.queue} with prefetch: ${prefetch}`,
      );
      this.isRunning = true;
      await this._consume(
        this.config.rabbitmq.queue,
        async (msg) => {
          if (msg !== null) {
            await this._handleMessage(msg);
          }
        },
        { noAck: false, consumerTag: `consumer-${Date.now()}` },
      );
      this.logger.info(
        `Event consumer is runnning and consuming messages from queue: ${this.config.rabbitmq.queue}`,
      );
    } catch (error) {
      this.logger.error("Failed to start event consumer", { error });
      await this._cleanup();
      throw error;
    }
  }
  async _cleanup() {
    try {
      this.isRunning = false;
      if (this.channel) {
        await this.channel.close();
        this;
        this.logger.info("RabbitMQ channel closed successfully during cleanup");
      }
    } catch (error) {
      this.logger.error("Error during cleanup of RabbitMQ channel", { error });
    }
  }
  async _connectDatabases() {
    const maxretry = this.config.dbConnection.maxRetries || 5;
    let attempt = 0;
    while (attempt < maxretry) {
      try {
        this.logger.info(
          `Attempting to connect to databases, attempt ${attempt + 1}`,
        );
        await Promise.all([
          this.mongodb.connect(),
          this.postgres.testConnection(),
        ]);
        this.logger.info("Successfully connected to all databases");
        return;
      } catch (error) {
        this.logger.error(
          `Failed to connect to databases on attempt ${attempt + 1}: ${error.message}`,
        );
        attempt++;
        if (attempt >= maxretry) {
          throw new Error(
            "Exceeded maximum retry attempts for database connections",
          );
        }
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryStrategy.getDelay(attempt)),
        );
      }
    }
  }
  async _reconnect() {
    try {
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.reconnectionDelay || 5000),
      );
      this.channel = await this.rabbitMQ.connect();
      const prefetch = this.config.consumer?.prefetch || 10;
      this.channel.prefetch(prefetch);

      this.channel.on("error", (err) => {
        this.logger.error("RabbitMQ channel error", { error: err });
        this.circuitBreaker.onFailure();
      });
      this.channel.on("close", () => {
        this.logger.warn("RabbitMQ channel closed");
        if (this.isRunning) {
          this._reconnect();
        }
      });
      await this._consume(
        this.config.rabbitmq.queue,
        async (msg) => {
          if (msg !== null) {
            await this._handleMessage(msg);
          }
        },
        { noAck: false, consumerTag: `consumer-${Date.now()}` },
      );
    } catch (error) {
      this.logger.error("Failed to reconnect to RabbitMQ", { error });
      if (
        this.isRunningTimeout(
          () => this._reconnect(),
          this.config.reconnectionDelay || 5000,
        )
      ) {
        this.logger.info("Scheduled reconnection attempt to RabbitMQ");
      }
    }
  }
  async _handleMessage(msg) {
    if (!this.circuitBreaker.allowRequest()) {
      this.logger.warn("Circuit breaker is open,requeuing message");
      this.channel.nack(msg, false, true);
      return;
    }
    let startTime = Date.now();
    let msgData = null;
    try {
      msgData = _parseMessage(msg);
      //idempotency check
      if (this.processedIds.has(msgData.messageId)) {
        this.logger.warn(
          "Duplicate message detected,acknowledging without processing",
          { messageId: msgData.messageId },
        );
        this.channel.ack(msg);
        return;
      }
      await this._processMessage(msgData);
      this.channel.ack(msg);
      this.circuitBreaker.onSuccess();
      this.stats.processed++;
      this.stats.lastProcessedAt = new Date();
      this.processedIds.add(msgData.messageId);
      if (this.processedIds.size > 100_00) {
        const first = this.processedIds.values().next().value;
        this.processedIds.delete(first);
        this.logger.info(
          "Cleared processed message IDs cache to prevent memory bloat",
        );
      }
      this.poisonMessages.delete(msgData.type);
      this.logger.info("Message processed successfully", {
        messageId: msgData.messageId,
        processingTime: Date.now() - satrtTime,
      });
    } catch (error) {
      await this._handleProcessingError(error, msg, msgData, startTime);
    }
  }
  async _parseMessage(msg) {
    try {
      const content = msg.content.toString();
      const messageData = JSON.parse(content);
      const parsed = messageSchema.safeParse(messageData);
      if (!parsed.success) {
        throw new Error(
          `Schema validation failed: ${parsed.error.issue.map((i) => i.message).join(",")}`,
        );
      }
      return {
        ...parsed.data,
        messageId:
          msg.properties.messageId ||
          messageData.messageId ||
          `unknown-${Date.now()}`,
        retryCount: parseInt(msg.properties.headers?.["x-retry-count"]) || 0,
      };
    } catch (error) {
      throw new Error(`Failed to parse message: ${error.message}`);
    }
  }
  async _processMessage(msgData) {
    switch (msgData.type) {
      case EVENT_TYPES.API_HIT:
        await this.processerService.processEvent(msgData.data);
        break;
      default:
        this.logger.warn(
          "Unknown event type received,acknowledging message without processing",
          { eventType: msgData.type },
        );
    }
  }
  async _handleProcessingError(error, msg, msgData, startTime) {
    const messageId =
      msgData?.messageId || msg.properties?.messageId || "unknown";
    const retryCount = msgData?.retryCount || 0;
    this.circuitBreaker.onFailure();
    this.stats.failed++;
    const eventType = msgData?.type || "unknown";
    const poisionCount = (this.poisonMessages.get(eventType) || 0) + 1;
    this.poisonMessages.set(eventType, poisionCount);
    if (poisionCount >= 10) {
      this.logger.error("poision message pattern detected", {
        eventType,
        consecutiveFailures: poisionCount,
      });
      if (!isRetryable(error) || !this.retryStrategy.shouldRetry(retryCount)) {
        await this._sendToDLQ(
          msg,
          error,
          retryCount >= this.retryStrategy.maxRetries
            ? "MAX_RETRIES_EXCEEDED"
            : "NON_RETRYABLE",
        );
        return;
      }
      await this._retryMessage(msg, retryCount);
    }
  }
  async _sendToDLQ(msg, error, reason) {
    try {
      const dlqname = `${this.config.rabbitmq.queue}.dql`;
      this.channel.sendToQueue(dlqname, msg.content, {
        ...msg.properties,
        persistent: true,
        headers: {
          ...msg.properties.headers,
          "x-dlq-reason": reason,
          "x-dlq-error": error.message,
          "x-dlq-timestamp": Date.now(),
          "x-original-queue": this.config.rabbitmq.queue,
        },
      });
      this.channel.ack(msg);
      this.stats.dlqRouted++;
    } catch (error) {
      this.logger.error("Failed to send message to DLQ", error);
      this.channel.nack(msg, false, false);
    }
  }
  async _retryMessage(msg, retryCount) {
    const delay = this.retryStrategy(retryCount);
    const retryHeaders = {
      ...msg.properties.headers,
      "x-retry-count": retryCount + 1,
      "x-retry-timestamps": Date.now(),
      "x-retry-delay": delay,
      "x-original-queue": this.config.rabbitmq.queue,
    };
    setTimeout(() => {
      try {
        this.channel.sendToQueue(
          this.config.rabbitmq.queue,
          msg.content,
          { ...msg.properties },
          retryHeaders,
        );
        this.logger.info("Message scheduled for retry", {
          messageid: msg.properties.messageId,
          retryCount: retryCount + 1,
          delay,
        });
        this.channel.ack(msg);
        this.stats.retried++;
      } catch (error) {
        this.logger.error("Failed to Scheduled retry", error);
        this._sendToDLQ(msg, error, "RETRY_FAILED");
      }
    });
  }
  async stop() {
    try {
      await this._cleanup();
      await Promise.all([
        this.rabbitMQ.close(),
        this.mongodb.disconnect(),
        this.postgres.close(),
      ]);
    } catch (error) {
      this.logger.error("Error while stopping consumer", error);
    }
  }

}
const circuitBreaker = overrides.circuitBreaker ?? new CircuitBreaker({
        failureThreshold: 2,
        cooldownMs: 30_000,
        halfOpenMaxAttempts: 3,
        logger: log
    });

    // The retry strategy will use an exponential backoff with jitter, and the parameters can be configured via the application's configuration file.
    const retryStrategy = overrides.retryStrategy ?? new RetryStrategy({
        maxRetries: config.rabbitmq.retryAttempts,
        baseDelayMs: config.rabbitmq.retryDelay,
        maxDelayMs: 5_000,
        jitterFactor: 0.3,
    });

    const consumer= new EventConsumer({
        processerService:procssorConatiner.service.processorService,
        rabbitMq,
        mongodb,
        postgres,
        config,
        logger,
        retryStrategy,
        circuitBreaker
    })

    async function startConsumerWithRetry(){
        const startRetry=new RetryStrategy({maxRetries:5,basedelayMs:5000 ,maxDelayMs:30_000});
        let attempt=0;
        while(startupRetry.shouldRetry(attempt) || attempt==0){
            try {
                logger.info(`Starting consumer (attempt ${attempt+ 1})`);
                await consumer.start();
                logger.info(`Consumer started successfully`);
                return;
            } catch (error) {
              attempt++;
              logger.error(`Consumer start attempt ${attempt} failed`,error) ;
              
              if(!startupRetry.shouldRetry(attempt)){
                logger.error('Max retries reached , exiting....');
                process.exit(1);
              }
              await startupRetry.wait(attempt-1);
            }
        }
    }

    process.on('SIGINT',async()=>{
        logger.info(`Recived SIGINT, shutting down gracefully....`);
        await consumer.stop();
        process.exit(0);
    })

    process.on('SIGTERM', async()=>{
        logger.info(`Recived SIGTERM shutting down gracefully....`)
        await consumer.stop();
        process.exit(0);
    })

    process.on('uncaughtException',async()=>{
        logger.error(`uncaught exception`,error);
        process.exit(1);
    })

    process.on('unhandledRejection', async(reason, promise)=>{
        logger.error('unhandled promise rejection at:', promise, 'reason:', reason )
        process.exit(1);
    })

    startConsumerWithRetry();

    export default consumer;