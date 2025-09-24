import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
    submitPrediction,
    lockPrediction,
    getMyPredictions,
    getConstituencyStats,
    getStateStats,
    deletePrediction
} from "../controllers/consetuencyPrediction.controller.js";

const router = Router();

// ✅ Create or update a prediction
router.route("/submit").post(verifyJWT, submitPrediction);

// ✅ Lock a prediction
router.route("/lock/:id").patch(verifyJWT, lockPrediction);

// ✅ Get my predictions
router.route("/my").get(verifyJWT, getMyPredictions);

// ✅ Get constituency stats
router.route("/stats/constituency/:constituency").get(verifyJWT, getConstituencyStats);

// ✅ Get state stats
router.route("/stats/state/:state").get(verifyJWT, getStateStats);

// ✅ Delete prediction
router.route("/delete/:id").delete(verifyJWT, deletePrediction);

export default router;
