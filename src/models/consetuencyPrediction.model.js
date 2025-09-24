import mongoose, { Schema } from "mongoose"

const PARTIES = ["BJP", "JDU", "RJD", "INC", "LJP",];

const consetuencyPredictionSchema = new Schema({
    state: {
        type: String,
        required: true
    },
    area: {
        type: String,
        required: true
    },
    constituency: {
        type: String,
        required: true
    },
    voted_party: {
        type: String,
        enum: PARTIES,
        required: true
    },
    isLocked: {
        type: Boolean,
        default: false
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true })

consetuencyPredictionSchema.index({ user_id: 1, constituency: 1 });

export const ConsetuencyPrediction = mongoose.model("ConsetuencyPrediction", consetuencyPredictionSchema);
