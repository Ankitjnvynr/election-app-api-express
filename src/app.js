import express from 'express'
import cors from "cors"
import cookieParser from 'cookie-parser'

const app = express()

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

app.use(express.json({limit:"16kb"}))
app.use(express.static("public"))

app.use(cookieParser())

//routes 
import userRouter from "./routes/user.routes.js"
import videoPostRouter from "./routes/videoPost.routes.js"
import questionRouter from "./routes/question.routes.js"
import answerRouter from "./routes/answer.routes.js"

//declare routes
app.use("/api/v1/users",userRouter)

// app.use("/api/v1/video-posts",videoPostRouter)
app.use("/api/v1/questions",questionRouter)
app.use("/api/v1/answer",answerRouter)

export {cors,app}