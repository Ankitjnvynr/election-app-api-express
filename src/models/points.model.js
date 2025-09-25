import mongoose, { Schema } from "mongoose";

const pointsSchema = new Schema({
    welcome_bonus: { type: Number },
    referral_bonus: { type: Number },
    daily_login_bonus: { type: Number },
    vote_cast: { type: Number },
    vote_lock: { type:Number },
    arena_entry_cost:{ type: Number  },
    quiz_correct_answer: { type: Number },
    quiz_wrong_answer: { type: Number },
    cm_prediction_bonus: { type: Number },
    cm_prediction_lock: { type: Number },
}, { timestamps: true });

export const Points = mongoose.model("Points", pointsSchema);