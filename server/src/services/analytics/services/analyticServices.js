import AppError from "../../../shared/utils/AppError.js";
import logger from "../../../shared/config/logger.js";
export class AnalyticsService{
    constructor(metricsRepo){
        if(!metricsRepo) throw new Error("AnalyticsService reuires a metricsRepository");
        this.metricsRepository=metricsRepo;   
    }

    async getOverallStats(clientId, options={}){
        try {
            const {startTime,endTime} = this.parsedTimeFilters(options);
            const stats= await this.metricsRepository.getOverallStats(
                clientId,
                startTime,
                endTime
            )
            const  totalHits=parseInt(stats.total_hits) || 0;
            const errorHits=parseInt(stats.error_hits) || 0;
            const errorRate=totalHits>0 ? (errorHits/totalHits)*100 : 0;
            return {
                totalHits,
                errorHits,
                errorRate: errorRate.toFixed(2),
                sucessHits: totalHits - errorHits,
                avgLatency:parseFloat(stats.avg_latency) || 0,
                uniqueServices: parseInt(stats.unique_services) || 0,
                uniqueEndpoints: parseInt(stats.unique_endpoints) || 0,
                timeRange :{
                    start:startTime,
                    end:endTime
                }
            }
        } catch (error) {
            logger.error(`Error getting overall stats:`, error);
            throw new AppError("Failed to get overall stats", 500);
        }
    }
    parsedTimeFilters(filters={}){
        let {startTime,endTime}=filters;
        if(!startTime){
            startTime=new Date();
            startTime.setHours(startTime.getHours()-24);
        }
        else{
            startTime=new Date(startTime);
        }
        if(!endTime){
            endTime=new Date();
        }
        else{
            endTime=new Date(endTime);
        }
        return {startTime,endTime};
    }

    async getTopEndpoints (clientId, options={}){
        const {limit=10 , startTime}=options;
        try {
            const parsedStartTime=startTime ? new Date(startTime) : null;
            const endpoints= await this.metricsRepository.getTopEndpoints(clientId, limit, parsedStartTime);
            return endpoints.map((endpoints)=>({
                serviceName : endpoints.service_name,
                endpoint : endpoints.endpoint,
                method: endpoints.method,
                totalHits: parseInt(endpoints.total_hits) || 0,
                avgLatency: parseFloat(endpoints.avg_latency).toFixed(2) || 0,
                errorHits: parseInt(endpoints.error_hits) || 0,
                errorRate: parseFloat((parseInt(endpoints.error_hits) / parseInt(endpoints.total_hits) * 100).toFixed(2)) || 0
            }))
        } catch (error) {
            logger.error(`Error getting top endpoints:`, error);
            throw error;
        }
    }

    async getTimeseries(clientId, filters={}){
        try {
            const {serviceName ,endpoint ,endTime,limit=100}=filters;
            const {startTime:start_time,endTime:end_time}= this.parsedTimeFilters({startTime,endTime});
            const metrics= await this.metricsRepository.getMetrics({clientId, serviceName, endpoint ,startTime: start_time, endTime: end_time, limit});
            return metrics.map((metric)=>({
                serviceName : metric.service_name,
                endpoint: metric.endpoint,
                method: metric.method,
                totalHits: parseInt(metric.total_hits) || 0,
                errorHits: parseInt(metric.error_hits) || 0,
                avgLatency: parseFloat(metric.avg_latency).toFixed(2) || 0,
                maxLatency: parseFloat(metric.max_latency).toFixed(2) || 0,
                minLatency: parseFloat(metric.min_latency).toFixed(2) || 0,
                timeBucket: metric.time_bucket
            }))
            
        } catch (error) {
            logger.error(`Error getting timeseries data:`, error);
            throw error;
        }
    }
}