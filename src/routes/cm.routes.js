import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createCM, createOrUpdatePrediction, deleteCM, getCMListWithPredictionCounts, getCMListWithPredictionStatus, updateCM } from "../controllers/cm.controller.js";



const router = Router();

router.route("/").get(verifyJWT, getCMListWithPredictionCounts);
router.route("/create").post(verifyJWT, createCM);
router.route("/:id").put(verifyJWT, updateCM);
router.route("/:id").delete(verifyJWT, deleteCM);
router.route("/list").get(verifyJWT, getCMListWithPredictionStatus);

// Route to create or update a prediction
router.route("/predict").post(verifyJWT,createOrUpdatePrediction)



export default router;


