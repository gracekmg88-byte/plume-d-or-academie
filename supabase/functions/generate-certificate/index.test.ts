// Tests Deno pour la génération du PDF de certificat.
// Vérifie la robustesse de l'encodage Unicode (accents, emojis, CJK, symboles)
// et empêche les régressions du WinAnsi.
import { assert, assertEquals, assertGreater } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCertificatePdf, pickTemplate, categoryLabel } from "./pdf.ts";

// QR PNG minimal valide (1x1) — évite un appel réseau pour les tests unitaires.
const MIN_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

function baseInput(overrides: Partial<Parameters<typeof buildCertificatePdf>[0]> = {}) {
  return {
    template: "standard" as const,
    title: "Titre par défaut",
    author: "Auteur Test",
    category: "article",
    publicationDate: "2026-01-15T10:00:00.000Z",
    certificateNumber: "CERT-2026-001",
    publicationNumber: "KMG-ART-2026-001",
    verificationUrl: "https://www.kmgbibliotheque.com/publication/KMG-ART-2026-001",
    qrBytes: MIN_PNG,
    ...overrides,
  };
}

function assertValidPdf(bytes: Uint8Array, minSize = 1500) {
  assert(bytes instanceof Uint8Array, "Le PDF doit être un Uint8Array");
  assertGreater(bytes.length, minSize, "Le PDF est trop petit");
  const head = new TextDecoder().decode(bytes.slice(0, 5));
  assertEquals(head, "%PDF-", "L'entête du PDF doit être %PDF-");
}

Deno.test("pickTemplate mappe correctement les catégories", () => {
  assertEquals(pickTemplate("livre"), "premium");
  assertEquals(pickTemplate("LIVRE"), "premium");
  assertEquals(pickTemplate("memoire"), "academique");
  assertEquals(pickTemplate("tfc"), "academique");
  assertEquals(pickTemplate("article"), "standard");
  assertEquals(pickTemplate("autre"), "standard");
});

Deno.test("categoryLabel gère les valeurs avec accents", () => {
  assertEquals(categoryLabel("memoire"), "MÉMOIRE");
  assertEquals(categoryLabel("livre"), "LIVRE");
});

Deno.test("PDF — caractères ASCII basiques", async () => {
  const pdf = await buildCertificatePdf(baseInput());
  assertValidPdf(pdf);
});

Deno.test("PDF — accents français complexes (à, é, è, ç, ï, ô, ù, œ, æ)", async () => {
  const pdf = await buildCertificatePdf(baseInput({
    title: "Étude éthnographique sur l'œuvre cœur — à découvrir!",
    author: "François-Xavier de l'Hôpital",
    category: "memoire",
    template: "academique",
  }));
  assertValidPdf(pdf);
});

Deno.test("PDF — guillemets et ponctuation typographiques (« » … – —)", async () => {
  const pdf = await buildCertificatePdf(baseInput({
    title: "« Le savoir : une œuvre — collective » … et plurielle",
    author: "Dr. Jean-Luc — éditeur",
  }));
  assertValidPdf(pdf);
});

Deno.test("PDF — symboles spéciaux (★ ✦ • § © ®)", async () => {
  const pdf = await buildCertificatePdf(baseInput({
    title: "★ Édition spéciale § Recherche · ©2026",
    author: "Comité ® scientifique",
  }));
  assertValidPdf(pdf);
});

Deno.test("PDF — emojis (✅ 📚 🔖) — ne doivent plus jeter d'erreur WinAnsi", async () => {
  // Régression : avant DejaVu/fontkit, "★" levait WinAnsi cannot encode "★" (0x2605).
  const pdf = await buildCertificatePdf(baseInput({
    title: "✅ Publication 📚 vérifiée 🔖",
    author: "Auteur ✨",
  }));
  assertValidPdf(pdf);
});

Deno.test("PDF — caractères CJK (chinois, japonais, coréen)", async () => {
  const pdf = await buildCertificatePdf(baseInput({
    title: "学术出版物 — 学術出版 — 학술 출판물",
    author: "李 明 / 田中 太郎 / 김 철수",
  }));
  assertValidPdf(pdf);
});

// (Les scripts RTL — arabe/hébreu — nécessitent un shaper complexe absent de
// DejaVu Sans / fontkit. La plateforme cible le français et l'anglais ;
// ces écritures ne sont pas exigées par le cahier des charges.)

Deno.test("PDF — titre très long est tronqué proprement", async () => {
  const longTitle = "A".repeat(200) + " — fin";
  const pdf = await buildCertificatePdf(baseInput({ title: longTitle }));
  assertValidPdf(pdf);
});

Deno.test("PDF — template premium (livre) avec accents et symboles", async () => {
  const pdf = await buildCertificatePdf(baseInput({
    template: "premium",
    category: "livre",
    title: "L'Œuvre intégrale : « éditions définitives »",
    author: "Mgr André-Étienne Lévêque",
  }));
  assertValidPdf(pdf, 2000);
});

Deno.test("PDF — template académique (mémoire) avec mix Unicode", async () => {
  const pdf = await buildCertificatePdf(baseInput({
    template: "academique",
    category: "memoire",
    title: "Mémoire — La résilience écologique en Afrique 🌍",
    author: "Étudiant·e en sciences",
  }));
  assertValidPdf(pdf);
});
