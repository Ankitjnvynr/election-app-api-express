import { Prediction } from '../models/constituencyPrediction.model.js';
import { User } from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandlers.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import mongoosePaginate from "mongoose-paginate-v2";

// Create a new prediction set for a user
const createPrediction = asyncHandler(async (req, res) => {
    const { electionType = 'assembly', electionYear, state = 'Bihar' } = req.body;

    if (!electionYear) {
        throw new ApiError(400, "Election year is required");
    }

    // Check if user already has a prediction for this election
    const existingPrediction = await Prediction.findOne({
        userId: req.user._id,
        electionYear,
        state,
        electionType
    });

    if (existingPrediction) {
        throw new ApiError(409, "Prediction already exists for this election. Use update instead.");
    }

    const prediction = await Prediction.create({
        userId: req.user._id,
        electionType,
        electionYear,
        state,
        predictions: [],
        totalCoins: 0
    });

    return res
        .status(201)
        .json(new ApiResponse(201, prediction, "Prediction set created successfully"));
});

// Get user's prediction for specific election
const getUserPrediction = asyncHandler(async (req, res) => {
    const { electionYear = new Date().getFullYear(), state = 'Bihar' } = req.query;

    const prediction = await Prediction.findOne({
        userId: req.user._id,
        electionYear: parseInt(electionYear),
        state
    }).populate('userId', 'username fullName avatar points');

    if (!prediction) {
        throw new ApiError(404, "Prediction not found for this election");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, prediction, "Prediction fetched successfully"));
});

// Add or update a constituency prediction
const addConstituencyPrediction = asyncHandler(async (req, res) => {
    const { constituency, area, predictedParty, confidence = 50 } = req.body;
    const { predictionId } = req.params;

    if (!constituency || !area || !predictedParty) {
        throw new ApiError(400, "Constituency, area, and predicted party are required");
    }

    const prediction = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    const result = prediction.addPrediction(constituency, area, predictedParty, confidence);
    
    if (!result.success) {
        throw new ApiError(400, result.error);
    }

    // Award coins based on action
    const coinsEarned = result.action === 'created' ? 5 : 3;
    prediction.totalCoins += coinsEarned;

    await prediction.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {
            prediction,
            coinsEarned,
            action: result.action
        }, `Constituency prediction ${result.action} successfully`));
});

// Lock a constituency prediction
const lockConstituencyPrediction = asyncHandler(async (req, res) => {
    const { predictionId, constituency } = req.params;

    const prediction = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    const result = prediction.lockPrediction(constituency);
    
    if (!result.success) {
        throw new ApiError(400, result.error);
    }

    // Award bonus coins for locking
    prediction.totalCoins += 10;

    await prediction.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {
            prediction,
            coinsEarned: 10
        }, "Constituency prediction locked successfully"));
});

// Update prediction metadata
const updatePrediction = asyncHandler(async (req, res) => {
    const { predictionId } = req.params;
    const { 
        overallWinner, 
        status, 
        isPublic, 
        timeSpentMinutes,
        deviceInfo 
    } = req.body;

    const updatedFields = {};
    if (overallWinner) updatedFields.overallWinner = overallWinner;
    if (status) updatedFields.status = status;
    if (typeof isPublic !== 'undefined') updatedFields.isPublic = isPublic;
    if (timeSpentMinutes) updatedFields.timeSpentMinutes = timeSpentMinutes;
    if (deviceInfo) updatedFields.deviceInfo = deviceInfo;

    // Set submission date if status is being changed to submitted
    if (status === 'submitted') {
        updatedFields.submittedAt = new Date();
    }

    const prediction = await Prediction.findOneAndUpdate(
        { _id: predictionId, userId: req.user._id },
        { $set: updatedFields },
        { new: true, runValidators: true }
    ).populate('userId', 'username fullName avatar points');

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, prediction, "Prediction updated successfully"));
});

// Delete a constituency prediction
const deleteConstituencyPrediction = asyncHandler(async (req, res) => {
    const { predictionId, constituency } = req.params;

    const prediction = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    const constituencyPrediction = prediction.predictions.find(
        p => p.constituency === constituency
    );

    if (!constituencyPrediction) {
        throw new ApiError(404, "Constituency prediction not found");
    }

    if (constituencyPrediction.isLocked) {
        throw new ApiError(400, "Cannot delete locked prediction");
    }

    // Remove the constituency prediction
    prediction.predictions = prediction.predictions.filter(
        p => p.constituency !== constituency
    );

    // Deduct coins (half of what was earned)
    const coinsDeducted = 2;
    prediction.totalCoins = Math.max(0, prediction.totalCoins - coinsDeducted);

    await prediction.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {
            prediction,
            coinsDeducted
        }, "Constituency prediction deleted successfully"));
});

// Delete entire prediction set
const deletePrediction = asyncHandler(async (req, res) => {
    const { predictionId } = req.params;

    const prediction = await Prediction.findOneAndDelete({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    // Check if any predictions are locked
    const lockedCount = prediction.predictions.filter(p => p.isLocked).length;
    if (lockedCount > 0) {
        throw new ApiError(400, `Cannot delete prediction set with ${lockedCount} locked predictions`);
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Prediction deleted successfully"));
});

// Get all predictions with pagination and filters
const getAllPredictions = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        electionYear, 
        state = 'Bihar', 
        status, 
        isPublic,
        userId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = req.query;

    const filters = {};
    if (electionYear) filters.electionYear = parseInt(electionYear);
    if (state) filters.state = state;
    if (status) filters.status = status;
    if (typeof isPublic !== 'undefined') filters.isPublic = isPublic === 'true';
    if (userId) filters.userId = userId;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: sortOptions,
        populate: {
            path: 'userId',
            select: 'username fullName avatar points'
        }
    };

    const result = await Prediction.paginate(filters, options);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                predictions: result.docs,
                totalDocs: result.totalDocs,
                totalPages: result.totalPages,
                currentPage: result.page,
                hasNextPage: result.hasNextPage,
                hasPrevPage: result.hasPrevPage
            },
            "Predictions fetched successfully"
        )
    );
});

// Get prediction by ID
const getPredictionById = asyncHandler(async (req, res) => {
    const { predictionId } = req.params;

    const prediction = await Prediction.findById(predictionId)
        .populate('userId', 'username fullName avatar points');

    if (!prediction) {
        throw new ApiError(404, "Prediction not found");
    }

    // Check if user can view this prediction
    if (!prediction.isPublic && prediction.userId._id.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Access denied to private prediction");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, prediction, "Prediction fetched successfully"));
});

// Get leaderboard
const getLeaderboard = asyncHandler(async (req, res) => {
    const { 
        electionYear = new Date().getFullYear(), 
        limit = 10,
        page = 1
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const leaderboard = await Prediction.aggregate([
        {
            $match: {
                electionYear: parseInt(electionYear),
                state: 'Bihar',
                status: { $in: ['submitted', 'completed'] },
                isPublic: true
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
                pipeline: [
                    { $project: { username: 1, fullName: 1, avatar: 1, points: 1 } }
                ]
            }
        },
        { $unwind: '$user' },
        {
            $addFields: {
                score: {
                    $add: [
                        { $multiply: ['$totalPredictions', 2] },
                        { $multiply: ['$lockedPredictions', 5] },
                        { $multiply: ['$totalCoins', 0.1] }
                    ]
                }
            }
        },
        { $sort: { score: -1, totalPredictions: -1, lockedPredictions: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
            $project: {
                user: 1,
                totalPredictions: 1,
                lockedPredictions: 1,
                totalCoins: 1,
                completionPercentage: 1,
                score: 1,
                submittedAt: 1
            }
        }
    ]);

    const totalCount = await Prediction.countDocuments({
        electionYear: parseInt(electionYear),
        state: 'Bihar',
        status: { $in: ['submitted', 'completed'] },
        isPublic: true
    });

    return res
        .status(200)
        .json(new ApiResponse(200, {
            leaderboard,
            totalCount,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit))
        }, "Leaderboard fetched successfully"));
});

// Get area-wise analytics
const getAreaAnalytics = asyncHandler(async (req, res) => {
    const { area, electionYear = new Date().getFullYear() } = req.params;

    if (!area) {
        throw new ApiError(400, "Area is required");
    }

    const analytics = await Prediction.getAreaAnalytics(area, parseInt(electionYear));

    const summary = await Prediction.aggregate([
        { $match: { electionYear: parseInt(electionYear), state: 'Bihar' } },
        { $unwind: '$predictions' },
        { $match: { 'predictions.area': area } },
        {
            $group: {
                _id: '$predictions.predictedParty',
                totalPredictions: { $sum: 1 },
                avgConfidence: { $avg: '$predictions.confidence' },
                lockedCount: {
                    $sum: { $cond: ['$predictions.isLocked', 1, 0] }
                }
            }
        },
        { $sort: { totalPredictions: -1 } }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, {
            area,
            electionYear: parseInt(electionYear),
            constituencyAnalytics: analytics,
            partySummary: summary
        }, "Area analytics fetched successfully"));
});

// Get user's prediction progress
const getUserPredictionProgress = asyncHandler(async (req, res) => {
    const { electionYear = new Date().getFullYear() } = req.query;

    const prediction = await Prediction.findOne({
        userId: req.user._id,
        electionYear: parseInt(electionYear),
        state: 'Bihar'
    });

    if (!prediction) {
        return res
            .status(200)
            .json(new ApiResponse(200, {
                progress: {
                    total: 243,
                    completed: 0,
                    locked: 0,
                    percentage: 0
                },
                coins: 0,
                status: 'not_started'
            }, "No prediction found"));
    }

    const progress = prediction.calculateProgress();

    return res
        .status(200)
        .json(new ApiResponse(200, {
            progress,
            coins: prediction.totalCoins,
            status: prediction.status,
            lastUpdated: prediction.lastUpdated
        }, "Prediction progress fetched successfully"));
});

// Bulk add constituency predictions
const bulkAddPredictions = asyncHandler(async (req, res) => {
    const { predictionId } = req.params;
    const { predictions: constituencyPredictions } = req.body;

    if (!Array.isArray(constituencyPredictions) || constituencyPredictions.length === 0) {
        throw new ApiError(400, "Array of predictions is required");
    }

    const prediction = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    let totalCoinsEarned = 0;
    let addedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const pred of constituencyPredictions) {
        const { constituency, area, predictedParty, confidence = 50 } = pred;
        
        if (!constituency || !area || !predictedParty) {
            errors.push(`Invalid data for constituency: ${constituency || 'unknown'}`);
            errorCount++;
            continue;
        }

        const result = prediction.addPrediction(constituency, area, predictedParty, confidence);
        
        if (result.success) {
            const coinsEarned = result.action === 'created' ? 5 : 3;
            totalCoinsEarned += coinsEarned;
            
            if (result.action === 'created') addedCount++;
            else updatedCount++;
        } else {
            errors.push(`${constituency}: ${result.error}`);
            errorCount++;
        }
    }

    prediction.totalCoins += totalCoinsEarned;
    await prediction.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {
            prediction,
            summary: {
                added: addedCount,
                updated: updatedCount,
                errors: errorCount,
                totalCoinsEarned
            },
            errors: errors.length > 0 ? errors : undefined
        }, "Bulk predictions processed successfully"));
});

// Get predictions by area
const getPredictionsByArea = asyncHandler(async (req, res) => {
    const { area } = req.params;
    const { electionYear = new Date().getFullYear() } = req.query;

    const prediction = await Prediction.findOne({
        userId: req.user._id,
        electionYear: parseInt(electionYear),
        state: 'Bihar'
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found");
    }

    const areaPredictions = prediction.getPredictionsByArea(area);

    return res
        .status(200)
        .json(new ApiResponse(200, {
            area,
            predictions: areaPredictions,
            count: areaPredictions.length
        }, "Area predictions fetched successfully"));
});

// Reset unlocked predictions
const resetUnlockedPredictions = asyncHandler(async (req, res) => {
    const { predictionId } = req.params;

    const prediction = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    const lockedPredictions = prediction.predictions.filter(p => p.isLocked);
    const unlockedCount = prediction.predictions.length - lockedPredictions.length;

    if (unlockedCount === 0) {
        throw new ApiError(400, "No unlocked predictions to reset");
    }

    // Keep only locked predictions
    prediction.predictions = lockedPredictions;

    // Recalculate coins (keep coins from locked predictions only)
    const lockedCoins = lockedPredictions.length * 15; // 5 for prediction + 10 for lock
    prediction.totalCoins = lockedCoins;

    await prediction.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {
            prediction,
            resetCount: unlockedCount,
            lockedCount: lockedPredictions.length
        }, "Unlocked predictions reset successfully"));
});

// Get constituency prediction details
const getConstituencyPrediction = asyncHandler(async (req, res) => {
    const { predictionId, constituency } = req.params;

    const prediction = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    const constituencyPrediction = prediction.getPredictionByConstituency(constituency);

    if (!constituencyPrediction) {
        throw new ApiError(404, "Constituency prediction not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, constituencyPrediction, "Constituency prediction fetched successfully"));
});

// Get public predictions (for comparison/analytics)
const getPublicPredictions = asyncHandler(async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        electionYear = new Date().getFullYear(),
        area,
        constituency
    } = req.query;

    const matchStage = {
        electionYear: parseInt(electionYear),
        state: 'Bihar',
        isPublic: true,
        status: { $in: ['submitted', 'completed'] }
    };

    let pipeline = [
        { $match: matchStage },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user',
                pipeline: [
                    { $project: { username: 1, fullName: 1, avatar: 1 } }
                ]
            }
        },
        { $unwind: '$user' }
    ];

    // Filter by area or constituency if specified
    if (area || constituency) {
        pipeline.push({ $unwind: '$predictions' });
        
        if (area) {
            pipeline.push({ $match: { 'predictions.area': area } });
        }
        if (constituency) {
            pipeline.push({ $match: { 'predictions.constituency': constituency } });
        }

        pipeline.push({
            $group: {
                _id: '$_id',
                user: { $first: '$user' },
                electionYear: { $first: '$electionYear' },
                totalPredictions: { $first: '$totalPredictions' },
                totalCoins: { $first: '$totalCoins' },
                status: { $first: '$status' },
                submittedAt: { $first: '$submittedAt' },
                predictions: { $push: '$predictions' }
            }
        });
    }

    pipeline.push(
        { $sort: { submittedAt: -1, totalPredictions: -1 } },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
    );

    const [predictions, totalCount] = await Promise.all([
        Prediction.aggregate(pipeline),
        Prediction.countDocuments(matchStage)
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                predictions,
                totalCount,
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit))
            },
            "Public predictions fetched successfully"
        )
    );
});

// Get prediction statistics
const getPredictionStats = asyncHandler(async (req, res) => {
    const { electionYear = new Date().getFullYear() } = req.query;

    const stats = await Prediction.aggregate([
        {
            $match: {
                electionYear: parseInt(electionYear),
                state: 'Bihar'
            }
        },
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                totalPredictions: { $sum: '$totalPredictions' },
                totalLockedPredictions: { $sum: '$lockedPredictions' },
                totalCoinsEarned: { $sum: '$totalCoins' },
                avgProgress: { $avg: { $multiply: [{ $divide: ['$totalPredictions', '$totalConstituencies'] }, 100] } },
                completedPredictions: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                submittedPredictions: {
                    $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] }
                }
            }
        }
    ]);

    // Party-wise prediction distribution
    const partyStats = await Prediction.aggregate([
        { $match: { electionYear: parseInt(electionYear), state: 'Bihar' } },
        { $unwind: '$predictions' },
        {
            $group: {
                _id: '$predictions.predictedParty',
                count: { $sum: 1 },
                avgConfidence: { $avg: '$predictions.confidence' },
                lockedCount: { $sum: { $cond: ['$predictions.isLocked', 1, 0] } }
            }
        },
        { $sort: { count: -1 } }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, {
            general: stats[0] || {},
            partyDistribution: partyStats
        }, "Prediction statistics fetched successfully"));
});

// Submit final prediction
const submitPrediction = asyncHandler(async (req, res) => {
    const { predictionId } = req.params;
    const { overallWinner } = req.body;

    const prediction = await Prediction.findOne({
        _id: predictionId,
        userId: req.user._id
    });

    if (!prediction) {
        throw new ApiError(404, "Prediction not found or unauthorized");
    }

    if (prediction.status === 'submitted' || prediction.status === 'completed') {
        throw new ApiError(400, "Prediction is already submitted");
    }

    // Validate minimum predictions required
    if (prediction.totalPredictions < 50) {
        throw new ApiError(400, "Minimum 50 constituency predictions required to submit");
    }

    prediction.status = 'submitted';
    prediction.submittedAt = new Date();
    if (overallWinner) {
        prediction.overallWinner = overallWinner;
    }

    // Award bonus coins for submission
    prediction.totalCoins += 50;

    await prediction.save();

    return res
        .status(200)
        .json(new ApiResponse(200, prediction, "Prediction submitted successfully"));
});

export {
    createPrediction,
    getUserPrediction,
    addConstituencyPrediction,
    lockConstituencyPrediction,
    updatePrediction,
    deleteConstituencyPrediction,
    deletePrediction,
    getAllPredictions,
    getPredictionById,
    getLeaderboard,
    getAreaAnalytics,
    getUserPredictionProgress,
    bulkAddPredictions,
    getPredictionsByArea,
    resetUnlockedPredictions,
    getConstituencyPrediction,
    getPublicPredictions,
    getPredictionStats,
    submitPrediction
};