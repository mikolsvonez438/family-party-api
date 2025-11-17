// api/generate.js
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { host_secret, family_code } = req.body || {};
  if (!host_secret || !family_code)
    return res
      .status(400)
      .json({ error: "Missing host_secret or family_code" });

  const HOST_SECRET = process.env.HOST_SECRET; // set on Vercel
  if (host_secret !== HOST_SECRET)
    return res.status(403).json({ error: "Invalid host secret" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Missing supabase config" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase.rpc(
      "generate_assignments_for_family",
      { in_family_code: family_code }
    );
    if (error) {
      console.error("RPC error:", error);
      return res
        .status(500)
        .json({ error: "Generation failed", detail: error.message });
    }
    return res.status(200).json({ message: data || "generated" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
