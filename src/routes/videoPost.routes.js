import {Router} from "express"
import { createVideoPost, getForAdminVideoPosts, getVideoPosts } from "../controllers/videoPost.controller.js"
import { upload } from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router();

router.route("/create").post(
    verifyJWT,
    upload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 }
    ]),
    createVideoPost
)

router.route("/").get(getVideoPosts)
router.route("/all").get(verifyJWT,getForAdminVideoPosts)

export default router