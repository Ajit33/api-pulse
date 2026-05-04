import logger from '../config/logger.js';

/**
 * Request logger middleware - centralizes request logging.
 */
const requestLogger = (req, res, next) => {
    console.log("Incoming request:", {
        method: req.method,
        path: req.originalUrl || req.url,
        ip: req.ip || req.socket.remoteAddress,
    });
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP %s %s %s %dms', req.method, req.originalUrl || req.url, req.ip || req.socket.remoteAddress, duration, {
            method: req.method,
            path: req.originalUrl || req.url,
            status: res.statusCode,
            duration,
        });
    });

    next();
};

export default requestLogger;