import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { getLLM, getEmbeddings } from "./LLm.js";

export async function answerQuestion(question, source, lang, onToken) {
  if (!question?.trim()) throw new Error("Missing question");
  const llm = getLLM();
  const embeddings = getEmbeddings();

  const client = new ChromaClient({ host: process.env.CHROMA_URL });
  const store = new Chroma(embeddings, {
    client,
    collectionName: process.env.CHROMA_COLLECTION,
    embeddingFunction: embeddings,
  });

  const makeRetriever = (filter) =>
    store.asRetriever({
      k: 3,
      searchType: "similarity",
      filter,
    });

  const scopedRetriever = makeRetriever(source ? { source } : undefined);
  const globalRetriever = makeRetriever(undefined);

  let docs = await scopedRetriever.invoke(question);

  if (!docs?.length && source) {
    docs = await globalRetriever.invoke(question);
  }

  const context = docs
    .map(
      (d, i) =>
        `[#${i + 1}] (${d.metadata.source}) p.${d.metadata.page ?? "?"}\n${d.pageContent}`
    )
    .join("\n\n");

  const prompt = `
You are a strict document-based RAG assistant.

Goal: Answer the QUESTION using ONLY the CONTEXT.

Rules:
- Use only facts explicitly stated in CONTEXT.
- You may combine multiple excerpts if they describe the same fact.
- Do not use outside knowledge or assumptions.
- Do not infer, speculate, or suggest implications.
- Do not mention "document", "context", or "source" in the answer.
- If CONTEXT lacks the information needed, respond EXACTLY with:
  "The documents do not provide enough information to answer this question."

Answer format:
- Provide a clear, concise response in ${lang || "fr"}.
- Prefer paragraphs or bullet points.
- Support each statement with citations in the form [#] matching the CONTEXT ids.
- If you cannot fully answer, output only the exact fallback sentence and nothing else.


CONTEXT:
${context}

QUESTION:
${question}
`.trim();

  if (onToken) {
    const stream = await llm.stream(prompt);
    let fullText = "";
    for await (const chunk of stream) {
      fullText += chunk.content;
      onToken(chunk.content);
    }
    return {
      raw: fullText,
      sources: docs.map((d, i) => ({
        // id: `#${i + 1}`,
        source: d.metadata.source,
        page: d.metadata.page,
      })),
    };
  } else {
    const resp = await llm.invoke(prompt);
    return {
      raw: resp.content,
      sources: docs.map((d, i) => ({
        id: `#${i + 1}`,
        source: d.metadata.source,
        page: d.metadata.page,
      })),
    };
  }
}
