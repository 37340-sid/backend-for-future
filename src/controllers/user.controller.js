import {asyncHandler} from "../utils/asynchandler.js"
import {APiError} from "../utils/apierror.js"
import { USER } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiresponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"


const generateAccessAndRefreshTokens=async(userId) => {
    try {
        const user=await USER.findById(userId)
        const accessToken=user.generateAccessToken()
        // console.log("acessToke: ", accessToken)
        const refreshToken=user.generateRefreshtoken()
        // console.log("refreshToken: ", refreshToken)
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
        new ApiResponse(200,createdUser,"user registered successfully")
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
    // console.log("accToken: ",accessToken)
    // console.log("refToken: ",refreshToken)
    const loggedInUser=await USER.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true
    }
    // console.log(accessToken)
    // console.log(refreshToken)
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
        $unset:{
            refreshToken:1
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
    .json(new ApiResponse(200,{},"User logout"))
})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new APiError(401,"unathorized request")
    }
   try {
     const decodedToken=jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
     )
     const user=await USER.findById(decodedToken?._id)
     if(!user){
         throw new APiError(401,"invalid refresh token")
     }
     if(!incomingRefreshToken !== user?.refreshToken){
         throw new APiError(401,"Refresh token is expired or used")
     }
 
     const options={
         httpOnly:true,
         secure:true
     }
     const {accessToken,newrefreshToken}=await generateAccessAndRefreshTokens(user._id)
 
     return res
     .status(200)
     .cookies("accessToken",accessToken,options)
     .cookies("refreshToken",newrefreshToken,options)
     .json(
         new ApiResponse(
             200,
             {accessToken,refreshToken:newrefreshToken},
             "Access Token refreshed"
         )
     )
   } catch (error) {
        new APiError(401, error?.message || "invalid request token")
   }

})

const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body
    const user=await USER.findById(req.user?._id)
    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        new APiError(400,"Invalid password")
    }
    user.password=newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200).json(new ApiResponse(200,{},"Password changed successfully"))
})

const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"Current user fetched successfully"))
})

const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullname,email}=req.body()
    if(!fullname || !email){
        throw new APiError(400,"All fields are required")
    }
    const user=USER.findById(
        req.user?._id,
        {
            $set:{
                fullname,
                email:email
            }
        },
        {new:true}).select("-password")

        return res.status(200).json(new ApiResponse(200,user,"Account detail updated successfully"))
})

const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path
    if(!avatarLocalPath){
        throw new APiError(400,"Avatar file is missing")
    }
    const avatar=await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new APiError(400,"Error while uploading avatar")
    }
    const user=await USER.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new: true}
    ).select("-password")
    return res.status(200).json(new ApiResponse(200,user,"Avatar image updates successfully"))
})

const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverLocalPath=req.file?.path
    if(!coverLocalPath){
        throw new APiError(400,"Cover file is missing")
    }
    const coverImage=await uploadOnCloudinary(coverLocalPath)
    if(!coverImage.url){
        throw new APiError(400,"Error while uploading cover")
    }
    const user=await USER.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(new ApiResponse(200,user,"Cover image updates successfully"))

})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params
    if(!username?.trim()){
        throw new APiError(400,"Username is missing")
    }

    const channel= await USER.aggregate([
        {
            $match:{
                username:username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{
                fullname:1,
                email:1,
                isSubscribed:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                username:1,
                avatar:1,
                coverImage:1
            }
        }
    ])

    if(!channel?.length){
        throw new APiError(400,"Channel does not exits")
    }

    return res.status(200).json(new ApiResponse(200,channel[0],"User channel fetched successfully"))

})

const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await USER.aggregate([
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user._id)
            }
        },{
            $lookup:{
                from:"videos",
                localField:"watchhistory",
                foreignField:"_id",
                as:"watchhistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project:{
                                        fullname:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res.status(200).json(new ApiResponse(200,user[0].watchhistory,"watch history fetched successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    getCurrentUser,
    changeCurrentPassword,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}