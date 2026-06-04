import { PDFDocument } from "pdf-lib";

/**
 * Re-saves a PDF with object streams enabled to reduce file size
 * and improve streaming/load performance. Falls back to the original
 * file if optimization fails or doesn't help.
 */
export async function optimizePdf(file: File): Promise<File> {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
    const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false });
    // Only keep the optimized version if it's actually smaller
    if (bytes.byteLength < buf.byteLength * 0.98) {
      return new File([bytes], file.name, { type: "application/pdf", lastModified: Date.now() });
    }
    return file;
  } catch (err) {
    console.warn("PDF optimization failed, uploading original:", err);
    return file;
  }
}
