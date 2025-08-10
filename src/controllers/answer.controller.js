import { Answer } from "../models/answer.model.js";
import { Question } from "../models/question.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandlers.js";

// ✅ Submit or Update an answer
const submitAnswer = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { question_id, selected_option_index } = req.body;

    if (!question_id || selected_option_index == null) {
        throw new ApiError(400, "question_id and selected_option_index are required");
    }

    const question = await Question.findById(question_id);
    if (!question) {
        throw new ApiError(404, "Question not found");
    }

    const is_correct = question.correct_option_index === selected_option_index;

    // Check if answer already exists
    let answer = await Answer.findOne({ user_id: userId, question_id });

    if (answer) {

        // check if the answer is already correct
        if (answer.is_correct) {
            return res.status(200).json(new ApiResponse(200, answer, "Answer already submitted"));
        }

        // Update existing answer
        answer.selected_option_index = selected_option_index;
        answer.is_correct = is_correct;
        await answer.save();
        return res.status(200).json(new ApiResponse(200, answer, "Answer updated successfully"));
    } else {
        // Create new answer
        answer = await Answer.create({
            user_id: userId,
            question_id,
            selected_option_index,
            is_correct
        });
        return res.status(201).json(new ApiResponse(201, answer, "Answer submitted successfully"));
    }
});


// ✅ Update an existing answer (if allowed)
const updateAnswer = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { question_id, selected_option_index } = req.body;

    if (!question_id || selected_option_index == null) {
        throw new ApiError(400, "question_id and selected_option_index are required");
    }

    const question = await Question.findById(question_id);
    if (!question) {
        throw new ApiError(404, "Question not found");
    }

    const is_correct = question.correct_option_index === selected_option_index;

    const answer = await Answer.findOneAndUpdate(
        { user_id: userId, question_id },
        {
            selected_option_index,
            is_correct
        },
        { new: true, runValidators: true }
    );

    if (!answer) {
        throw new ApiError(404, "Answer not found for update");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, answer, "Answer updated successfully"));
});

// ✅ Get all answers by current user
const getMyAnswers = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const answers = await Answer.find({ user_id: userId }).populate("question_id", "question_text options");

    return res
        .status(200)
        .json(new ApiResponse(200, answers, "Answers fetched successfully"));
});

// ✅ Get answer by ID
const getAnswerById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const answer = await Answer.findById(id).populate("question_id", "question_text options");

    if (!answer) {
        throw new ApiError(404, "Answer not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, answer, "Answer fetched successfully"));
});

// ✅ Delete answer by ID (user or admin)
const deleteAnswer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user._id;

    const answer = await Answer.findOneAndDelete({ _id: id, user_id: userId });

    if (!answer) {
        throw new ApiError(404, "Answer not found or not allowed");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Answer deleted successfully"));
});

export {
    submitAnswer,
    updateAnswer,
    getMyAnswers,
    getAnswerById,
    deleteAnswer,
};
