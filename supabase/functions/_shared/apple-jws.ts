// @ts-nocheck
// Vérification d'une transaction App Store (StoreKit 2, « jwsRepresentation ») SANS clé d'API :
// le jeton JWS est signé par Apple ; son en-tête « x5c » contient la chaîne de certificats
// feuille → intermédiaire → racine. On vérifie :
//   1. que la racine est bien « Apple Root CA - G3 » (empreinte SHA-256 publiée par Apple) ;
//   2. que chaque certificat est signé par le suivant et en cours de validité ;
//   3. les marqueurs Apple (OID) de la feuille et de l'intermédiaire ;
//   4. la signature ES256 du JWS avec la clé de la feuille.
// Ce n'est qu'ensuite que le contenu (produit, compte, application…) est lu.
import * as x509 from "npm:@peculiar/x509@1.12.3";

// https://www.apple.com/certificateauthority/AppleRootCA-G3.cer (vérifiée le 2026-11-17)
export const APPLE_ROOT_G3_SHA256 = "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179";
const OID_LEAF = "1.2.840.113635.100.6.11.1"; // Mac App Store / App Store receipt signing
const OID_INTERMEDIATE = "1.2.840.113635.100.6.2.1"; // Apple Worldwide Developer Relations

const b64urlToBytes = (s: string) => {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b + "===".slice((b.length + 3) % 4)), (c) => c.charCodeAt(0));
};
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

export class AppleJwsError extends Error {}

export interface AppleJwsOptions {
  /** Empreintes SHA-256 (hex) des racines acceptées. Par défaut : Apple Root CA - G3. */
  rootFingerprints?: string[];
  /** Vérifier les marqueurs Apple (désactivé seulement dans les tests). */
  checkAppleOids?: boolean;
  now?: Date;
}

export async function verifyAppleJws(jws: string, opts: AppleJwsOptions = {}): Promise<Record<string, unknown>> {
  const roots = (opts.rootFingerprints ?? [APPLE_ROOT_G3_SHA256]).map((f) => f.toLowerCase());
  const checkOids = opts.checkAppleOids ?? true;
  const now = opts.now ?? new Date();

  const parts = String(jws ?? "").split(".");
  if (parts.length !== 3) throw new AppleJwsError("Preuve d'achat illisible");
  let header;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
  } catch {
    throw new AppleJwsError("En-tête illisible");
  }
  if (header.alg !== "ES256") throw new AppleJwsError("Algorithme inattendu");
  if (!Array.isArray(header.x5c) || header.x5c.length < 3) throw new AppleJwsError("Chaîne de certificats absente");

  const certs = header.x5c.map((c: string) => new x509.X509Certificate(c));
  const [leaf, intermediate, root] = certs;

  const rootPrint = hex(await crypto.subtle.digest("SHA-256", root.rawData));
  if (!roots.includes(rootPrint)) throw new AppleJwsError("Certificat racine non reconnu");

  for (const c of certs) {
    if (now < c.notBefore || now > c.notAfter) throw new AppleJwsError("Certificat hors de sa période de validité");
  }
  if (!(await leaf.verify({ publicKey: intermediate.publicKey, signatureOnly: true }))) throw new AppleJwsError("Feuille non signée par l'intermédiaire");
  if (!(await intermediate.verify({ publicKey: root.publicKey, signatureOnly: true }))) throw new AppleJwsError("Intermédiaire non signé par la racine");
  if (checkOids) {
    if (!leaf.getExtension(OID_LEAF)) throw new AppleJwsError("Certificat feuille non Apple");
    if (!intermediate.getExtension(OID_INTERMEDIATE)) throw new AppleJwsError("Certificat intermédiaire non Apple");
  }

  const key = await leaf.publicKey.export({ name: "ECDSA", namedCurve: "P-256" }, ["verify"]);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new AppleJwsError("Signature de la preuve d'achat invalide");

  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    throw new AppleJwsError("Contenu illisible");
  }
}

/** Identifiant de compte transmis à Apple lors de l'achat (UUID dérivé du compte KMG). */
export async function appleAccountToken(userId: string): Promise<string> {
  const h = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kmg-premium:${userId}`))).slice(0, 32).split("");
  h[12] = "5";
  h[16] = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
