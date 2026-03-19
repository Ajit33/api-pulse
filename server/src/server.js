import express from "express"
import cors from "cors"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import logger from "./shared/config/logger.js"


import ResponseFormatter from "./shared/utils/responseFormatter.js"
import errorHandler from "./shared/middlewares/errorHandler.js"
import postgres from "./shared/config/postgres.js"
import rabbitMq from "./shared/config/rabbitMq.js"
import mongo from "./shared/config/mongodb.js"
import config from "./shared/config/index.js"
import authRouter from "./services/auth/route/authRouter.js"
import clientRouter from "./services/client/route/clientRoutes.js"
const app=express();
//middilewares
app.use(helmet());
app.use(cors({origin:true , Credential:true}));
app.use(cookieParser());
app.use(express.urlencoded({extended:true}));
app.use(express.json());

app.use((req,res,next)=>{
    logger.info(`${req.method} ${req.path}`,{
        ip:req.ip,
        userAgent:req.headers['user-agent']
    })
    next()
})

app.get("/health",(req,res)=>{
    res.status(200).json(
        ResponseFormatter.success({
            status:'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        })
    )
})

app.get("/",(req,res)=>{
    res.status(200).json(
        ResponseFormatter.success({
           service:"Api Plulse Moniter System",
           version:'1.0.0',
           endpoints:{
            health:'/health'
           },
        },
        'Api Plulse Moniter System'
    )
    )
})
 /**
  * Routers
  */
  app.use("/api/auth", authRouter);
  app.use("/api",clientRouter);
/**
 * 404 handler
 */

app.use((req,res)=>{
    res.status(404).json(
        ResponseFormatter.error(
            "Endpint is invalid",
            404
        )
    )
})

app.use(errorHandler)

/**
 * connections
 */

async function initializeConnection (){
    try {
        logger.info("initializing connections ....")
      //mongo
      await mongo.connect();
      //postgress
      await postgres.testConnection()
      //rabbitmq
      await rabbitMq.connect()
      logger.info("all connection established sucessfullly")
    } catch (error) {
        logger.error("Failed to established connection ",error)
        throw error
    }
}
    /**
 * Start the Express server after establishing database connections.
 * Also sets up graceful shutdown handlers for SIGINT and SIGTERM signals.
 * On shutdown, it closes the HTTP server and all database connections before exiting the process.
 * If any error occurs during startup or shutdown, it logs the error and exits with a non-zero status code.
 */
async function startServer() {
    try {
        await initializeConnection();

        const server = app.listen(config.port, () => {
            logger.info(`Server started on port ${config.port}`);
            logger.info(`Environment: ${config.node_env}`);
            logger.info(`API available at: http://localhost:${config.port}`);
        });


        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} received, shutting down gracefully...`);

            server.close(async () => {
                logger.info("HTTP server closed");

                try {
                    await mongo.disconnect();
                    await postgres.close();
                    await rabbitMq.close();
                    logger.info('All connections closed, exiting process');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            })

            setTimeout(() => {
                logger.error("Forced shutdown")
                process.exit(1);
            }, 10000);

        }

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();