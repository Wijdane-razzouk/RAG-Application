import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";

export function getLLM() {
  return new ChatOllama({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_MODEL,
    temperature: 0.2,
    numCtx: 4096,
    numPredict: Number(process.env.OLLAMA_NUM_PREDICT || 512),
  });
}

export function getEmbeddings() {
  return new OllamaEmbeddings({
    baseUrl: process.env.OLLAMA_BASE_URL,
    model: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
  });
}
