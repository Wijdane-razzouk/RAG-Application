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

Your task is to answer the QUESTION by:
- Searching the CONTEXT for relevant information.
- Combining information that may be distributed across multiple parts of the documents.
- Synthesizing the answer ONLY from the provided CONTEXT.

STRICT RULES:
- Use ONLY the information present in the CONTEXT.
- You MAY combine multiple excerpts if they clearly refer to the same concept.
- Do NOT use external knowledge.
- Do NOT guess missing information.
- If the CONTEXT does not contain enough information to build a reliable answer, respond EXACTLY with:
  "The documents do not provide enough information to answer this question."

ANSWER GUIDELINES:
- Write a clear, synthesized explanation.
- Prefer structured answers (paragraphs or bullet points).
- Each statement MUST be supported by the CONTEXT.

Language: ${lang || 'fr'}.

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
        id: `#${i + 1}`,
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
