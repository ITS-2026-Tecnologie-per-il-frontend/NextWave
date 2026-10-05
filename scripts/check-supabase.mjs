import { createClient } from "@supabase/supabase-js";
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key)
  throw new Error("Configura .env.local con URL e chiave pubblica Supabase.");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await client
  .from("genres")
  .select("name, display_order")
  .order("display_order");
if (error) throw new Error(`Generi: ${error.message}`);
if (data.length !== 15)
  throw new Error(`Attesi 15 generi, ricevuti ${data.length}.`);
console.log("OK remoto: 15 generi disponibili.");
for (const table of ["profiles", "user_preferences", "artist_applications"]) {
  const result = await client.from(table).select("*").limit(1);
  if (!result.error && result.data?.length)
    throw new Error(`Dati privati leggibili senza login: ${table}.`);
  if (!result.error)
    throw new Error(`La tabella ${table} dovrebbe negare l’accesso anonimo.`);
  console.log(`OK remoto: ${table} nega l’accesso anonimo.`);
}
const dashboard = await client.rpc("get_dashboard");
if (!dashboard.error || !["42501", "PGRST301"].includes(dashboard.error.code))
  throw new Error(
    `RPC: risposta inattesa ${dashboard.error?.code || "accesso consentito"}.`,
  );
console.log(
  "OK remoto: get_dashboard presente e protetto, login richiesto. Nessun dato scritto.",
);
