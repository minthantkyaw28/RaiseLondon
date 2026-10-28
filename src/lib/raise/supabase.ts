import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL ?? "";
// Lovable Cloud names the public key VITE_SUPABASE_PUBLISHABLE_KEY; older setups used ANON_KEY.
const key =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
