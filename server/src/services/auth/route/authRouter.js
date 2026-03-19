import express from "express";
import dependencies from "../Dependencies/dependencies.js";
import validate from "../../../shared/middlewares/validate.js";
import { onboardSuperAdminSchema } from "../validation/authSchema.js";
import requestLogger from "../../../shared/middlewares/requestLogger.js";

const router=express.Router();
const {controller}=dependencies;
const authController=controller.authController;

router.post("/onboard-super-admin",requestLogger,validate(onboardSuperAdminSchema),(req,res,next)=>{
    authController.onBoardSuperAdmin(req,res,next)
})

export default router;