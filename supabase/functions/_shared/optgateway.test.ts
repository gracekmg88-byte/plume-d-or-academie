import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { verifyOptSignature, optAmount, sanitizeOpt } from "./optgateway.ts";

async function sign(secret: string, t: number, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const secret = "whsec_test_123";
const body = '{"id":"evt_1","type":"checkout.session.completed","data":{"reference":"KMG-1"}}';

Deno.test("signature valide et récente", async () => {
  const t = Math.floor(Date.now() / 1000);
  assertEquals(await verifyOptSignature(body, `t=${t},v1=${await sign(secret, t, body)}`, secret), true);
});
Deno.test("signature falsifiée", async () => {
  const t = Math.floor(Date.now() / 1000);
  assertEquals(await verifyOptSignature(body, `t=${t},v1=${"0".repeat(64)}`, secret), false);
});
Deno.test("message de plus de 5 minutes refusé", async () => {
  const t = Math.floor(Date.now() / 1000) - 400;
  assertEquals(await verifyOptSignature(body, `t=${t},v1=${await sign(secret, t, body)}`, secret), false);
});
Deno.test("mauvais secret refusé", async () => {
  const t = Math.floor(Date.now() / 1000);
  assertEquals(await verifyOptSignature(body, `t=${t},v1=${await sign("whsec_autre", t, body)}`, secret), false);
});
Deno.test("corps modifié refusé", async () => {
  const t = Math.floor(Date.now() / 1000);
  assertEquals(await verifyOptSignature(body.replace("KMG-1", "KMG-2"), `t=${t},v1=${await sign(secret, t, body)}`, secret), false);
});
Deno.test("en-tête absent ou secret vide", async () => {
  assertEquals(await verifyOptSignature(body, null, secret), false);
  assertEquals(await verifyOptSignature(body, "t=1,v1=ab", ""), false);
});
Deno.test("montants au format OPTGateway", () => {
  assertEquals(optAmount(3, "USD"), "3.00");
  assertEquals(optAmount(30, "USD"), "30.00");
  assertEquals(optAmount(150000.4, "CDF"), "150000");
});
Deno.test("données conservées sans champ inattendu (pas de carte)", () => {
  assertEquals(sanitizeOpt({ id: "cs_1", status: "completed", card_number: "4111111111111111", pan: "x" }), { id: "cs_1", status: "completed" });
});
