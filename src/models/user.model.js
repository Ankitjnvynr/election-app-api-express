import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mongoosePaginate from "mongoose-paginate-v2";


const userSchema = Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true
        },
        google_id: {
            type: String,
            default: null,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        fullName: {
            type: String,
            required: true,
            index: true,
            trim: true
        },
        role: {
            type: String,
            default: "user",
            required: true
        }
        ,
        avatar: {
            type: String,
        },
        points: {
            type: Number,
            default: 0,
        },
        password: {
            type: String,
            default: null,
        },
        isVerified: {
            type: Boolean,
            default: false
        },
        refreshToken: {
            type: String,
            default: null,
        },
        phone:{
            type:String,
            trim:true,
            default: null,
        },
        dob:{
            type:Date,
            default: null,

        },
        voterId:{
            type:String,
            trim:true,
            default: null,
        },
        country:{
            type:String,
            trim:true,
            default: null,
        },
        state:{
            type:String,
            trim:true,
            default: null,
        },
        district:{
            type:String,
            trim:true,
            default: null,
        },
        city:{
            type:String,
            trim:true,
            default: null,
        },
        address:{
            type:String,
            trim:true,
            default: null,
        }
    },
    {
        timestamps: true,
    }
)

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateAccessToken = await function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = await function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}



userSchema.plugin(mongoosePaginate);

export const User = mongoose.model("User", userSchema);
