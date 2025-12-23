import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { getEmbeddings, getLLM } from "./LLm.js";
import { extractJson } from "../utils/JsonHelper.js";

export async function generateFlashcards(topic = "key concepts", source = null) {
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
  const docs = await store.asRetriever({ k: 6, filter }).invoke(topic);

  const context = docs.map((d) => d.pageContent).join("\n\n");

  const prompt = `
Generate exactly 5 high-quality study flashcards from the text.
Cible les concepts clés, les définitions techniques et les relations complexes.
Do NOT limit yourself to one card per document; explore the context deeply.
Return ONLY raw JSON array. NO MARKDOWN. NO COMMENTS.

Format:
[
  {"question": "Question 1...", "answer": "Answer 1..."},
  {"question": "Question 2...", "answer": "Answer 2..."},
  {"question": "Question 3...", "answer": "Answer 3..."}
]

CONTEXT:
${context}
`.trim();

  const resp = await llm.invoke(prompt);
  const rawCards = extractJson(resp.content) || [];

  // Normalize and flatten keys
  return rawCards.map(c => {
    const qRaw = c.question || c.q || c.Question || c.question_text || "";
    const aRaw = c.answer || c.a || c.Answer || c.response || c.réponse || "";

    const flatten = (val) => {
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.map(v => flatten(v)).join(", ");
      if (typeof val === 'object' && val !== null) {
        return Object.entries(val).map(([k, v]) => `${k}: ${flatten(v)}`).join(" | ");
      }
      return String(val);
    };

    return { question: flatten(qRaw), answer: flatten(aRaw) };
  }).filter(c => c.question && c.answer);
}
