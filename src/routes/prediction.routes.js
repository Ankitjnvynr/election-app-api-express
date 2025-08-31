import { Router } from "express";
import { 
    createPrediction,
    getUserPrediction,
    addConstituencyPrediction,
    lockConstituencyPrediction,
    updatePrediction,
    deleteConstituencyPrediction,
    deletePrediction,
    getAllPredictions,
    getPredictionById,
    getLeaderboard,
    getAreaAnalytics,
    getUserPredictionProgress,
    bulkAddPredictions,
    getPredictionsByArea,
    resetUnlockedPredictions,
    getConstituencyPrediction,
    getPublicPredictions,
    getPredictionStats,
    submitPrediction
} from "../controllers/constituencyPrediction.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.route("/public").get(getPublicPredictions);
router.route("/leaderboard").get(getLeaderboard);
router.route("/stats").get(getPredictionStats);
router.route("/area/:area/analytics").get(getAreaAnalytics);
router.route("/area/:area/analytics/:electionYear").get(getAreaAnalytics);

// Protected routes (authentication required)
router.use(verifyJWT); // Apply JWT verification to all routes below

// Main prediction management
router.route("/create").post(createPrediction);
router.route("/my-prediction").get(getUserPrediction);
router.route("/progress").get(getUserPredictionProgress);
router.route("/all").get(getAllPredictions);

// Individual prediction operations
router.route("/:predictionId")
    .get(getPredictionById)
    .patch(updatePrediction)
    .delete(deletePrediction);

// Constituency-level operations
router.route("/:predictionId/constituency").post(addConstituencyPrediction);
router.route("/:predictionId/constituency/:constituency")
    .get(getConstituencyPrediction)
    .delete(deleteConstituencyPrediction);

// Lock operations
router.route("/:predictionId/constituency/:constituency/lock").patch(lockConstituencyPrediction);

// Bulk operations
router.route("/:predictionId/bulk").post(bulkAddPredictions);
router.route("/:predictionId/reset-unlocked").patch(resetUnlockedPredictions);

// Area-specific operations
router.route("/:predictionId/area/:area").get(getPredictionsByArea);

// Final submission
router.route("/:predictionId/submit").patch(submitPrediction);

export default router;