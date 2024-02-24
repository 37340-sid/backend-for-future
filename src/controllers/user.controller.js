import {asyncHandler} from "../utils/asynchandler.js"
import {APiError} from "../utils/apierror.js"
import { USER } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiresponse.js"
const registerUser=asyncHandler(async(req,res)=>{
   //get all the user details from frontend
   //validation- not empty
   //check if user already exists:username, email
   //check for img ,check for avatar
   //upload them to cloudinary,avatar
   //create user object -create entry in db
   //remove password and refresh token field from response
   //check for usercreation 
   //return res

   const {fullname,email,username,password}=req.body
   console.log('email:',email);
    if([fullname,email,username,password].some((field)=>field?.trim()==="")){
        throw new APiError(400,"All field is required")
    }
    const existedUser=await USER.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw new APiError(409,"User with email or username already exists")
    }
    const avatarLocalPath=req.files?.avatar[0]?.path
    console.log(avatarLocalPath)
    const coverImageLocalPath=req.files?.coverImage[0]?.path
    if(!avatarLocalPath){
        throw new APiError(400,"Avatar local file is required ")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    console.log(avatar)
    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new APiError(400,"Avatar file is required")
    }
    const user=await USER.create({
        fullname,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })
    const createdUser=await USER.findById(user._id).select(
        "-password -refreshtoken " 
    )
    if(!createdUser){
        throw new APiError(500,"Something went wrong while registering the user")
    }
    return res.status(200).json(
        new ApiResponse(200,createdUser,"user register successfully")
    )
})

export {registerUser}