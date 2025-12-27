import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { getEmbeddings, getLLM } from "./LLm.js";
import { extractJson } from "../utils/JsonHelper.js";
export async function generateQuiz(topic = "main ideas", source = null) {
  const llm = getLLM();
  const embeddings = getEmbeddings();

  const client = new ChromaClient({ host: process.env.CHROMA_URL });
  const store = new Chroma(embeddings, {
    client,
    collectionName: process.env.CHROMA_COLLECTION,
    embeddingFunction: embeddings,
  });

  let filter = undefined;
  if (source) {
    if (Array.isArray(source)) {
      filter = { source: { $in: source } };
    } else {
      filter = { source };
    }
  }
  const docs = await store.asRetriever({ k: 2, filter }).invoke(topic);
  const context = docs.map(d => d.pageContent).join("\n\n");


  const prompt = `
Generate exactly 8 high-quality multiple-choice questions (MCQ).
Ensure they are pedagogically High-Value but keep Questions/Choices PRECISE AND SHORT (Speed Optimization).
Use the same language as the CONTEXT (choose the dominant language if mixed).
Return JSON ONLY.

Rules:
- Output valid JSON with double quotes only.
- No comments, no markdown, no trailing commas.
- Keep each question <= 12 words and each choice <= 8 words.

Format:
[
  {
    "question": "Question text...",
    "choices": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 1
  }
]

CONTEXT:
${context}
`.trim();

  const resp = await llm.invoke(prompt);
  let rawQuiz = extractJson(resp.content) || [];

  if (!Array.isArray(rawQuiz)) {
    rawQuiz = [rawQuiz];
  }

  // Final safety check
  if (rawQuiz.length === 0 || !rawQuiz[0]) return [];

  // Normalize keys
  return rawQuiz.map(q => {
    const question = q.question || q.q || q.question_text || "";
    const choices = q.choices || q.options || q.c || q.answers || [];

    // Support both old and new formats for robustness
    let correctIndex = -1;
    if (q.correctIndex !== undefined) correctIndex = q.correctIndex;
    else if (q.answer_index !== undefined) correctIndex = q.answer_index;

    // Fallback for string answers (attempt to find index)
    const answerStr = q.answer || q.correct_answer || q.correct || q.ans || "";
    if (correctIndex === -1 && answerStr) {
      // Try to find the string in choices
      const idx = choices.findIndex(c => c.trim() === answerStr.trim());
      if (idx !== -1) correctIndex = idx;
      // Try letter 'A' -> 0
      else if (answerStr.length === 1) correctIndex = answerStr.toUpperCase().charCodeAt(0) - 65;
      // If neither, we might have a drift, but we'll try to guess based on content if possible or just fail validation for this q
    }

    return { question, choices, correctIndex, answer: answerStr || choices[correctIndex] };
  }).filter(q => q.question && q.choices.length > 0 && q.correctIndex !== -1);
}
