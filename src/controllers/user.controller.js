import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandlers.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken"
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);



const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validBeforeSave: false })
        return { refreshToken, accessToken }

    } catch (error) {
        console.error("Error generating tokens:", error);
        throw new ApiError(500, "Something went wrong while creating tokens")
    }
}


const googleLoginUser = asyncHandler(async (req, res) => {
    if (!req.body || !req.body.id_token) {
        throw new ApiError(400, "Google ID token is required");
    }

    const { id_token } = req.body;

    let ticket;
    try {
        ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
    } catch (error) {
        throw new ApiError(401, "Invalid Google token");
    }

    const payload = ticket.getPayload();

    const { email, name: fullName, picture: avatar } = payload;

    if (!email) {
        throw new ApiError(400, "Google account email is required");
    }

    let user = await User.findOne({ email });

    if (!user) {
        user = await User.create({
            email,
            fullName,
            avatar,
            username: email.split("@")[0].toLowerCase(), // create a username from email
            isGoogleAccount: true, // optional flag for future use
        });
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const options = {
        httpOnly: true,
        secure: true
    };

    const loggedUser = await User.findById(user._id).select("-password -refreshToken");

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedUser,
                accessToken,
                refreshToken
            }, "Google login successful")
        );
});



const registerUser = asyncHandler(async (req, res) => {
    if (!req.body) {
        throw new ApiError(400, "Request body is required");
    }

    console.log("Request body:", req.body);
    const { fullName, username, email, password } = req.body;

    if ([username, fullName, email, password].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, `The field ${!username ? "username" : !fullName ? "fullName" : !email ? "email" : "password"} is required`);
    }


    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with username or email is already exists");
    }

    let avatarLocalPath = null;

    if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) {
        avatarLocalPath = req.files.avatar[0].path;
    }

    let avatar = null

    if (avatarLocalPath) {
        avatar = await uploadOnCloudinary(avatarLocalPath)
        console.log("Avatar uploaded to Cloudinary:", avatar);
    }


    const user = await User.create({
        fullName,
        avatar: avatar?.url || null,
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong ! User not created");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, createdUser, "User registered successfully"));
})

const loginUser = asyncHandler(async (req, res) => {

    if (!req.body) {
        throw new ApiError(400, "Email or username is must required");
    }

    const { email, username, password } = req.body
    if (!(email || username) || !password) {
        throw new ApiError(400, "Email or username and password is required")
    }

    const user = await User.findOne({
        $or: [{ email }, { username }]
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid password")
    }

    const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id)

    const loggedUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedUser,
                    refreshToken,
                    accessToken
                },
                "Loggedin success"
            )
        )

})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null }, { new: true })

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", "", options)
        .cookie("refreshToken", "", options)
        .json(new ApiResponse(200, {}, "Logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incommingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(incommingRefreshToken, process.env.REFRESH_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (incommingRefreshToken != user?.refreshToken) {
            throw new ApiError(401, " refresh token is expired or used")
        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { refreshToken, newAccessToken } = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("refreshToken", refreshToken, options)
            .cookie("accessToken", newAccessToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        refreshToken,
                        accessToken: newAccessToken,
                    },
                    "access token refreshed"
                )
            )

    } catch (error) {
        throw new ApiError(401, error.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id)

    // const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    // if (!isPasswordCorrect) {
    //     throw new ApiError(401, "Old password is incorrect")
    // }

    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user fetched successfully"))

})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, country, phone, dob, voterId, state, district, city, address } = req.body;

    if (!req.body) {
        throw new ApiError(400, "data is required to update account details");
    }

    const updatedFields = {
        ...(fullName && { fullName }),
        ...(country && { country }),
        ...(phone && { phone }),
        ...(dob && { dob }),
        ...(voterId && { voterId }),
        ...(state && { state }),
        ...(district && { district }),
        ...(city && { city }),
        ...(address && { address })
    };

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updatedFields },
        { new: true }
    ).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.fiile.path
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(500, "Something went wrong while uploading avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { 
            $set: {
                avatar: avatar.url
            }
         },
        { new: true }
    ).select("-password -refreshToken");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Avatar updated successfully"))
})





export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    googleLoginUser
}