import AppError from "../../../shared/utils/AppError.js";
import logger from "../../../shared/config/logger.js";
export class AnalyticsService{
    constructor(metricsRepo){
        if(!metricsRepo) throw new Error("AnalyticsService reuires a metricsRepository");
        this.metricsRepository=metricsRepo;   
    }

    async getOverallStats(clientId, options={}){
        try {
            const{limit=10,startTime}=options;
            const {startTime,endTime} = this.parsedTimeFilters({startTime});
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
}