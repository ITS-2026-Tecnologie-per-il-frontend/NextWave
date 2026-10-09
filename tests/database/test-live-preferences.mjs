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
  "public.save_profile(text,text,text[],boolean)",
  "public.begin_listening(uuid)",
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
const full = "22222222-2222-2222-2222-222222222222";
await db.query("insert into auth.users(id) values($1),($2)", [user, full]);
const artist = (
  await db.query(
    "insert into vp_private.artists(name,monthly_listeners,eligibility_verified_at) values('Fixture',20,now()) returning id",
  )
).rows[0].id;
async function track(genre, title) {
  return (
    await db.query(
      "insert into vp_private.tracks(artist_id,title,genre,audio_path,duration_seconds,rights_verified_at,active,contest_day) values($1,$2,$3,'https://example.com/audio.mp3',12,now(),true,'2026-10-07') returning id",
      [artist, title, genre],
    )
  ).rows[0].id;
}
const indie = await track("Indie", "Indie uno");
const hiphop = await track("Hip hop", "Hip hop uno");
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function prefs(genres) {
  await db.query("select public.save_profile('Test','pulse',$1,true)", [
    genres,
  ]);
}
async function dashboard() {
  return (await db.query("select public.get_dashboard() value")).rows[0].value;
}
async function rows(id) {
  await db.exec("reset role");
  return (
    await db.query(
      "select s.id,s.slot,s.track_id,t.genre,s.completed_at from vp_private.daily_selections s join vp_private.tracks t on t.id=s.track_id where s.user_id=$1 order by s.slot",
      [id],
    )
  ).rows;
}
await login(user);
await prefs(["Indie"]);
let data = await dashboard();
assert.equal(data.tracks.length, 1);
const initial = data.profile.rounds["2026-10-07"].ids[0];
const session = (
  await db.query("select public.begin_listening($1) value", [initial])
).rows[0].value;
await prefs(["Indie", "Hip hop"]);
data = await dashboard();
assert.equal(data.tracks.length, 2);
assert.equal(data.profile.rounds["2026-10-07"].ids[0], initial);
assert.ok(data.tracks.some((t) => t.genre === "Hip hop"));
const stable = data.profile.rounds["2026-10-07"].ids;
await prefs(["Hip hop", "Indie"]);
assert.deepEqual((await dashboard()).profile.rounds["2026-10-07"].ids, stable);
await db.exec("reset role");
assert.equal(
  (
    await db.query(
      "select id from vp_private.listening_sessions where user_id=$1",
      [user],
    )
  ).rows[0].id,
  session.sessionId,
);
await db.query(
  "update vp_private.daily_selections set completed_at=now() where id=$1",
  [initial],
);
await login(user);
await db.query("select public.toggle_favorite($1)", [initial]);
await prefs(["Hip hop"]);
data = await dashboard();
assert.ok(data.profile.rounds["2026-10-07"].listened.includes(initial));
assert.deepEqual(data.profile.saved, [indie]);
// Nuovi candidati possono riempire gli slot ancora vuoti senza cambiare gli ID esistenti.
const before = data.profile.rounds["2026-10-07"].ids;
await db.exec("reset role");
for (let i = 0; i < 4; i++) await track("Hip hop", "Hip hop " + i);
await login(user);
data = await dashboard();
assert.equal(data.tracks.length, 5);
assert.ok(
  before.every((id) => data.profile.rounds["2026-10-07"].ids.includes(id)),
);
const fullIds = data.profile.rounds["2026-10-07"].ids;
assert.deepEqual((await dashboard()).profile.rounds["2026-10-07"].ids, fullIds);
await db.exec("reset role");
for (let i = 0; i < 4; i++) await track("Indie", "Indie " + i);
await login(full);
await prefs(["Indie"]);
assert.equal((await dashboard()).tracks.length, 5);
await prefs(["Indie", "Hip hop"]);
data = await dashboard();
const counts = data.tracks.reduce(
  (map, t) => ((map[t.genre] = (map[t.genre] || 0) + 1), map),
  {},
);
assert.deepEqual(Object.values(counts).sort(), [2, 3]);
const voteIds = data.profile.rounds["2026-10-07"].ids;
await db.exec("reset role");
await db.query(
  "update vp_private.daily_selections set completed_at=now() where user_id=$1",
  [full],
);
await login(full);
await db.query("select public.cast_vote($1)", [voteIds[0]]);
await prefs(["Hip hop"]);
assert.deepEqual((await dashboard()).profile.rounds["2026-10-07"].ids, voteIds);
assert.equal((await dashboard()).profile.rounds["2026-10-07"].vote, voteIds[0]);
await db.exec(
  "reset role; update public.test_clock set stamp='2026-10-07T19:00:00Z'",
);
await login(user);
await prefs(["Indie"]);
assert.deepEqual((await dashboard()).profile.rounds["2026-10-07"].ids, fullIds);
await assert.rejects(
  db.query("select vp_private.ensure_daily_selection($1)", [user]),
  /permission denied/,
);
await db.close();
console.log(
  "OK Indie + Hip hop, slot parziali/completi, bilanciamento, ascolto attivo, completamenti, preferiti, voto, reveal e stabilità.",
);
