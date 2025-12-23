import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

export async function loadPdf(pdfPath, meta = {}) {
  const loader = new PDFLoader(pdfPath);
  const docs = await loader.load();

  return docs.map(d => ({
    ...d,
    metadata: { ...d.metadata, ...meta }
  }));
}
