
import pg from "pg"
import config from "./index.js"
import logger from "./logger.js"

const { Pool } = pg;

/**
 * PostgresConnection class to manage PostgreSQL connections using pg Pool
 * Provides methods to get the pool, test connection, execute queries, and close the pool
 */ 

class PostgresConnection {
    constructor() {
        this.pool = null;
    }

    /**
     * Get the PostgreSQL connection pool
     * @returns {Pool} The PostgreSQL connection pool
     */
    getPool() {
        if (!this.pool) {
            this.pool = new Pool({
                host: config.postgres.host,
                port: config.postgres.port,
                database: config.postgres.database,
                user: config.postgres.user,
                password: config.postgres.password,
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            })

            this.pool.on("error", err => {
                logger.error("Unexpected error on idle PG client", err)
            })

            logger.info("PG Pool Created")
            return this.pool;
        }
    }

    /**
     * Test the PostgreSQL connection by executing a simple query
     * @returns {Promise<void>}
     */
    async testConnection() {
        try {
            const pool = this.getPool();
            const client = await pool.connect();
            const result = await client.query("SELECT NOW()")
            client.release();

            logger.info(`PG connected successfully at ${result.rows[0].now}`)
        } catch (error) {
            logger.error("Failed to connect to PG", error)
            throw error
        }
    }

    /**
     * Execute a SQL query using the PostgreSQL connection pool
     * @param {string} text - The SQL query text
     * @param {Array} params - The parameters for the SQL query
     * @returns {Promise<pg.QueryResult>} The result of the SQL query
     */ 

    async query(text, params) {
        const pool = this.getPool()
        const start = Date.now();
        try {
            const result = await pool.query(text, params);
            const duration = Date.now() - start
            logger.debug('Executed query', { text, duration, rows: result.rowCount });
            return result;
        }
        catch (error) {
            logger.error('Query error:', { text, error: error.message });
            throw error;
        }
    }

    /**
     * Close the PostgreSQL connection pool
     * @returns {Promise<void>}
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info("PG pool closed!")
        }
    }
}

export default new PostgresConnection()