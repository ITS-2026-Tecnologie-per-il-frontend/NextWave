import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;`);
const files = (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
for (const file of files.filter((file) => !file.startsWith("20261006000500")))
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
const oldArtist = "11111111-1111-1111-1111-111111111111";
const newArtist = "22222222-2222-2222-2222-222222222222";
await db.query("insert into auth.users(id) values($1),($2)", [
  oldArtist,
  newArtist,
]);
const oldApplication = (
  await db.query(
    `insert into public.artist_applications(user_id,artist,title,listeners,genre,language,subgenre,mood,spotify_id,rights_confirmed)
values($1,'Old artist','Old song',20,'Pop','Italiano','Pop','Intimo','1234567890123456789012',true) returning id`,
    [oldArtist],
  )
).rows[0].id;
await db.query(
  "insert into vp_private.audio_assets(application_id,user_id,state,duration,expires_at) values($1,$2,'ready',12,now()+interval '7 days')",
  [oldApplication, oldArtist],
);
await db.exec(
  await readFile(
    `supabase/migrations/${files.find((file) => file.startsWith("20261006000500"))}`,
    "utf8",
  ),
);
assert.equal(
  (
    await db.query("select account_type from public.profiles where id=$1", [
      oldArtist,
    ])
  ).rows[0].account_type,
  "artist",
);
assert.ok(
  (
    await db.query(
      "select submitted_at from public.artist_applications where id=$1",
      [oldApplication],
    )
  ).rows[0].submitted_at,
);
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function audio(action, user, data = {}) {
  return (
    await db.query("select public.audio_server($1,$2,$3::jsonb) value", [
      action,
      user,
      JSON.stringify(data),
    ])
  ).rows[0].value;
}
const submission = {
  artist: "Artist",
  title: "Song",
  listeners: 20,
  genre: "Pop",
  language: "Italiano",
  subgenre: "Pop",
  mood: "Intimo",
  spotifyId: "2234567890123456789012",
  rights: true,
};
await db.exec("set role service_role");
await assert.rejects(
  audio("reserve", newArtist, submission),
  /Attiva il profilo Artista/,
);
await assert.rejects(audio("reserve", oldArtist, submission), /questo mese/);
await login(newArtist);
await assert.rejects(
  db.query("select public.set_account_type('admin')"),
  /Ascoltatore o Artista/,
);
await db.query("select public.set_account_type('artist')");
assert.equal(
  (await db.query("select public.get_dashboard() value")).rows[0].value.profile
    .accountType,
  "artist",
);
await db.exec("reset role; set role service_role");
const failed = await audio("reserve", newArtist, submission);
await audio("cancel-upload", newArtist, { id: failed.id });
// Una prenotazione annullata non consuma la quota.
const first = await audio("reserve", newArtist, submission);
await assert.rejects(
  audio("reserve", newArtist, {
    ...submission,
    spotifyId: "3234567890123456789012",
  }),
  /caricamento in corso/,
);
await audio("claim-upload", newArtist, { id: first.id });
await audio("complete-upload", newArtist, {
  id: first.id,
  duration: 12,
  bytes: 1000,
});
await assert.rejects(
  audio("reserve", newArtist, {
    ...submission,
    spotifyId: "3234567890123456789012",
  }),
  /questo mese/,
);
await db.exec("reset role");
const firstApplication = (
  await db.query(
    "select application_id from vp_private.audio_assets where id=$1",
    [first.id],
  )
).rows[0].application_id;
// Anche il rifiuto e il cambio di profilo conservano il limite.
await db.query(
  "update public.artist_applications set status='rejected' where id=$1",
  [firstApplication],
);
await login(newArtist);
await db.query("select public.set_account_type('listener')");
await db.query("select public.set_account_type('artist')");
await db.exec("reset role; set role service_role");
await assert.rejects(
  audio("reserve", newArtist, {
    ...submission,
    spotifyId: "3234567890123456789012",
  }),
  /questo mese/,
);
// Simula il mese successivo: il vecchio audio conservato non impedisce una nuova candidatura.
await db.exec("reset role");
await db.query(
  "update public.artist_applications set submitted_at=(date_trunc('month',clock_timestamp() at time zone 'Europe/Rome')-interval '1 second') at time zone 'Europe/Rome' where id=$1",
  [firstApplication],
);
await db.exec("set role service_role");
const second = await audio("reserve", newArtist, {
  ...submission,
  spotifyId: "3234567890123456789012",
});
assert.ok(second.id);
await audio("claim-upload", newArtist, { id: second.id });
await audio("complete-upload", newArtist, {
  id: second.id,
  duration: 12,
  bytes: 1000,
});
await login(newArtist);
const dashboard = (await db.query("select public.get_dashboard() value"))
  .rows[0].value;
assert.equal(dashboard.profile.applications.length, 3);
assert.equal(
  dashboard.profile.applications.filter((a) => a.submittedAt).length,
  2,
);
await db.close();
console.log(
  "OK artista: profilo e permessi, storico preesistente, quota mensile, upload falliti, rifiuti, cambio profilo e nuovo mese con audio conservato.",
);
