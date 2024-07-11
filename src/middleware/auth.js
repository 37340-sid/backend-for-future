import { APiError } from "../utils/apierror.js";
import { asyncHandler } from "../utils/asynchandler.js";
import {USER} from "../models/user.model.js"
import jwt from "jsonwebtoken"

export const verifyJWT =asyncHandler(async (req,res,next)=>{
    try {
        console.log(req)
        const token=req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
        console.log(token)
        if(!token){
            throw new APiError(401,"Unauthorized request")
        }
        const decodeToken=jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        const user=await USER.findById(decodeToken?._id).select("-password -refreshtoken")
        if(!user){
    
            throw new APiError(401,"Invalid access token!")
        }
        req.user=user
        next()
    } catch (error) {
        throw new APiError(401,error?.message || "Invalid access token")
    }
})