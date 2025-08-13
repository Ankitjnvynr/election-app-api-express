import { Router } from "express";
import { changeCurrentPassword, googleLoginUser, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/register").post(
    // upload.fields(
    //     [{
    //         name: "avatar",
    //         maxCount: 1
    //     },]
    // ),
    registerUser
)

router.route("/login").post(loginUser)
router.route("/google").post(googleLoginUser)
router.route("/update-password").post(verifyJWT,changeCurrentPassword)

//secure routes
router.route("/update-profile").post(verifyJWT,updateAccountDetails)
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/refresh-token").post(refreshAccessToken)

export default router
