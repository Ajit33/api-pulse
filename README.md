# API Monitoring Application

A distributed API monitoring system built with an event-driven architecture. Ingests client data through a gateway, processes it asynchronously via RabbitMQ, and stores results across dual databases — with full dead-letter queue (DLQ) support for failed messages.

---

## Architecture Overview

<img width="1720" height="760" alt="Screenshot 2026-03-10 134402" src="https://github.com/user-attachments/assets/45ede60a-edbb-41f9-9219-37beff38e00d" />

The system is composed of three main layers: the **Backend Network**, the **RabbitMQ Processor**, and the **Database layer**.

---

## Components

### Client Layer
- **Client Data** — The entry point for all incoming data.
- **API Gateway** — Routes client requests into the backend network. Acts as the single entry point and load balancer.
- **UI** — Frontend interface that reads processed data from the database.

### Backend Network
- **Express Server (Ingest)** — Receives incoming requests from the API Gateway. Forwards valid traffic through a circuit breaker to the message queue.
- **Circuit Breaker** — Protects downstream services from cascading failures. Sits between the Express ingest server and RabbitMQ exchange.
- **Background Consumer** — Subscribes to the RabbitMQ queue and passes messages to the Processor Engine.
- **Processor Engine** — Handles the core business logic. Reads from the Background Consumer and writes results to the appropriate database.

### RabbitMQ Processor
- **RabbitMQ Exchange** — Receives messages from the Express server (via circuit breaker) and routes them to the appropriate queue.
- **RabbitMQ API Hit** — The primary message queue. Holds messages for the Background Consumer to process.
- **DLQ (Dead Letter Queue)** — Captures failed messages that could not be processed. Messages are routed here when processing fails (`F` path).

### Database Layer
- **MongoDB** — Stores raw, unprocessed data from the Processor Engine.
- **PostgreSQL** — Stores processed/transformed data, ready to be consumed by the UI.

---

## Data Flow

```
Client Data
    └──► API Gateway
              └──► Express Server (Ingest)
                        └──► Circuit Breaker
                                  └──► RabbitMQ Exchange
                                            └──► RabbitMQ API Hit Queue
                                                      ├── [PASSED] ──► Background Consumer
                                                      │                       └──► Processor Engine
                                                      │                                 ├──► MongoDB (raw data)
                                                      │                                 └──► PostgreSQL (processed data)
                                                      │                                           └──► UI
                                                      └── [FAILED] ──► DLQ
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Server | Node.js / Express |
| Message Broker | RabbitMQ |
| Raw Data Store | MongoDB |
| Processed Data Store | PostgreSQL |
| Frontend | UI (web client) |

---

## Getting Started

### Prerequisites

- Node.js v18+
- RabbitMQ
- MongoDB
- PostgreSQL
- Docker (recommended)

### Installation

```bash
git clone https://github.com/your-org/api-monitoring-app.git
cd api-monitoring-app
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_EXCHANGE=api_exchange
RABBITMQ_QUEUE=api_hit_queue
RABBITMQ_DLQ=api_dead_letter_queue

# MongoDB
MONGO_URI=mongodb://localhost:27017/api_monitoring_raw

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=api_monitoring
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
```

### Running the Application

```bash
# Start all services with Docker Compose
docker-compose up

# Or start manually
npm run start:ingest      # Express ingest server
npm run start:consumer    # Background consumer + processor
npm run start:ui          # Frontend UI
```

---

## Error Handling & DLQ

Messages that fail processing are automatically routed to the **Dead Letter Queue (DLQ)**. To inspect or replay failed messages:

```bash
# View DLQ messages
npm run dlq:inspect

# Replay failed messages
npm run dlq:replay
```

---

## Circuit Breaker

The circuit breaker sits between the Express ingest server and the RabbitMQ exchange. It will **open** (stop traffic) if downstream services become unavailable, preventing cascading failures across the system.

Configure thresholds in `config/circuit-breaker.js`:

```js
{
  failureThreshold: 5,       // Number of failures before opening
  successThreshold: 2,       // Successes needed to close again
  timeout: 10000             // Time (ms) before retrying
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
