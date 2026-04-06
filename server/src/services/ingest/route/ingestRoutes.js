
import express from "express";
import rateLimit from "express-rate-limit";


import validateApiKey from '../../../shared/middlewares/validateApiKey.js'
import config from "../../../shared/config/index.js";
import ingestContainer from "../Dependencies/dependencies.js"
const { ingestController } = ingestContainer;

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

router.post(
  "/",
  ingestLimiter,
  validateApiKey,
  (req, res, next) => ingestController.ingestHit(req, res, next)
);



export default router;