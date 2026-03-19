/**
 * BaseClientRepository class to define the interface for client repository implementations
 * This class provides method signatures for creating clients, finding clients by ID or slug, and finding/counting clients based on filters. It serves as a base class for specific database implementations of the client repository. Each method throws a "Method not implemented" error, indicating that subclasses must provide their own implementations for these methods.
 */
export default class BaseClientRepository{
    /**
     * Constructor for BaseClientRepository
     * @param {*} model - The Mongoose model for the client
     */
    constructor(model){
        this.model=model
    }
    async create(clientdata){
        throw new Error("Method is not implemented")
    }
    async FindByClientId(clientid){
         throw new Error("Method is not implemented") 
    }
    async FindBySlug(slug){
       throw new Error("Method is not implemented") 
    }
     async find(filters, options) {
        throw new Error('Method not implemented');
    }

    async count(filters) {
        throw new Error('Method not implemented');
    }
    

}