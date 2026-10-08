import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
-- Orologio deterministico solo nel database temporaneo della prova.
create table public.test_clock(stamp timestamptz);
insert into public.test_clock values('2026-10-07T08:00:00Z');
create or replace function public.test_now() returns timestamptz language sql volatile security definer as $$ select stamp from public.test_clock $$;`);
for (const file of (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
// Sostituiamo l'orologio solo nelle funzioni del database temporaneo.
for (const signature of [
  "vp_private.ensure_daily_selection(uuid)",
  "public.cast_vote(uuid)",
  "public.toggle_favorite(uuid,boolean)",
  "public.get_dashboard()",
  "public.get_rankings(text,date)",
]) {
  const definition = (
    await db.query("select pg_get_functiondef($1::regprocedure) value", [
      signature,
    ])
  ).rows[0].value;
  await db.exec(
    definition.replaceAll("clock_timestamp()", "public.test_now()"),
  );
}

const user = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
await db.query("insert into auth.users(id) values($1),($2)", [user, other]);
const artist = (
  await db.query(
    "insert into vp_private.artists(name,monthly_listeners,eligibility_verified_at) values('Artista segreto',20,now()) returning id",
  )
).rows[0].id;
const track = (
  await db.query(
    "insert into vp_private.tracks(artist_id,title,genre,audio_path,duration_seconds,rights_verified_at,active,contest_day,source_url) values($1,'Titolo segreto','Pop','https://example.com/audio.mp3',12,now(),true,'2026-10-07','https://suno.com/song/test') returning id",
    [artist],
  )
).rows[0].id;
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function dashboard() {
  return (await db.query("select public.get_dashboard() value")).rows[0].value;
}
await login(user);
await db.query("select public.save_profile('Test','pulse',ARRAY['Pop'],true)");
const slot = (await dashboard()).profile.rounds["2026-10-07"].ids[0];
await assert.rejects(
  db.query("select public.toggle_favorite($1)", [slot]),
  /Completa l’ascolto/,
);
await db.exec("reset role");
await db.query(
  "update vp_private.daily_selections set completed_at=now() where id=$1",
  [slot],
);
await login(other);
await assert.rejects(
  db.query("select public.toggle_favorite($1)", [slot]),
  /Completa l’ascolto/,
);
await login(user);
await db.query("select public.toggle_favorite($1)", [slot]);
let data = await dashboard();
assert.deepEqual(data.profile.saved, [track]);
assert.equal(data.tracks[0].saved, true);
assert.equal(data.favorites[0].title, null);
assert.equal(data.favorites[0].artist, null);
assert.equal(data.favorites[0].spotifyUrl, null);
await db.query("select public.toggle_favorite($1)", [slot]);
assert.equal((await dashboard()).favorites.length, 0);
await db.query("select public.toggle_favorite($1)", [slot]);
await db.exec(
  "reset role; update public.test_clock set stamp='2026-10-07T19:00:00Z'",
);
await login(user);
data = await dashboard();
assert.equal(data.favorites[0].title, "Titolo segreto");
assert.equal(data.favorites[0].artist, "Artista segreto");
assert.equal(data.favorites[0].spotifyUrl, "https://suno.com/song/test");
await db.query("select public.toggle_favorite($1,true)", [track]);
assert.equal((await dashboard()).profile.saved.length, 0);
await db.close();
console.log(
  "OK salvataggio dopo ascolto, contatore, rimozione, isolamento account, anonimato e reveal.",
);
