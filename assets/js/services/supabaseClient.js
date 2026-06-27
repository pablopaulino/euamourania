import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, supabaseConfigurado } from "../supabase-config.js";

let client;

export function getSupabase() {
  if (!supabaseConfigurado()) {
    throw new Error("Supabase ainda não configurado. Preencha assets/js/supabase-config.js.");
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return client;
}

export { supabaseConfigurado };
