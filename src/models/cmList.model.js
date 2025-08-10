import mongoose, { Schema } from "mongoose";

const cmListSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    party: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    term_start: {
      type: Date,
    },
    term_end: {
      type: Date,
    },
    is_current: {
      type: Boolean,
      default: false,
    },
    age: {
      type: Number,
      min: 25, // assuming CM age threshold
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    image_url: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Optional: Index for fast lookups
cmListSchema.index({ state: 1, is_current: 1 });

export const CMList = mongoose.model("CMList", cmListSchema);
