import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const questionSchema = new Schema(
    {
        question_text: {
            type: String,
            required: true,
            trim: true,
        },
        options: {
            type: [String], // Array of strings
            required: true,
            validate: {
                validator: function (val) {
                    return val.length >= 2;
                },
                message: 'At least two options are required.'
            }
        },
        correct_option_index: {
            type: Number,
            required: true,
            validate: {
                validator: function (val) {
                    return this.options && val >= 0 && val < this.options.length;
                },
                message: 'Correct option index must be within range of options array.'
            }
        }
    },
    {
        timestamps: true,
    }
);

questionSchema.plugin(mongooseAggregatePaginate);
export const Question = mongoose.model("Question", questionSchema);
