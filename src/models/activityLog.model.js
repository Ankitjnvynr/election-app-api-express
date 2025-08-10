import mongoose, { Schema } from "mongoose";

const activityLogSchema = new Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: String,
      default: null,
    },
    points_earned: {
      type: Number,
      default: 0,
    },
    points_spent: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// Optional indexes for performance
activityLogSchema.index({ user_id: 1, created_at: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
