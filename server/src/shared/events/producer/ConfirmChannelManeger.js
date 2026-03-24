import { EventEmitter } from "node:events";

export class ConfirmChannelManager extends EventEmitter {
    constructor(rabbitmq, logger) {
        super();

        if (!rabbitmq) throw new Error("ConfirmChannelManager requires a RabbitMQ connection manager");

        this.rabbitmq = rabbitmq;
        this.logger = logger ?? console;
        this._channel = null;
        this.connecting = false;
        this._connectWaiters = [];
    }

    async getChannel() {
        if (this._channel) return this._channel;

        if (this.connecting) {
            return new Promise((resolve, reject) => {
                this._connectWaiters.push({ resolve, reject });
            });
        }
        return this._connect();
    }

    async _connect() {
        this.connecting = true;

        try {
            let connection;

            if (this.rabbitmq.connection) {
                connection = this.rabbitmq.connection;
            } else {
                await this.rabbitmq.connect();

                if (!this.rabbitmq.connection) {
                    throw new Error("Failed to obtain RabbitMQ connection.");
                }

                connection = this.rabbitmq.connection;
            }

            const confirmChannel = await connection.createConfirmChannel();

            confirmChannel.on("drain", () => this.emit("drain"));
            confirmChannel.on("close", () => {
                this.logger.info("[ChannelManager] Confirm channel closed unexpectedly");
                this._channel = null;
            });

            confirmChannel.on("error", (err) => {
                this.logger.error("[ChannelManager] Confirm channel error", {
                    error: err.message,
                    stack: err.stack,
                    code: err.code,
                });
                this._channel = null;
                this.emit("error", err);
            });

            this._channel = confirmChannel;
            this.logger.info("[ChannelManager] Confirm channel is ready");

            for (const w of this._connectWaiters) {
                w.resolve(confirmChannel);
            }
            this._connectWaiters = [];

            return confirmChannel;

        } catch (error) {
            for (const w of this._connectWaiters) {
                w.reject(error);
            }
            this._connectWaiters = [];
            throw error;

        } finally {
            this.connecting = false;
        }
    }
}