// controllers/dashboard.controller.js
import { User } from "../models/user.model.js";
import { Question } from "../models/question.model.js";
import { Answer } from "../models/answer.model.js";
import { ConsetuencyPrediction } from "../models/consetuencyPrediction.model.js";
import { CMPrediction } from "../models/cmPrediction.model.js";
import { ActivityLog } from "../models/activityLog.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandlers.js";

// ✅ Dashboard statistics
const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    // Count totals
    const totalUsers = await User.countDocuments();
    const totalQuestions = await Question.countDocuments();
    const totalAnswers = await Answer.countDocuments();
    const totalConstituencyPredictions = await ConsetuencyPrediction.countDocuments();
    const totalCMPredictions = await CMPrediction.countDocuments();
    const totalActivityLogs = await ActivityLog.countDocuments();

    // Extra insights
    const topUsers = await User.find().sort({ points: -1 }).limit(5).select("fullName points avatar");
    const recentActivities = await ActivityLog.find()
      .populate("user_id", "fullName avatar")
      .sort({ created_at: -1 })
      .limit(10);

    const stats = {
      users: totalUsers,
      questions: totalQuestions,
      answers: totalAnswers,
      constituencyPredictions: totalConstituencyPredictions,
      cmPredictions: totalCMPredictions,
      activityLogs: totalActivityLogs,
      topUsers,
      recentActivities
    };

    return res
      .status(200)
      .json(new ApiResponse(200, stats, "Dashboard statistics fetched successfully"));
  } catch (error) {
    throw new ApiError(500, "Error fetching dashboard stats");
  }
});

export { getDashboardStats };
