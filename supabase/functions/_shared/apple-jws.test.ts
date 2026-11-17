// deno test --allow-net=registry.npmjs.org supabase/functions/_shared/apple-jws.test.ts
// Chaîne de certificats fabriquée pour le test (racine → intermédiaire → feuille), même forme
// que celle d'Apple : vérifie la chaîne, la signature, et les refus.
import * as x509 from "npm:@peculiar/x509@1.12.3";
import { appleAccountToken, verifyAppleJws } from "./apple-jws.ts";

const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" };
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

async function chain() {
  const rootKeys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
  const interKeys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
  const leafKeys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);
  const notBefore = new Date(Date.now() - 86400000), notAfter = new Date(Date.now() + 86400000);
  const root = await x509.X509CertificateGenerator.createSelfSigned({ serialNumber: "01", name: "CN=Test Root", notBefore, notAfter, keys: rootKeys, signingAlgorithm: alg });
  const inter = await x509.X509CertificateGenerator.create({ serialNumber: "02", subject: "CN=Test Inter", issuer: root.subject, notBefore, notAfter, publicKey: interKeys.publicKey, signingKey: rootKeys.privateKey, signingAlgorithm: alg });
  const leaf = await x509.X509CertificateGenerator.create({ serialNumber: "03", subject: "CN=Test Leaf", issuer: inter.subject, notBefore, notAfter, publicKey: leafKeys.publicKey, signingKey: interKeys.privateKey, signingAlgorithm: alg });
  const der = (c: x509.X509Certificate) => btoa(String.fromCharCode(...new Uint8Array(c.rawData)));
  return { x5c: [der(leaf), der(inter), der(root)], leafKey: leafKeys.privateKey, rootPrint: hex(await crypto.subtle.digest("SHA-256", root.rawData)) };
}

async function sign(payload: unknown, x5c: string[], key: CryptoKey) {
  const enc = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const input = `${enc({ alg: "ES256", x5c })}.${enc(payload)}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input)));
  return `${input}.${b64url(sig)}`;
}

Deno.test("preuve valide acceptée, contenu lu", async () => {
  const c = await chain();
  const jws = await sign({ bundleId: "com.kmgbibliotheque.app", transactionId: "42" }, c.x5c, c.leafKey);
  const p = await verifyAppleJws(jws, { rootFingerprints: [c.rootPrint], checkAppleOids: false });
  assert(p.transactionId === "42" && p.bundleId === "com.kmgbibliotheque.app", "contenu");
});

Deno.test("contenu modifié refusé", async () => {
  const c = await chain();
  const jws = await sign({ transactionId: "42" }, c.x5c, c.leafKey);
  const [h, , s] = jws.split(".");
  const forged = `${h}.${b64url(new TextEncoder().encode(JSON.stringify({ transactionId: "43" })))}.${s}`;
  let refused = false;
  try { await verifyAppleJws(forged, { rootFingerprints: [c.rootPrint], checkAppleOids: false }); } catch { refused = true; }
  assert(refused, "un contenu modifié doit être refusé");
});

Deno.test("racine inconnue refusée (la vraie racine Apple est exigée par défaut)", async () => {
  const c = await chain();
  const jws = await sign({ transactionId: "42" }, c.x5c, c.leafKey);
  let refused = false;
  try { await verifyAppleJws(jws, { checkAppleOids: false }); } catch { refused = true; }
  assert(refused, "racine non Apple acceptée");
});

Deno.test("chaîne dans le désordre refusée", async () => {
  const c = await chain();
  const jws = await sign({ transactionId: "42" }, [c.x5c[1], c.x5c[0], c.x5c[2]], c.leafKey);
  let refused = false;
  try { await verifyAppleJws(jws, { rootFingerprints: [c.rootPrint], checkAppleOids: false }); } catch { refused = true; }
  assert(refused, "chaîne incohérente acceptée");
});

Deno.test("marqueurs Apple exigés par défaut", async () => {
  const c = await chain();
  const jws = await sign({ transactionId: "42" }, c.x5c, c.leafKey);
  let refused = false;
  try { await verifyAppleJws(jws, { rootFingerprints: [c.rootPrint] }); } catch { refused = true; }
  assert(refused, "certificats sans marqueurs Apple acceptés");
});

Deno.test("identifiant de compte : UUID stable", async () => {
  const a = await appleAccountToken("bb0aec35-fb05-4bbd-b150-b6f9c013359d");
  const b = await appleAccountToken("bb0aec35-fb05-4bbd-b150-b6f9c013359d");
  assert(a === b && /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a), "format UUID " + a);
});
