import { Router } from "express";
import OrchestrationController from "../controllers/OrchestrationController.js";

const router = Router();

router.post("/upload", OrchestrationController.uploadMiddleware(), OrchestrationController.upload);
router.post("/ask", OrchestrationController.ask);
router.post("/flashcards", OrchestrationController.flashcards);
router.post("/quiz", OrchestrationController.quiz);
router.post("/delete-source", OrchestrationController.deleteSource);

export default router;
