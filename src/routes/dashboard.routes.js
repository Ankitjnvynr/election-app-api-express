// routes/dashboard.routes.js
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getDashboardStats } from "../controllers/dashboard.controller.js";

const router = Router();

// ✅ Get overall dashboard statistics
router.route("/stats").get(verifyJWT, getDashboardStats);

export default router;
