import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { getDataConfig } from "../../config/environment.ts";

let client: SupabaseClient | undefined;
export function getSupabase() {
  if (!client) {
    const config = getDataConfig();
    if (config.mode !== "supabase") throw new Error("Supabase non è attivo.");
    client = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
