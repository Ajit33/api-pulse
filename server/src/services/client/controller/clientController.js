import ResponseFormatter from "../../../shared/utils/responseFormatter.js"
export class ClientController{
    constructor(clientService,authService){
       if(!clientService && !authService) {
        throw new Error("Client Service and Auth Service is Required");
       }
       this.clientService=clientService;
       this.authService=authService;   
    }
     async createClient(req,res,next){
        try {
            const isSuperAdmin=this.authService.checkSuperAdminPermissions(req.user.userId);
            if(!isSuperAdmin){
                return  res.status(403).json(ResponseFormatter.error("Access denied",403))
            }
            const client=await this.clientService.createClient(req.body,req.user);
           return res.status(201).json(ResponseFormatter.success(client, "Client created successfully", 201))
        } catch (error) {
            next(error)
        }
    }
    async createClientUser(req,res,next){
          try {
            const {userId}=req.params;
            const user= await this.clientService.createClientUser(userId,req.body,req.user);
            return res.status(201).json(user,ResponseFormatter.success("Client User created Sucessfully",201));
          } catch (error) {
            next(error)
          }
    }
}