import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandlers.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import jwt from "jsonwebtoken"
import { OAuth2Client } from "google-auth-library";
import mongoosePaginate from "mongoose-paginate-v2";
import { ActivityLog } from '../models/activityLog.model.js';
import { Answer } from '../models/answer.model.js';
import { ConsetuencyPrediction } from '../models/consetuencyPrediction.model.js';
import { CMPrediction } from '../models/cmPrediction.model.js';

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
            isGoogleAccount: true, // optional flag for future use,
            points:0,
            isVerified:true
        });

        if(user){
                // ✅ Proceed: Create the activity log
                const points_earned = 250;
                const points_spent = 0;
                const log = await ActivityLog.create({
                    user_id: user?._id,
                    action:"Welcome Bonus",
                    details:"Signup bonus for new user",
                    points_earned,
                    points_spent,
                });
            
                // 💡 Update the user points (atomic update from DB state)
                await User.findByIdAndUpdate(user?._id, {
                    $inc: {
                        points: points_earned - points_spent,
                    },
                });
        }
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

        const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id)

        return res
            .status(200)
            .cookie("refreshToken", refreshToken, options)
            .cookie("accessToken", accessToken, options)
            .json(
                new ApiResponse(
                    200,
                    {
                        refreshToken,
                        accessToken
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


// attach plugin (once)
User.schema.plugin(mongoosePaginate);

const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, email, username, isVerified } = req.query;

  // build filter object
  const filters = {};
  if (role) filters.role = role;
  if (email) filters.email = { $regex: email, $options: "i" };
  if (username) filters.username = { $regex: username, $options: "i" };
  if (typeof isVerified !== "undefined") filters.isVerified = isVerified === "true";

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { createdAt: -1 },
    select: "-password -refreshToken", // hide sensitive fields
  };

  // Paginated users
  const result = await User.paginate(filters, options);

  if (!result.docs.length) {
    throw new ApiError(404, "No users found");
  }

  // Aggregate stats for each user
  const userIds = result.docs.map((u) => u._id);

  // Fetch counts in parallel
  const [activities, correctAnswers, constituencyPreds, cmPreds] = await Promise.all([
    ActivityLog.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } },
    ]),
    Answer.aggregate([
      { $match: { user_id: { $in: userIds }, is_correct: true } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } },
    ]),
    ConsetuencyPrediction.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } },
    ]),
    CMPrediction.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } },
    ]),
  ]);

  // Convert arrays to maps for quick lookup
  const mapCounts = (arr) =>
    arr.reduce((acc, cur) => {
      acc[cur._id.toString()] = cur.count;
      return acc;
    }, {});

  const activityMap = mapCounts(activities);
  const correctAnsMap = mapCounts(correctAnswers);
  const constPredMap = mapCounts(constituencyPreds);
  const cmPredMap = mapCounts(cmPreds);

  // Attach stats to each user
  const usersWithStats = result.docs.map((u) => {
    const id = u._id.toString();
    return {
      ...u.toObject(),
      totalActivities: activityMap[id] || 0,
      totalCorrectAnswers: correctAnsMap[id] || 0,
      totalPredictions: (constPredMap[id] || 0) + (cmPredMap[id] || 0),
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users: usersWithStats,
        totalDocs: result.totalDocs,
        totalPages: result.totalPages,
        currentPage: result.page,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
      },
      "Users fetched successfully"
    )
  );
});


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    googleLoginUser,
    getAllUsers,
}