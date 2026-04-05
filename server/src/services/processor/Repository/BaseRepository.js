

 export class BaseRepository {
    constructor({logger:l=console}={}){
        this.logger = l;
    }
   async save(){
        throw new Error("Method is not implemented")
   }
   async find(){
        throw new Error("Method is not implemented")
   }
   async count(){
    throw new Error("Method is not implemented") 
   }
   async deleteOldhits(){
    throw new Error("Method is not implemented")
   }
}