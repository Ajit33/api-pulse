import mongoose from 'mongoose';
import config from './index.js';
import logger from './logger.js';
import logger from './logger.js';
/**
 * MongoDbConnection class to manage MongoDB connections using Mongoose
 * Provides methods to connect and disconnect from the MongoDB database
 */
class MongoDbConnection{
    constructor(){
        this.connection = null;
    }
   /**
    * Connect to the MongoDB database
    * @return {Promise<mongoose.Connection>}
    */
    async connect(){
        try{
          if(this.connection){
         logger.info("Already connected to MongoDB");
         return this.connection;
          }
          await mongoose.connect(config.mongodb_uri, {
            dbName:config.mongo.dbName
          });
          this.connection = mongoose.connection;
           logger.info("Connected to MongoDB");
           this.connection.on("error", (err) => {
            logger.error("MongoDB connection error:", err);
           });
           this.connection.on("disconnected", () => {
            logger.warn("MongoDB connection disconnected");
           });
        }
        catch(error){
           logger.error('Failed to connect to MongoDB:', error);
           throw error;
        }
    }
    /**
     * Disconnect from the MongoDB database
     * @returns {Promise<void>}
     */
    async disconnect(){
        try{
            if(!this.connection){   
                logger.warn("No active MongoDB connection to disconnect");
                return;
            }
            await mongoose.disconnect();
            this.connection = null;
            logger.info("Disconnected from MongoDB");
        }
        catch(error){
            logger.error('Failed to disconnect from MongoDB:', error);
            throw error;
        }
    }
    /**
     * Get the active MongoDB connection
     * @returns <{mongoose.Connection|null}> The active MongoDB connection or null if not connected
     */
    getConnection(){
        return this.connection;
    }
}
export default new MongoDbConnection();