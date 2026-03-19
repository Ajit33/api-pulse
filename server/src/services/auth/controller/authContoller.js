import config from "../../../shared/config/index.js";
import {APPLICATION_ROLES} from "../../../shared/constants/role.js"
import ResponseFormatter from "../../../shared/utils/responseFormatter.js";
export class authController{
    constructor(authService){
        if(!authService){
            throw new Error("authService is Required");
        }
        this.authService=authService;
    }
    async onBoardSuperAdmin(req,res,next){
        try {
         const {username,email,password}=req.body;
         const superAdminData={
            username,password,email,role:APPLICATION_ROLES.SUPER_ADMIN
         }
        const { token, user } = await this.authService.onboardSuperAdmin(superAdminData);
      res.cookie("authToken", token, {
                httpOnly: config.cookie.httpOnly,
                secure: config.cookie.secure,
                maxAge: config.cookie.expiresIn
            });

            res.status(201).json(ResponseFormatter.success(user, "Super admin created successfully", 201))
        } catch (error) {
            next(error)
        }
    };
}