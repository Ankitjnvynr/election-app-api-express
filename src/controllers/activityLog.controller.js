import { ActivityLog } from "../models/activityLog.model.js";
import { asyncHandler } from "../utils/asyncHandlers.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";

const createActivityLog = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { action, details, points_earned = 0, points_spent = 0 } = req.body;

    if (!action) {
        throw new ApiError(400, "Action is required");
    }

    // 🧠 Fetch latest user from DB
    const user = await User.findById(userId).select("points");

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // 🔒 Prevent action if user doesn't have enough points
    if ((user.points - points_spent+points_earned)<0) {
        throw new ApiError(402, "Insufficient points to perform this action");
    }

    // ✅ Proceed: Create the activity log
    const log = await ActivityLog.create({
        user_id: userId,
        action,
        details,
        points_earned,
        points_spent,
    });

    // 💡 Update the user points (atomic update from DB state)
    await User.findByIdAndUpdate(userId, {
        $inc: {
            points: points_earned - points_spent,
        },
    });

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                log,
                "Activity log created and points updated successfully"
            )
        );
});

// ✅ Get paginated logs using aggregate
const getPaginatedActivityLogs = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [
        { $match: { user_id: userId } },
        { $sort: { created_at: -1 } },
        {
            $facet: {
                total: [{ $count: "count" }],
                data: [{ $skip: skip }, { $limit: limit }],
            },
        },
        {
            $project: {
                total: { $arrayElemAt: ["$total.count", 0] },
                data: 1,
            },
        },
    ];

    const result = await ActivityLog.aggregate(pipeline);

    const response = {
        total: result[0]?.total || 0,
        page,
        limit,
        logs: result[0]?.data || [],
    };

    return res
        .status(200)
        .json(new ApiResponse(200, response, "Activity logs fetched successfully"));
});

export { createActivityLog, getPaginatedActivityLogs };
