import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );

  const unsignedToken = `${header}.${payload}`;
  const pemContents = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publication_id, title, author, category } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: "Missing title" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all device tokens with their user_ids
    const { data: tokens, error: tokensError } = await supabase
      .from("device_tokens")
      .select("token, user_id");

    if (tokensError) {
      throw new Error(`Error fetching tokens: ${tokensError.message}`);
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No devices registered", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get notification preferences for users who have explicitly disabled this category
    const userIds = [...new Set(tokens.map((t) => t.user_id))];
    const { data: disabledPrefs } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("category", category || "")
      .eq("enabled", false)
      .in("user_id", userIds);

    const disabledUserIds = new Set(
      (disabledPrefs || []).map((p) => p.user_id)
    );

    // Filter tokens: only send to users who haven't disabled this category
    const eligibleTokens = tokens.filter(
      (t) => !disabledUserIds.has(t.user_id)
    );

    if (eligibleTokens.length === 0) {
      return new Response(
        JSON.stringify({
          message: "No eligible devices for this category",
          sent: 0,
          filtered: tokens.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the service account JSON
    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      throw new Error("FCM_SERVICE_ACCOUNT_JSON secret not configured");
    }

    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    const categoryLabels: Record<string, string> = {
      livre: "Livre",
      memoire: "Mémoire",
      tfc: "TFC",
      article: "Article",
    };

    const categoryLabel = categoryLabels[category] || category;

    let sent = 0;
    let failed = 0;
    const failedTokens: string[] = [];

    for (const { token } of eligibleTokens) {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: {
                  title: `📚 Nouveau ${categoryLabel}`,
                  body: `"${title}" par ${author} est maintenant disponible !`,
                },
                data: {
                  publication_id: publication_id || "",
                  category: category || "",
                  click_action: "OPEN_PUBLICATION",
                },
                android: {
                  priority: "high",
                  notification: {
                    channel_id: "new_publications",
                    icon: "ic_notification",
                    color: "#D4AF37",
                  },
                },
              },
            }),
          }
        );

        if (res.ok) {
          sent++;
        } else {
          const errData = await res.json();
          console.error(
            `FCM error for token ${token.slice(0, 10)}...:`,
            errData
          );
          failed++;
          if (
            errData?.error?.details?.some(
              (d: any) =>
                d.errorCode === "UNREGISTERED" ||
                d.errorCode === "INVALID_ARGUMENT"
            )
          ) {
            failedTokens.push(token);
          }
        }
      } catch (e) {
        console.error(`Error sending to token:`, e);
        failed++;
      }
    }

    // Clean up invalid tokens
    if (failedTokens.length > 0) {
      await supabase
        .from("device_tokens")
        .delete()
        .in("token", failedTokens);
      console.log(`Cleaned up ${failedTokens.length} invalid tokens`);
    }

    return new Response(
      JSON.stringify({
        sent,
        failed,
        cleaned: failedTokens.length,
        filtered: tokens.length - eligibleTokens.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
