import mongoose,{Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoPostSchema = new Schema({
    title:{
        type:String,
        required:[true,"Video Title is required"],
        trim:true,
    },
    description:{
        type:String,
        required:true,
        trim:true,
    },
    videoLink:{
        type:String,
        required:true,
    },
    thumbnail:{
        type:String,
        required:true,
    },
    duration:{
        type:Number,
        required:true,
    },
    views:{
        type:Number,
        default:0
    },
    isPublished:{
        type:Boolean,
        default:true
    },
    owner:{
        type:Schema.Types.ObjectId,
        ref:'User'
    }
    

},{timestamps:true})

videoPostSchema.plugin(mongooseAggregatePaginate);


export const VideoPost = mongoose.model("VideoPost",videoPostSchema)