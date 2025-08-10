import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";

import { submitAnswer, updateAnswer } from "../controllers/answer.controller.js";   

const router = Router();

// Route to submit an answer
router.route("/submit").post(verifyJWT, submitAnswer);
// Route to update an existing answer
router.route("/update").put(verifyJWT, updateAnswer);

export default router;