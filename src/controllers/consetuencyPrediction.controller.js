// src/controllers/consetuencyPrediction.js

import { ConsetuencyPrediction } from "../models/consetuencyPrediction.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandlers.js";
import mongoose from "mongoose";

// ✅ Create or Update a Prediction
const submitPrediction = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { state, area, constituency, voted_party } = req.body;

    if (!state || !area || !constituency || !voted_party) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if already exists for this user & constituency
    let prediction = await ConsetuencyPrediction.findOne({ user_id: userId, constituency });

    if (prediction) {
        if (prediction.isLocked) {
            throw new ApiError(403, "Prediction already locked, cannot update");
        }

        prediction.voted_party = voted_party;
        prediction.state = state;
        prediction.area = area;
        await prediction.save();

        return res
            .status(200)
            .json(new ApiResponse(200, prediction, "Prediction updated successfully"));
    }

    prediction = await ConsetuencyPrediction.create({
        user_id: userId,
        state,
        area,
        constituency,
        voted_party
    });

    return res
        .status(201)
        .json(new ApiResponse(201, prediction, "Prediction submitted successfully"));
});

// ✅ Lock a Prediction (once locked, cannot update)
const lockPrediction = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id } = req.params;

    const prediction = await ConsetuencyPrediction.findOne({ _id: id, user_id: userId });
    if (!prediction) {
        throw new ApiError(404, "Prediction not found");
    }

    prediction.isLocked = true;
    await prediction.save();

    return res
        .status(200)
        .json(new ApiResponse(200, prediction, "Prediction locked successfully"));
});

// ✅ Get My Predictions
const getMyPredictions = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const predictions = await ConsetuencyPrediction.find({ user_id: userId });

    return res
        .status(200)
        .json(new ApiResponse(200, predictions, "Predictions fetched successfully"));
});

// ✅ Aggregation: Count predictions per party for a constituency
const getConstituencyStats = asyncHandler(async (req, res) => {
    const { constituency } = req.params;

    if (!constituency) {
        throw new ApiError(400, "Constituency is required");
    }

    const stats = await ConsetuencyPrediction.aggregate([
        { $match: { constituency } },
        {
            $group: {
                _id: "$voted_party",
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Constituency stats fetched successfully"));
});

// ✅ Aggregation: Top parties by state
const getStateStats = asyncHandler(async (req, res) => {
    const { state } = req.params;

    if (!state) {
        throw new ApiError(400, "State is required");
    }

    const stats = await ConsetuencyPrediction.aggregate([
        { $match: { state } },
        {
            $group: {
                _id: { constituency: "$constituency", voted_party: "$voted_party" },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: "$_id.constituency",
                predictions: {
                    $push: {
                        party: "$_id.voted_party",
                        count: "$count"
                    }
                }
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, stats, "State stats fetched successfully"));
});

// ✅ Delete Prediction (only if not locked)
const deletePrediction = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { id } = req.params;

    const prediction = await ConsetuencyPrediction.findOne({ _id: id, user_id: userId });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found");
    }

    if (prediction.isLocked) {
        throw new ApiError(403, "Locked prediction cannot be deleted");
    }

    await prediction.deleteOne();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Prediction deleted successfully"));
});

export {
    submitPrediction,
    lockPrediction,
    getMyPredictions,
    getConstituencyStats,
    getStateStats,
    deletePrediction
};
