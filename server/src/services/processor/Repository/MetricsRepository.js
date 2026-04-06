import { BaseRepository } from "./BaseRepository.js";

const MAX_LIMIT = 1000;
const MAX_QUERY_TIMEOUT = 30000;

export class MetricsRepository extends BaseRepository {
    constructor({ logger: l, postgres: pg }) {
        super({ logger: l });
        this.postgres = pg;
    }

    async upsertEndpointMetrics(metricsData) {
        try {
            const {
                clientId,
                serviceName,
                endpoint,
                method,
                totalHits,
                errorHits,
                avgLatency,
                maxLatency,
                minLatency,
                timeBucket,
            } = metricsData;

         
            const query = `
                INSERT INTO endpoint_metrics
                    (client_id, service_name, endpoint, method, total_hits, error_hits, avg_latency, max_latency, min_latency, time_bucket)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (client_id, service_name, endpoint, method, time_bucket)
                DO UPDATE SET
                    total_hits  = endpoint_metrics.total_hits + EXCLUDED.total_hits,
                    error_hits  = endpoint_metrics.error_hits + EXCLUDED.error_hits,
                    avg_latency = (
                        endpoint_metrics.avg_latency * endpoint_metrics.total_hits +
                        EXCLUDED.avg_latency * EXCLUDED.total_hits
                    ) / (endpoint_metrics.total_hits + EXCLUDED.total_hits),
                    max_latency = GREATEST(endpoint_metrics.max_latency, EXCLUDED.max_latency),
                    min_latency = LEAST(endpoint_metrics.min_latency, EXCLUDED.min_latency),
                    updated_at  = CURRENT_TIMESTAMP
            `;

            const values = [
                clientId, serviceName, endpoint, method,
                totalHits, errorHits, avgLatency, maxLatency, minLatency, timeBucket,
            ];

            await this._query(query, values);
            this.logger.info("Endpoint metrics upserted successfully", {
                clientId, serviceName, endpoint, method, timeBucket,
            });
        } catch (error) {
            this.logger.error("Error upserting endpoint metrics", { error, metricsData });
            throw error;
        }
    }

    async getMetrics(filter = {}) {
        try {
            const {
                clientId,
                serviceName,
                endpoint,
                startTime,
                endTime,
                limit = 100,
                offset = 0,
            } = filter;

            const safeLimit  = Math.min(Math.max(1, limit), MAX_LIMIT);
            const safeOffset = Math.max(0, offset);

            let paramIndex = 1;
            const params = [];
            const conditions = [];

            let sql = `
                SELECT
                    service_name,
                    endpoint,
                    method,
                    SUM(total_hits)                                                    AS total_hits,
                    SUM(error_hits)                                                    AS error_hits,
                    SUM(avg_latency * total_hits) / NULLIF(SUM(total_hits), 0)        AS avg_latency,
                    MAX(max_latency)                                                   AS max_latency,
                    MIN(min_latency)                                                   AS min_latency,
                    time_bucket
                FROM endpoint_metrics
            `;

            if (clientId != null) {
                conditions.push(`client_id = $${paramIndex++}`);
                params.push(clientId);
            }
            if (serviceName) {
                conditions.push(`service_name = $${paramIndex++}`);
                params.push(serviceName);
            }
            if (endpoint) {
                conditions.push(`endpoint = $${paramIndex++}`);
                params.push(endpoint);
            }
            if (startTime) {
                conditions.push(`time_bucket >= $${paramIndex++}`);
                params.push(startTime);
            }
            if (endTime) {
                conditions.push(`time_bucket <= $${paramIndex++}`);
                params.push(endTime);
            }

            if (conditions.length > 0) {
                sql += " WHERE " + conditions.join(" AND ");
            }

            sql += " GROUP BY service_name, endpoint, method, time_bucket";
            sql += " ORDER BY time_bucket DESC";
            sql += ` LIMIT ${safeLimit} OFFSET ${safeOffset}`;

            this.logger.info("query executed", { sql, params });
            const result = await this._query(sql, params);
            this.logger.info("Metrics retrieved successfully", { filter, count: result.rows.length });
            return result.rows;
        } catch (error) {
            this.logger.error("Error fetching metrics", { error, filter });
            throw error;
        }
    }

    async getTopEndpoints(clientId, limit = 10, startTime = null) {
        try {
            const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

            
            let paramIndex = 1;
            const params = [];
            const conditions = []; 

            let sql = `
                SELECT
                    service_name,
                    endpoint,
                    method,
                    SUM(total_hits)                                              AS total_hits,
                    SUM(error_hits)                                              AS error_hits,
                    SUM(avg_latency * total_hits) / NULLIF(SUM(total_hits), 0)  AS avg_latency
                FROM endpoint_metrics
            `;

            if (clientId != null) {
                conditions.push(`client_id = $${paramIndex++}`);
                params.push(clientId);
            }
            if (startTime) {
                conditions.push(`time_bucket >= $${paramIndex++}`);
                params.push(startTime);
            }

            if (conditions.length > 0) {
                sql += " WHERE " + conditions.join(" AND ");
            }

            sql += `
                GROUP BY service_name, endpoint, method
                ORDER BY total_hits DESC
                LIMIT $${paramIndex}
            `;
            params.push(safeLimit);

            const result = await this._query(sql, params);
            this.logger.info("Top endpoints retrieved successfully", {
                clientId, limit, startTime, count: result.rows.length,
            });
            return result.rows;
        } catch (error) {
            this.logger.error("Error fetching top endpoints", { error, clientId, limit, startTime });
            throw error;
        }
    }

    async getOverallStats(clientId, startTime = null, endTime = null) {
        try {
            let paramIndex = 2;
            const params = [clientId];

            let sql = `
                SELECT
                    SUM(total_hits)                                              AS total_hits,
                    SUM(error_hits)                                              AS error_hits,
                    SUM(avg_latency * total_hits) / NULLIF(SUM(total_hits), 0)  AS avg_latency,
                    MAX(max_latency)                                             AS max_latency,
                    MIN(min_latency)                                             AS min_latency
                FROM endpoint_metrics
                WHERE client_id = $1
            `;

            if (startTime) {
                sql += ` AND time_bucket >= $${paramIndex++}`;
                params.push(startTime);
            }
            if (endTime) {
                sql += ` AND time_bucket <= $${paramIndex++}`;
                params.push(endTime);
            }

            const result = await this._query(sql, params);
            this.logger.info("Overall stats retrieved successfully", { clientId, startTime, endTime });
            return result.rows[0];
        } catch (error) {
            this.logger.error("Error fetching overall stats", { error, clientId, startTime, endTime });
            throw error;
        }
    }

    _query(sql, params = [], client = this.postgres) {
        const target = client || this.postgres;
        if (!target || typeof target.query !== "function") {
            const err = new Error("Invalid database client provided for query execution");
            this.logger.error("Database query failed due to invalid client", { error: err });
            throw err;
        }
        return target.query({ text: sql, values: params, statement_timeout: MAX_QUERY_TIMEOUT });
    }
}