import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function handlePaymentVerify(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey || !paystackSecretKey) {
    return new Response(JSON.stringify({ error: "Server configuration missing" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { reference?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const reference = body.reference?.trim();
  if (!reference) {
    return new Response(JSON.stringify({ error: "Reference is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Query Paystack directly to verify reference
  let paystackData: any;
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
    });
    paystackData = await res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Paystack network failure";
    return new Response(JSON.stringify({ error: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!paystackData || !paystackData.status || paystackData.data?.status !== "success") {
    return new Response(JSON.stringify({
      verified: false,
      status: paystackData?.data?.status || "unverified",
      message: paystackData?.message || "Payment not yet successful",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Paystack says charge succeeded: activate in database
  const { data: activated, error: activateErr } = await supabaseAdmin.rpc("activate_payment", {
    p_reference: reference,
  });

  if (activateErr) {
    // If activate_payment failed, check if already active
    const { data: payRow } = await supabaseAdmin
      .from("payments")
      .select("user_id, status")
      .eq("reference", reference)
      .maybeSingle();

    if (payRow?.user_id) {
      await supabaseAdmin.from("payments").update({ status: "success", verified_at: new Date().toISOString() }).eq("reference", reference);
      await supabaseAdmin.from("profiles").update({ is_active: true }).eq("id", payRow.user_id);
    }
  }

  return new Response(JSON.stringify({
    verified: true,
    activated: true,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

if (typeof Deno !== "undefined" && typeof Deno?.serve === "function") {
  Deno.serve(handlePaymentVerify);
}
