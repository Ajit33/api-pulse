import express from "express";
import clientDependencies from "../Dependencies/dependencies.js";
import autheticate from "../../../shared/middlewares/authenticate.js"


const router=express.Router();
const {clientController}=clientDependencies.controller;

router.use(autheticate);

router.post("/admin/clients/onboard",(req,res,next)=>{
    clientController.createClient(req,res,next)
})


export default router