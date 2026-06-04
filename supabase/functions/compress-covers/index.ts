import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser, isAdmin, unauthorized, forbidden } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await getAuthUser(req);
    if (!caller) return unauthorized(corsHeaders);
    if (!(await isAdmin(caller.userId))) return forbidden(corsHeaders, "Admin only");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: publications, error } = await supabase
      .from("publications")
      .select("id, cover_image_url")
      .not("cover_image_url", "is", null);

    if (error) throw error;

    const covers = (publications || [])
      .filter((p) => p.cover_image_url)
      .map((p) => ({ id: p.id, url: p.cover_image_url }));

    return new Response(
      JSON.stringify({ covers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
