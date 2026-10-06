import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Configura VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nei file .env locali ignorati da Git. Non condividere la chiave.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = client.storage.from("nextwave-audio");
async function command(action, data = {}) {
  const result = await client.rpc("audio_server", {
    p_action: action,
    p_data: data,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
const [action, applicationId, day] = process.argv.slice(2);
if (action === "upload-demo") {
  const configuration = await client.storage.getBucket("nextwave-audio");
  if (configuration.error || configuration.data.public)
    throw new Error(
      "Il bucket nextwave-audio deve esistere ed essere privato. Applica prima la migrazione SQL.",
    );
  // Passa al percorso cloud soltanto quando tutti i cinque oggetti sono presenti.
  for (let index = 0; index < 5; index++) {
    const file = await readFile(
      new URL(`../tests/fixtures/audio/${index}.wav`, import.meta.url),
    );
    const result = await bucket.upload(`demo/${index}.wav`, file, {
      contentType: "audio/wav",
      upsert: true,
      cacheControl: "0",
    });
    if (result.error)
      throw new Error(`Campione ${index}: ${result.error.message}`);
    const downloaded = await bucket.download(`demo/${index}.wav`);
    if (downloaded.error)
      throw new Error(
        `Verifica campione ${index}: ${downloaded.error.message}`,
      );
    const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
    if (
      digest(file) !== digest(Buffer.from(await downloaded.data.arrayBuffer()))
    )
      throw new Error(
        `Campione ${index}: il contenuto remoto non corrisponde all’originale.`,
      );
    console.log(`Caricato demo/${index}.wav (${file.length} byte).`);
  }
  await command("demo-ready");
  console.log(
    "Cinque audio su Supabase; catalogo cloud aggiornato. Copie locali conservate.",
  );
} else if (action === "list") {
  console.table(await command("review-list"));
} else if (["preview", "approve", "reject"].includes(action)) {
  if (!applicationId || !/^[a-f0-9-]{36}$/i.test(applicationId))
    throw new Error("Indica l’ID della candidatura.");
  if (action === "preview") {
    const item = (await command("review-list")).find(
      (entry) => entry.id === applicationId,
    );
    if (!item) throw new Error("Candidatura non disponibile.");
    const signed = await bucket.createSignedUrl(item.path, 600);
    if (signed.error) throw new Error(signed.error.message);
    console.log(
      `Ascolto privato per revisione (scade in 10 minuti): ${signed.data.signedUrl}`,
    );
  } else {
    if (action === "approve" && !/^\d{4}-\d{2}-\d{2}$/.test(day ?? ""))
      throw new Error(
        "Indica il giorno del contest YYYY-MM-DD: domani o entro 30 giorni.",
      );
    console.log(await command(action, { applicationId, day }));
  }
} else {
  throw new Error(
    "Uso: audio-admin.mjs upload-demo | list | preview ID | approve ID YYYY-MM-DD | reject ID",
  );
}
