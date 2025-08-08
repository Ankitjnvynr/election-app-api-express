
import dotenv from 'dotenv'
import { app } from "./app.js";
import connectDB from './db/index.js';

const PORT = process.env.PORT || 8000;

dotenv.config({
    path:'./.env'
})


connectDB()
.then(()=>{
    app.listen(PORT,()=>{
        console.log(`app is running on port: ${PORT}`)
    })

})
.catch((err)=>{
    console.error(`Error connecting to the database: ${err}`);
})
