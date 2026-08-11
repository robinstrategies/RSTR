import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ScorePayload = {
  username?: unknown;
  score?: unknown;
  wave?: unknown;
  winner?: unknown;
  duration_seconds?: unknown;
  user_agent?: unknown;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload: ScorePayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const username = String(payload.username || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 18);
  const score = Number(payload.score);
  const wave = Number(payload.wave);
  const winner = Boolean(payload.winner);
  const durationSeconds = Number(payload.duration_seconds);
  const userAgent = String(payload.user_agent || request.headers.get("user-agent") || "").slice(0, 180);

  if (!/^[A-Za-z0-9 _.-]{1,18}$/.test(username)) {
    return json({ error: "Invalid username" }, 400);
  }

  if (!Number.isInteger(score) || score < 0 || score > 100000) {
    return json({ error: "Invalid score" }, 400);
  }

  if (!Number.isInteger(wave) || wave < 1 || wave > 5) {
    return json({ error: "Invalid wave" }, 400);
  }

  if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 7200) {
    return json({ error: "Invalid duration" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Score service is not configured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase
    .from("robin_fight_scores")
    .insert({
      username,
      score,
      wave,
      winner,
      duration_seconds: durationSeconds,
      user_agent: userAgent
    })
    .select("username,score,wave,winner,duration_seconds,created_at")
    .single();

  if (error) {
    return json({ error: "Could not save score" }, 500);
  }

  return json({ score: data }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
