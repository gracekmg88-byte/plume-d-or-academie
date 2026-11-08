// Jeton d'accès Google OAuth2 à partir d'un compte de service (JWT RS256), sans dépendance externe.
// Utilisé pour l'API Google Search Console (remplace le connecteur Lovable).

type ServiceAccount = { client_email: string; private_key: string };

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlJson = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));

const cache = new Map<string, { token: string; exp: number }>();

export function readServiceAccount(envName: string): ServiceAccount {
  const raw = Deno.env.get(envName);
  if (!raw) throw new Error(`${envName} non configuré`);
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) throw new Error(`${envName} invalide`);
  return sa;
}

export async function getGoogleAccessToken(sa: ServiceAccount, scopes: string[]): Promise<string> {
  const key = sa.client_email + "|" + scopes.join(" ");
  const now = Math.floor(Date.now() / 1000);
  const hit = cache.get(key);
  if (hit && hit.exp - 60 > now) return hit.token;

  const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT" })}.${b64urlJson({
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const pem = sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned)));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error(`OAuth Google : ${res.status} ${JSON.stringify(data)}`);
  cache.set(key, { token: data.access_token, exp: now + (data.expires_in ?? 3600) });
  return data.access_token;
}
