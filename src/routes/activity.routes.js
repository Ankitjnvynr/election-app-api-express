import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createActivityLog, getPaginatedActivityLogs } from "../controllers/activityLog.controller.js";


const router = Router();

router.route("/create").post(verifyJWT, createActivityLog);
router.route("/logs").get(verifyJWT, getPaginatedActivityLogs);




export default router