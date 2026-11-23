import { createClient } from "@supabase/supabase-js";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

declare const Deno:
  | {
      env: {
        get(key: string): string | undefined;
      };
      serve?: (handler: (req: Request) => Promise<Response> | Response) => void;
    }
  | undefined;

function getEnv(key: string): string | undefined {
  if (typeof Deno !== "undefined" && Deno?.env) {
    return Deno.env.get(key);
  }
  return typeof process !== "undefined" ? process.env[key] : undefined;
}

export async function handleUnlockInitialize(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Invalid authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = getEnv("SUPABASE_URL");
  const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey = getEnv("PAYSTACK_SECRET_KEY");
  const appBaseUrl = getEnv("APP_BASE_URL");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !paystackSecretKey || !appBaseUrl) {
    return new Response(JSON.stringify({ error: "Server configuration missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseCaller = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseCaller.auth.getUser(token);

  if (userError || !user || !user.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. Verify eligibility via database RPC
  const { data: eligibility, error: eligError } = await supabaseCaller.rpc(
    "check_unlock_eligibility"
  );

  if (eligError || !eligibility?.eligible) {
    return new Response(
      JSON.stringify({
        error: "Not eligible for self-service unlock",
        reason: eligibility?.reason || "Ineligible",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const amountNgn = Number(eligibility.fee_ngn || 500);
  const amountMinor = amountNgn * 100; // in kobo

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  // 2. Generate unique unlock payment reference
  const userPrefix = user.id.slice(0, 8);
  const reference = `unlock-${userPrefix}-${crypto.randomUUID()}`;

  const { error: insertError } = await supabaseAdmin.from("payments").insert({
    user_id: user.id,
    reference,
    amount_minor: amountMinor,
    currency: "NGN",
    status: "pending",
    purpose: "unlock",
  });

  if (insertError) {
    return new Response(JSON.stringify({ error: "Failed to record unlock transaction" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Initialize with Paystack
  const callbackUrl = `${appBaseUrl.replace(/\/+$/, "")}/locked?ref=${reference}`;
  const paystackPayload = {
    email: user.email,
    amount: amountMinor,
    currency: "NGN",
    reference,
    callback_url: callbackUrl,
    metadata: {
      user_id: user.id,
      purpose: "unlock",
    },
  };

  try {
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();
    if (!paystackRes.ok || !paystackData.status) {
      return new Response(
        JSON.stringify({ error: paystackData.message || "Paystack initialization failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Network error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (typeof Deno !== "undefined" && typeof Deno?.serve === "function") {
  Deno.serve(handleUnlockInitialize);
}
