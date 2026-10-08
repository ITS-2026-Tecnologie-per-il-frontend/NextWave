import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { catalog } from "../../src/data/demo/catalog.ts";
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
function stableId(value) {
  const hex = createHash("sha256")
    .update(`vibepulse-demo:${value}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const artists = catalog.map(
  (track) =>
    `(${quote(stableId("artist:" + track.id))}, ${quote(track.artist)}, ${quote(track.id)}, ${track.listeners}, true)`,
);
const tracks = catalog.map(
  (track) =>
    `(${quote(stableId("track:" + track.id))}, ${quote(stableId("artist:" + track.id))}, ${quote(track.title)}, ${quote(track.genre)}, ${quote(track.mood)}, ${quote(track.lang)}, ${quote("/" + track.audio)}, 12, ${quote(track.id)}, true, true)`,
);
const demo = `-- Catalogo DEMO: artisti inventati, WAV sintetici di 12 secondi. Nessun voto/utente fittizio.\n-- Ripetibile: non sovrascrive brani esistenti o metriche.\ninsert into vp_private.artists(id, name, demo_key, monthly_listeners, is_demo) values\n${artists.join(",\n")}\non conflict (demo_key) do nothing;\ninsert into vp_private.tracks(id, artist_id, title, genre, mood, language, audio_path, duration_seconds, demo_key, active, is_demo) values\n${tracks.join(",\n")}\non conflict (demo_key) do nothing;\n`;
await mkdir("supabase/seeds", { recursive: true });
await writeFile("supabase/seeds/demo.sql", demo);
const files = (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = await Promise.all(
  files.map((file) => readFile(`supabase/migrations/${file}`, "utf8")),
);
const ledger = `create schema if not exists supabase_migrations;\ncreate table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);\n${files
  .map((file) => {
    const [version, ...name] = file.replace(".sql", "").split("_");
    return `insert into supabase_migrations.schema_migrations(version, name) values (${quote(version)}, ${quote(name.join("_"))});`;
  })
  .join("\n")}\n`;
const header =
  "-- Eseguire UNA VOLTA nel SQL Editor del progetto Supabase vuoto.\n-- Migrazioni atomiche e storico CLI: niente reset/drop, niente chiavi segrete.\n";
await mkdir("supabase/generated", { recursive: true });
await writeFile(
  "supabase/generated/setup.sql",
  `${header}begin;\n${sql.join("\n")}\n${ledger}commit;\n`,
);
await writeFile(
  "supabase/generated/setup-demo.sql",
  `${header}-- INCLUDE IL CATALOGO DEMO, non dati di produzione.\nbegin;\n${sql.join("\n")}\n${demo}\n${ledger}commit;\n`,
);
// Aggiornamento dedicato al progetto esistente: non riesegue le vecchie migrazioni.
const audioVersion = "20261006000300";
const audioIndex = files.findIndex((file) => file.startsWith(audioVersion));
if (audioIndex >= 0) {
  await mkdir("supabase/updates", { recursive: true });
  await writeFile(
    "supabase/updates/temporary-audio.sql",
    `-- UNA VOLTA sul progetto esistente, dopo remove-spotify.sql.\n-- Non modifica voti, risultati o utenti.\nbegin;\n${sql[audioIndex]}\ncreate schema if not exists supabase_migrations;\ncreate table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);\ninsert into supabase_migrations.schema_migrations(version,name) values ('${audioVersion}','temporary_audio') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const adminVersion = "20261006000400";
const adminIndex = files.findIndex((file) => file.startsWith(adminVersion));
if (adminIndex >= 0) {
  await writeFile(
    "supabase/updates/admin-console.sql",
    `-- UNA VOLTA sul progetto esistente, dopo temporary-audio.sql.\n-- Aggiunge il pannello admin e protegge il superadmin.\nbegin;\n${sql[adminIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${adminVersion}','admin_console') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const artistVersion = "20261006000500";
const artistIndex = files.findIndex((file) => file.startsWith(artistVersion));
if (artistIndex >= 0) {
  await writeFile(
    "supabase/updates/artist-profiles.sql",
    `-- UNA VOLTA sul progetto esistente, dopo admin-console.sql.\nbegin;\n${sql[artistIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${artistVersion}','artist_profiles') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const realVersion = "20261006000600";
const realIndex = files.findIndex((file) => file.startsWith(realVersion));
if (realIndex >= 0) {
  await writeFile(
    "supabase/updates/real-contests.sql",
    `-- UNA VOLTA sul progetto esistente, dopo artist-profiles.sql.\nbegin;\n${sql[realIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${realVersion}','real_contests') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const partialVersion = "20261007000100";
const partialIndex = files.findIndex((file) => file.startsWith(partialVersion));
if (partialIndex >= 0) {
  await writeFile(
    "supabase/updates/partial-daily-selection.sql",
    `-- UNA VOLTA sul progetto esistente, dopo real-contests.sql.\nbegin;\n${sql[partialIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${partialVersion}','partial_daily_selection') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const queueVersion = "20261007000200";
const queueIndex = files.findIndex((file) => file.startsWith(queueVersion));
if (queueIndex >= 0) {
  await writeFile(
    "supabase/updates/genre-queue.sql",
    `-- UNA VOLTA sul progetto esistente, dopo partial-daily-selection.sql.\nbegin;\n${sql[queueIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${queueVersion}','genre_queue') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const balanceVersion = "20261008000100";
const balanceIndex = files.findIndex((file) => file.startsWith(balanceVersion));
if (balanceIndex >= 0) {
  await writeFile(
    "supabase/updates/balanced-genre-selection.sql",
    `-- UNA VOLTA sul progetto esistente, dopo genre-queue.sql.\n-- Conserva selezioni, ascolti e voti già registrati.\nbegin;\n${sql[balanceIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${balanceVersion}','balanced_genre_selection') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const linksVersion = "20261008000200";
const linksIndex = files.findIndex((file) => file.startsWith(linksVersion));
if (linksIndex >= 0) {
  await writeFile(
    "supabase/updates/admin-application-links.sql",
    `-- UNA VOLTA sul progetto esistente, dopo balanced-genre-selection.sql.\nbegin;\n${sql[linksIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${linksVersion}','admin_application_links') on conflict(version) do nothing;\ncommit;\n`,
  );
}
const identityVersion = "20261008000300";
const identityIndex = files.findIndex((file) =>
  file.startsWith(identityVersion),
);
if (identityIndex >= 0) {
  await writeFile(
    "supabase/updates/admin-profile-identity.sql",
    `-- UNA VOLTA sul progetto esistente, dopo admin-application-links.sql.\nbegin;\n${sql[identityIndex]}\ninsert into supabase_migrations.schema_migrations(version,name) values ('${identityVersion}','admin_profile_identity') on conflict(version) do nothing;\ncommit;\n`,
  );
}
console.log(
  `Generati supabase/generated/setup.sql, setup-demo.sql e seed demo: ${files.length} migrazioni, ${catalog.length} brani.`,
);
