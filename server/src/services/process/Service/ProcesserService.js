import { cli } from "winston/lib/winston/config/index.js";
import logger from "../../../shared/config/logger.js";
import { error } from "winston";
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

     async processEvent(eventData){
        let rawEventSaved=false;
        try {
            logger.info(`Processing event: ${JSON.stringify(eventData)}`);
            await this.apiHitRepository.saveApiHit(eventData);
            rawEventSaved = true;
            logger.info(`Event saved to ApiHitRepository: ${eventData.id}`);
            await this._updateMetricsWithFallback(eventData);

            logger.info(`Finished processing event: ${eventData.id}`);
        } catch (error) {
           if(!rawEventSaved){
            logger.error(`Failed to save raw event: ${error.message}`);
           }
           throw error;
        }
        logger.error(`Raw event saved but metrics update failed` ,{eventId: eventData.id, error: error.message});
     }
     async _updateMetricsWithFallback(eventData){
        // calculate time bucket
        const timeBucket = this.getTimeBucket(eventData.timestamp,"hour");
        const metricData = {
            clientId: eventData.clientId.toString(),
            serviceName: eventData.serviceName,
            totalHits: 1,
            errorHits: eventData.statusCode >= 400 ? 1 : 0,
            avgLantency: eventData.avgLatency,
            minLatency: eventData.minLatency,
            maxLatency: eventData. maxLatency,
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