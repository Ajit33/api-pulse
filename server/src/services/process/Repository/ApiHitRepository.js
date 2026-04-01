import { BaseRepository } from "./BaseRepository"


export class ApiHitRepository extends BaseRepository{
    constructor({model,logger:l}){
        super({logger:l})
        if(!model) throw new Error("ApiHitRepository requires a model")
        this.model=model
    }

    async save(eventData){
        try {
            const doc = new this.model(eventData)
            await doc.save()
            this.logger.info("API hit saved successfully",{eventId:eventData.eventId});
            return doc;
        } catch (error) {
            if(error.code === 11000){
                this.logger.warn("Duplicate API hit detected, skipping save",{eventId:eventData.eventId})
                return null;
            }
            this.logger.error("Error saving API hit",{error, eventId:eventData.eventId})
            throw error;
        }
    }
    async find(filter={}, options={}) {
        try {
            const {limit=100,skip=0,sort={timestamp:-1}} = options
            const hits = await this.model.find(filter).sort(sort).limit(limit).skip(skip).lean();
            this.logger.info("API hits found",{count: hits.length});
            return hits;
        } catch (error) {
           this.logger.error("Error finding API hits",{error})
           throw error; 
        }
    }
    async count(filter={}){
        try {
            const count = await this.model.countDocuments(filter);
            this.logger.info("API hit count retrieved",{count})
            return count;
        } catch (error) {
            this.logger.error("Error counting API hits",{error})
            throw error;
        }
    }
    async deleteOldhits(cutoffDate){
        try {
            const result = await this.model.deleteMany({timestamp:{$lt:cutoffDate}});
            this.logger.info("Old API hits deleted",{deletedCount:result.deletedCount})
            return result.deletedCount;
        } catch (error) {
            this.logger.error("Error deleting old API hits",{error})
            throw error;
        }
    }
}