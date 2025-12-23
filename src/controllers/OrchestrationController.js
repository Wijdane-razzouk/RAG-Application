import { ingestPdf, deletePdf } from "../services/Ingestion.js";
import { answerQuestion } from "../services/ResponseQst.js";
import { generateFlashcards } from "../services/FlachCrad.js";
import { generateQuiz } from "../services/Quiz.js";
import { upload } from "../middleware/DataStorage.js";

// const upload = multer({ dest: "data/uploads/" });

export default class OrchestrationController {
  static uploadMiddleware() {
    return upload.array("pdfs", 3);
  }

  static async upload(req, res) {
    try {
      const results = [];

      for (const file of req.files) {
        results.push(
          await ingestPdf(file.path, { originalName: file.originalname })
        );
      }

      res.json({ ok: true, ingested: results });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  }

  static async ask(req, res) {
    const { question, source, lang } = req.body;

    // Set up SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const result = await answerQuestion(question, source, lang, (token) => {
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      });

      res.write(`data: ${JSON.stringify({ sources: result.sources, done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Ask error:", error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  }



  static async flashcards(req, res) {
    try {
      const { topic, source } = req.body;
      res.json(await generateFlashcards(topic, source));
    } catch (error) {
      console.error("Flashcards error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async quiz(req, res) {
    try {
      const { topic, source } = req.body;
      res.json(await generateQuiz(topic, source));
    } catch (error) {
      console.error("Quiz error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async deleteSource(req, res) {
    try {
      const { source } = req.body;
      if (!source) throw new Error("No source specified");
      const result = await deletePdf(source);
      res.json(result);
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ ok: false, error: error.message });
    }
  }
}
