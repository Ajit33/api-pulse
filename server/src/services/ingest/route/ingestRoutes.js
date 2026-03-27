
import express from "express";
import rateLimit from "express-rate-limit";
import config from "../../../shared/config";
import { IngestController } from "../controller/ingestController";
import validateApiKey from "../../../shared/middlewares/validateApikey";

const router=express.Router();

const ingestLimiter=rateLimit({
    windowMs:config.rateLimit.windowMs,
    max:config.rateLimit.maxRequests,
    message:{
        success:false,
        message:'Too many requests, please try again later' ,
        statusCode:429
    },
    standardHeaders:true,
    legacyHeaders:true
})

router.post("/",ingestLimiter,validateApiKey,(req,res,next)=>IngestController.ingestHit(req,res,next));



export default router;