import "dotenv/config";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChromaClient } from "chromadb";
import { loadPdf } from "../repositories/PdfRepository.js";
import { getEmbeddings } from "./LLm.js";

export async function ingestPdf(pdfPath, meta = {}) {
  const docs = await loadPdf(pdfPath, {
    source: meta.originalName || "pdf",
  });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 80,
  });

  const chunks = await splitter.splitDocuments(docs);

  const cleanedChunks = chunks.map((doc) => ({
    pageContent: doc.pageContent,
    metadata: {
      source: meta.originalName ?? "pdf",
      page: doc.metadata?.loc?.pageNumber ?? null,
    },
  }));

  console.log("✂️ Chunks:", cleanedChunks.length);

  const embeddings = getEmbeddings();

  const client = new ChromaClient({ host: process.env.CHROMA_URL });
  await Chroma.fromDocuments(cleanedChunks, embeddings, {
    client,
    collectionName: process.env.CHROMA_COLLECTION,
    embeddingFunction: embeddings,
  });

  console.log("📦 Stored in Chroma");

  return {
    source: meta.originalName,
    chunks: cleanedChunks.length,
  };
}

export async function deletePdf(sourceName) {
  const embeddings = getEmbeddings();
  const client = new ChromaClient({ host: process.env.CHROMA_URL });
  const collection = await client.getCollection({
    name: process.env.CHROMA_COLLECTION,
    embeddingFunction: embeddings,
  });

  await collection.delete({
    where: { source: sourceName }
  });

  return { ok: true, removed: sourceName };
}


