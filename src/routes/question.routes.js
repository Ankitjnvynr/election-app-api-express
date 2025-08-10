import { Router } from "express";
import { createQuestion, deleteQuestion, getPaginatedRandomQuestions, updateQuestion } from "../controllers/question.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Route to create a new question
router.route("/create").post(verifyJWT, createQuestion);
router.route("/").get(verifyJWT, getPaginatedRandomQuestions);
router.route("/:id").put(verifyJWT,updateQuestion)
router.route("/:id").delete(verifyJWT,deleteQuestion)

export default router;