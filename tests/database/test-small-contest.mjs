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
const user = "11111111-1111-1111-1111-111111111111",
  other = "22222222-2222-2222-2222-222222222222",
  single = "33333333-3333-3333-3333-333333333333";
await db.query("insert into auth.users(id) values($1),($2),($3)", [
  user,
  other,
  single,
]);
const artist = (
  await db.query(
    "insert into vp_private.artists(name,monthly_listeners,eligibility_verified_at) values('Test artist',50,clock_timestamp()) returning id",
  )
).rows[0].id;
async function track(genre, day = "2026-10-07") {
  return (
    await db.query(
      "insert into vp_private.tracks(artist_id,title,genre,audio_path,duration_seconds,rights_verified_at,active,contest_day) values($1,$2,$3,'storage://nextwave-audio/tracks/11111111-1111-1111-1111-111111111111.mp3',12,clock_timestamp(),true,$4::date) returning id",
      [artist, `Test ${genre}`, genre, day],
    )
  ).rows[0].id;
}
const hiphop = await track("Hip hop"),
  reggaeton = await track("Reggaeton");
await track("Hip hop", "2026-10-08");
await track("Reggaeton", "2026-10-06");
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function dashboard() {
  return (await db.query("select public.get_dashboard() value")).rows[0].value;
}
await login(user);
await db.query(
  "select public.save_profile('Small','pulse',ARRAY['Hip hop','Reggaeton'],true)",
);
const data = await dashboard(),
  round = data.profile.rounds["2026-10-07"];
assert.equal(round.ids.length, 2);
assert.deepEqual(
  new Set(data.tracks.map((t) => t.genre)),
  new Set(["Hip hop", "Reggaeton"]),
);
assert.deepEqual(
  (await dashboard()).profile.rounds["2026-10-07"].ids,
  round.ids,
);
await assert.rejects(
  db.query("select public.cast_vote($1)", [round.ids[0]]),
  /Completa tutti/,
);
await db.exec("reset role");
await db.query(
  "update vp_private.daily_selections set completed_at=clock_timestamp() where id=$1",
  [round.ids[0]],
);
await login(user);
await assert.rejects(
  db.query("select public.cast_vote($1)", [round.ids[0]]),
  /Completa tutti/,
);
await db.exec("reset role");
await db.query(
  "update vp_private.daily_selections set completed_at=clock_timestamp() where id=$1",
  [round.ids[1]],
);
await login(user);
await db.query("select public.cast_vote($1)", [round.ids[0]]);
await assert.rejects(
  db.query("select public.cast_vote($1)", [round.ids[1]]),
  /già votato/,
);
await login(other);
await db.query(
  "select public.save_profile('Other','pulse',ARRAY['Rock'],true)",
);
assert.equal((await dashboard()).tracks.length, 0);
await login(single);
await db.query(
  "select public.save_profile('Single','pulse',ARRAY['Hip hop'],true)",
);
assert.equal((await dashboard()).profile.rounds["2026-10-07"].ids.length, 1);
await db.exec("reset role");
await db.exec("update public.test_clock set stamp='2026-10-07T19:01:00Z'");
await login(user);
await assert.rejects(
  db.query("select public.cast_vote($1)", [round.ids[0]]),
  /chiuso/,
);
const rankings = (
  await db.query("select public.get_rankings('day','2026-10-07') value")
).rows[0].value;
assert.deepEqual(
  new Set(rankings.rows.map((t) => t.id)),
  new Set([hiphop, reggaeton]),
);
await db.close();
console.log(
  "OK due brani Hip hop/Reggaeton: selezione visibile e stabile, gusti e giorno rispettati, voto dopo tutti gli ascolti, zero/uno brano e chiusura alle 21.",
);
