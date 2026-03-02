/**
 * Compress an image file using canvas.
 * Returns a new File with reduced size (WebP or JPEG).
 */
export async function compressImage(
  file: File,
  options: { maxWidth?: number; maxHeight?: number; quality?: number } = {}
): Promise<File> {
  const { maxWidth = 800, maxHeight = 1200, quality = 0.75 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if necessary
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fallback to JPEG
      const mimeType = "image/webp";
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          const ext = mimeType === "image/webp" ? "webp" : "jpg";
          const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
          resolve(new File([blob], name, { type: mimeType }));
        },
        mimeType,
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
