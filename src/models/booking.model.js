import mongoose,{Schema} from "mongoose";

const bookingSchema = new Schema({
    puja:{
        type:Schema.Types.ObjectId,
        ref:"Puja"
    },
    bookedBy:{
        type:Schema.Types.ObjectId,
        ref:"User"
    },
    time:{
        type:Date,
        required:true
    }
},{timestamps:true})

export const Booking = mongoose.model("Booking",bookingSchema)