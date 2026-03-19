import express from "express";
import dependencies from "../Dependencies/dependencies.js";
import validate from "../../../shared/middlewares/validate.js";
import { onboardSuperAdminSchema,registrationSchema,loginSchema } from "../validation/authSchema.js";
import requestLogger from "../../../shared/middlewares/requestLogger.js";
import authenticate from "../../../shared/middlewares/authenticate.js";
import authorize from "../../../shared/middlewares/authorize.js";
import {APPLICATION_ROLES} from "../../../shared/constants/role.js"
const router=express.Router();
const {controller}=dependencies;
const authController=controller.authController;

router.post("/onboard-super-admin",requestLogger,validate(onboardSuperAdminSchema),(req,res,next)=>{
    authController.onBoardSuperAdmin(req,res,next)
})
router.post("/register",
     requestLogger,
     authenticate,
     authorize([APPLICATION_ROLES.SUPER_ADMIN]),
     validate(registrationSchema)
     ,(req,res,next)=>{
    authController.register(req,res,next)
     }
)
router.post("/login",requestLogger,validate(loginSchema),(req,res,next)=>{
    authController.login(req,res,next)
})
router.get("/profile",
    requestLogger,
    authenticate,
    (req, res, next) => authController.getProfile(req, res, next)
)
router.post("/logout",requestLogger, (req, res, next) => authController.logout(req, res, next))
export default router;