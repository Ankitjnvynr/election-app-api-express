import { CMList } from "../models/cmList.model.js";
import { CMPrediction } from "../models/cmPrediction.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandlers.js";

// ✅ Create a new CM entry
const createCM = asyncHandler(async (req, res) => {
  const { name, party, state, term_start, term_end, is_current, age, gender, image_url } = req.body;

  const cm = await CMList.create({
    name,
    party,
    state,
    term_start,
    term_end,
    is_current,
    age,
    gender,
    image_url,
  });

  return res.status(201).json(new ApiResponse(201, cm, "CM added successfully"));
});

// ✅ Update CM
const updateCM = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const updated = await CMList.findByIdAndUpdate(id, updates, { new: true });
  if (!updated) throw new ApiError(404, "CM not found");

  return res.status(200).json(new ApiResponse(200, updated, "CM updated successfully"));
});

// ✅ Delete CM
const deleteCM = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await CMList.findByIdAndDelete(id);
  if (!deleted) throw new ApiError(404, "CM not found");

  return res.status(200).json(new ApiResponse(200, {}, "CM deleted successfully"));
});

// ✅ Get CM List with user prediction info
const getCMListWithPredictionStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const cmList = await CMList.aggregate([
    {
      $lookup: {
        from: "cmpredictions",
        let: { cmState: "$state" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$user_id", userId] },
                  { $eq: ["$state", "$$cmState"] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "user_prediction"
      }
    },
    {
      $addFields: {
        is_predicted_by_user: { $gt: [{ $size: "$user_prediction" }, 0] },
        is_prediction_locked: {
          $cond: [
            { $gt: [{ $size: "$user_prediction" }, 0] },
            { $arrayElemAt: ["$user_prediction.is_locked", 0] },
            false
          ]
        },
        predicted_name: {
          $cond: [
            { $gt: [{ $size: "$user_prediction" }, 0] },
            { $arrayElemAt: ["$user_prediction.predicted_name", 0] },
            null
          ]
        },
        predicted_party: {
          $cond: [
            { $gt: [{ $size: "$user_prediction" }, 0] },
            { $arrayElemAt: ["$user_prediction.predicted_party", 0] },
            null
          ]
        }
      }
    },
    {
      $project: {
        user_prediction: 0
      }
    }
  ]);

  return res.status(200).json(new ApiResponse(200, cmList, "CM list fetched successfully"));
});

// ✅ Create or Update Prediction
const createOrUpdatePrediction = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { state, cm_id , is_locked } = req.body;

  if (!state || !cm_id) {
    throw new ApiError(400, "State and CM ID are required");
  }

  // Check if CM exists
  const cm = await CMList.findById(cm_id);
  if (!cm) {
    throw new ApiError(404, "CM not found");
  }

  const existing = await CMPrediction.findOne({ user_id: userId, state });

  if (existing) {
    if (existing.is_locked) {
      throw new ApiError(402, "Prediction is locked and cannot be changed");
    }

    existing.predicted_cm = cm_id;
    existing.prediction_date = new Date();
    existing.is_locked = is_locked? is_locked : existing.is_locked;

    await existing.save();

    return res
      .status(200)
      .json(new ApiResponse(200, existing, "Prediction updated successfully"));
  }

  // Create new prediction
  const prediction = await CMPrediction.create({
    user_id: userId,
    state,
    predicted_cm: cm_id,
    prediction_date: new Date(),
  });

  return res
    .status(201)
    .json(new ApiResponse(201, prediction, "Prediction created successfully"));
});


// ✅ Get CM list with number of user predictions per CM (admin view)
const getCMListWithPredictionCounts = asyncHandler(async (req, res) => {
  const cmList = await CMList.aggregate([
    {
      $lookup: {
        from: "cmpredictions",
        localField: "name",
        foreignField: "predicted_name",
        as: "predictions"
      }
    },
    {
      $addFields: {
        total_predictions: { $size: "$predictions" }
      }
    },
    {
      $project: {
        name: 1,
        party: 1,
        state: 1,
        term_start: 1,
        term_end: 1,
        is_current: 1,
        age: 1,
        gender: 1,
        image_url: 1,
        createdAt: 1,
        total_predictions: 1
      }
    }
  ]);

  return res.status(200).json(
    new ApiResponse(200, cmList, "CM list with prediction counts fetched successfully")
  );
});


export {
  createCM,
  updateCM,
  deleteCM,
  getCMListWithPredictionStatus,
  createOrUpdatePrediction,
  getCMListWithPredictionCounts
};
