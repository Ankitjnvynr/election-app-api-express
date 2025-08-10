import mongoose, { Schema } from "mongoose";

const answerSchema = new Schema(
  {
    question_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    selected_option_index: {
      type: Number,
      required: true,
    },
    is_correct: {
      type: Boolean,
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt fields
  }
);

// ✅ Ensure a user can only answer the same question once
answerSchema.index({ user_id: 1, question_id: 1 }, { unique: true });

// ✅ Optionally, you can add more indexes for faster queries
answerSchema.index({ question_id: 1 });
answerSchema.index({ user_id: 1 });

export const Answer = mongoose.model("Answer", answerSchema);
