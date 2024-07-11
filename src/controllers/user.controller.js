import {asyncHandler} from "../utils/asynchandler.js"
import {APiError} from "../utils/apierror.js"
import { USER } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiresponse.js"
import jwt from "jsonwebtoken"


const generateAccessAndRefreshTokens=async(userId) => {
    try {
        const user=await USER.findById(userId)
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshtoken()
        user.refreshtoken=refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        throw new APiError(500,"Something went wrong while generating access and refresh token")
    }
}

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
    console.log(req.body)
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
    // console.log(avatarLocalPath)

    // const coverImageLocalPath=req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath=req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new APiError(400,"Avatar local file is required ")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)
    // console.log(avatar)

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

const loginUser=asyncHandler(async(req,res)=>{
    //req.body -> data
    //username , email is available or not 
    //find the user
    //password check  throw error
    //access or refresh token
    //send cookies
    //response
    const {email,username,password}=req.body

    if(!(username || email)){
        throw new APiError(400,"username and password is required")
    }
    const user=await USER.findOne({
        $or:[{username},{email}]
    })
    if(!user) throw new APiError(404,"User does not exit")

    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new APiError(401,"password incorrect")
    }
    
    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)

    const loggedInUser=await USER.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true
    }
    console.log(accessToken)
    console.log(refreshToken)
    res = res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(
        200,
        {
            user:loggedInUser,accessToken,refreshToken
        },
        "User logged in successfully"
    ))
    return res;

})

const logoutUser=asyncHandler(async(req,res)=>{
    await USER.findByIdAndUpdate(req.user._id,{
        $set:{
            refreshToken:undefined
        }
    },{
        new:true
    })
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logout successfully"))
})

export {registerUser,loginUser,logoutUser}