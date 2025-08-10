import { Question } from "../models/question.model.js";
import { Answer } from "../models/answer.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandlers.js";

// ✅ Create a new question
const createQuestion = asyncHandler(async (req, res) => {
  const { question_text, options, correct_option_index } = req.body;

  if (!question_text || !Array.isArray(options) || options.length < 2 || correct_option_index == null) {
    throw new ApiError(400, "All fields are required: question_text, options (min 2), correct_option_index");
  }

  if (correct_option_index < 0 || correct_option_index >= options.length) {
    throw new ApiError(400, "correct_option_index must be within options range");
  }

  const question = await Question.create({
    question_text,
    options,
    correct_option_index,
  });

  return res.status(201).json(new ApiResponse(201, question, "Question created successfully"));
});



// ✅ Random + paginated questions with is_answered using $lookup sub-pipeline
const getPaginatedRandomQuestions = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const { page = 1, limit = 10 } = req.query;

  const sampleSize = parseInt(limit) * 5;

  const pipeline = [
    { $sample: { size: sampleSize } }, // Get random questions
    {
      $lookup: {
        from: "answers",
        let: { questionId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$question_id", "$$questionId"] },
                  { $eq: ["$user_id", userId] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "user_answer"
      }
    },
    {
      $addFields: {
        is_answered: { $gt: [{ $size: "$user_answer" }, 0] },
        is_correct: {
          $cond: {
            if: { $gt: [{ $size: "$user_answer" }, 0] },
            then: { $arrayElemAt: ["$user_answer.is_correct", 0] },
            else: null
          }
        }
      }
    },
    {
      $project: {
        question_text: 1,
        options: 1,
        correct_option_index: 1,
        createdAt: 1,
        is_answered: 1,
        is_correct: 1
      }
    }
  ];


  const results = await Question.aggregate(pipeline);

  // Manual pagination
  const start = (page - 1) * limit;
  const end = start + parseInt(limit);
  const paginatedQuestions = results.slice(start, end);

  return res.status(200).json(
    new ApiResponse(200, {
      totalQuestions: results.length,
      currentPage: parseInt(page),
      questions: paginatedQuestions
    }, "Random questions fetched with is_answered flag")
  );
});


// ✅ Get a single question by ID
const getQuestionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const question = await Question.findById(id);
  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  return res.status(200).json(new ApiResponse(200, question, "Question fetched successfully"));
});

// ✅ Update a question
const updateQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { question_text, options, correct_option_index } = req.body;

  const updates = {
    ...(question_text && { question_text }),
    ...(options && { options }),
    ...(correct_option_index !== undefined && { correct_option_index }),
  };

  const question = await Question.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: false,
  });

  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  return res.status(200).json(new ApiResponse(200, question, "Question updated successfully"));
});

// ✅ Delete a question
const deleteQuestion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const deleted = await Question.findByIdAndDelete(id);
  if (!deleted) {
    throw new ApiError(404, "Question not found or already deleted");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Question deleted successfully"));
});

export {
  createQuestion,
  getPaginatedRandomQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
};
