import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createQuestion, deleteQuestion, getPaginatedQuestions, getPaginatedRandomQuestions, updateQuestion } from "../controllers/question.controller.js";

const router = Router();

// Route to create a new question
router.route("/create").post(verifyJWT, createQuestion);
router.route("/").get(verifyJWT, getPaginatedRandomQuestions);
router.route("/all").get(verifyJWT, getPaginatedQuestions);
router.route("/:id").put(verifyJWT,updateQuestion)
router.route("/:id").delete(verifyJWT,deleteQuestion)

export default router;