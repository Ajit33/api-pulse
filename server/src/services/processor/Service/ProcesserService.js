
import logger from "../../../shared/config/logger.js";
 export class ProcesserService {
    constructor({ApiHitRepository,MetricsRepository}){
     if(!ApiHitRepository || !MetricsRepository){
        throw new Error("ApiHitRepository and MetricsRepository are required");
     }
        this.apiHitRepository = ApiHitRepository;
        this.metricsRepository = MetricsRepository;
    }

     getTimeBucket(timestamp,interval="hour"){
        const date = new Date(timestamp);
        switch(interval){
            case "hour" :
                date.setMinutes(0,0,0);
            case "day" :
                date.setHours(0,0,0,0);
            case "minute" :
                date.setSeconds(0,0);
            default:
                date.setMinutes(0,0,0);
        }
        return date            
     }

     async processEvent(eventData) {
    let rawEventSaved = false;
    try {
        // normalize serverName → serviceName
        const normalizedData = {
            ...eventData,
            serviceName: eventData.serverName || eventData.serviceName,
        };

        logger.info(`Processing event: ${JSON.stringify(normalizedData)}`);
        await this.apiHitRepository.saveApiHit(normalizedData);
        rawEventSaved = true;
        logger.info(`Event saved to ApiHitRepository: ${normalizedData.eventId}`);
        await this._updateMetricsWithFallback(normalizedData);
        logger.info(`Finished processing event: ${normalizedData.eventId}`);

    } catch (error) {
        if (!rawEventSaved) {
            logger.error(`Failed to save raw event: ${error.message}`);
        }
        throw error;
    }
}
     async _updateMetricsWithFallback(eventData){
        // calculate time bucket
        const timeBucket = this.getTimeBucket(eventData.timestamp,"hour");
        const metricData = {
            clientId: eventData.clientId.toString(),
            serviceName: eventData.serviceName,
            totalHits: 1,
            errorHits: eventData.statusCode >= 400 ? 1 : 0,
            avgLatency: eventData.latencyMs,   
            minLatency: eventData.latencyMs,  
            maxLatency: eventData.latencyMs,
            endpoint: eventData.endpoint,
            method: eventData.method,
            timeBucket
     }
     try {
         await this.metricsRepository.upsertEndpointMetrics(metricData);
         logger.info(`Metrics updated successfully for event: ${eventData.id}`);
     } catch (error) {
       throw error; 
     }
    }
    async cleanOldEvents(daysToKeep = 30){
        try {
            let cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            await this.apiHitRepository.deleteOldApiHits(cutoffDate);
            logger.info(`Old events cleaned up successfully, cutoff date: ${cutoffDate.toISOString()}`);
        } catch (error) {
            logger.error(`Error cleaning old events: ${error.message}`);
            throw error;
        }
    }
}