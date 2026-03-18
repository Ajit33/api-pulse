
export default class BaseRepository{
    constructor(model){
        this.model=model
    }
    async create(data){
       throw new Error("Method is not implemented")
    }
    async findById(id){
        throw new Error("Method is not implemented")
    }
    async findByUsername(Username){
        throw new Error("Method is not implemented")
    }
    async findByEmail(email){
        throw new Error("Method is not implemented")
    }
    async findAll(){
        throw new Error("Method is not implemented")
    }
}
