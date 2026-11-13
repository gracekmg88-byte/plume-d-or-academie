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

      // WebP d'abord. Certains navigateurs (Safari, anciens téléphones) ne savent pas produire du WebP
      // et renvoient alors un PNG non compressé (≈ 2,8 Mo pour 800 × 1200) : dans ce cas on refait la
      // compression en JPEG. Le nom et le type du fichier suivent toujours le format réellement obtenu.
      const finish = (blob: Blob) => {
        const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
        const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
        resolve(new File([blob], name, { type: blob.type || "image/jpeg" }));
      };
      canvas.toBlob(
        (webp) => {
          if (webp && webp.type === "image/webp") { finish(webp); return; }
          canvas.toBlob(
            (jpeg) => {
              if (jpeg) { finish(jpeg); return; }
              if (webp) { finish(webp); return; }
              reject(new Error("Compression failed"));
            },
            "image/jpeg",
            quality,
          );
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
