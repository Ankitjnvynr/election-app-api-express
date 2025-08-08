import { VideoPost } from "../models/videoPost.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandlers.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const createVideoPost = asyncHandler(async (req, res) => {
    if (!req.body) {
        throw new ApiError(400, "Request body is required");
    }

    const { title, description, isPublished } = req.body;
    if ([title, description].some((field) => !field || field.trim() === "")) {
        throw new ApiError(400, `The field ${!title ? "title" : "description"} is required`);
    }

    let videoPath = null;
    let thumbnail = null;
    if (req.files && Array.isArray(req.files.video) && req.files.video.length > 0) {
        videoPath = req.files.video[0].path;
    }

    if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnail = req.files.thumbnail[0].path;
    }
    if (!videoPath || !thumbnail) {
        throw new ApiError(400, "Both video and thumbnail are required");
    }
    const uploadedVideo = await uploadOnCloudinary(videoPath);
    const uploadedThumbnail = await uploadOnCloudinary(thumbnail);

    console.log("Video uploaded to Cloudinary:", uploadedVideo);

    if (!uploadedVideo || !uploadedThumbnail) {
        throw new ApiError(500, "Failed to upload video or thumbnail to Cloudinary");
    }

    const videoPost = await VideoPost.create({
        ...req.body,
        videoLink: uploadedVideo.url,
        thumbnail: uploadedThumbnail.url,
        duration: uploadedVideo.duration,
        owner: req.user._id
    });

    return res
        .status(201)
        .json(new ApiResponse("Video post created successfully", videoPost));
})

// getting the videoposts with pagination

const getVideoPosts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { createdAt: -1 } // Sort by creation date in descending order
    };

    const aggrigate =  VideoPost.aggregate([
        {
            $match: {
                isPublished: true
            }
        },
        {
            $project: {
                title: 1,
                description: 1,
                videoLink: 1,
                thumbnail: 1,
                duration: 1,
                views: 1,
                createdAt: 1
            }
        }
    ])

    const result = await VideoPost.aggregatePaginate(aggrigate, options)
    console.log(result)
    if (!result) {
        throw new ApiError(404, "No video posts found");
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200, 
            {
                total: result.totalDocs,
                page: result.page,
                limit: result.limit,
                videoPosts: result.docs
            }, 
            "VideoPost recieved success"))
});



const getForAdminVideoPosts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { createdAt: -1 } 
    };

        const aggregate = VideoPost.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $unwind: "$owner"
        },
        {
            $project: {
                title: 1,
                description: 1,
                videoLink: 1,
                thumbnail: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                createdAt: 1,
                updatedAt: 1,
                "owner._id": 1,
                "owner.username": 1,
                "owner.fullName": 1,
                "owner.avatar": 1
            }
        }
    ]);

    const result = await VideoPost.aggregatePaginate(aggregate, options)
    console.log(result)
    if (!result) {
        throw new ApiError(404, "No video posts found");
    }

    return res
        .status(200)
        .json(new ApiResponse(
            200, 
            {
                total: result.totalDocs,
                page: result.page,
                limit: result.limit,
                videoPosts: result.docs
            }, 
            "VideoPost recieved success"))
});


export {
    createVideoPost,
    getVideoPosts,
    getForAdminVideoPosts
}