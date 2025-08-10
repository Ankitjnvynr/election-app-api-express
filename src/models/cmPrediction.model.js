import mongoose, { Schema } from "mongoose";

const cmPredictionSchema = new Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    predicted_cm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CMList",
      required: true,
    },
    is_locked: {    
      type: Boolean,
      default: false,
    },
    prediction_date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Unique constraint: One prediction per user per state
cmPredictionSchema.index({ user_id: 1, state: 1 }, { unique: true });

export const CMPrediction = mongoose.model("CMPrediction", cmPredictionSchema);
