import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;`);
const files = (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
for (const file of files) {
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  console.log(`OK migration ${file}`);
}
const demo = await readFile("supabase/seeds/demo.sql", "utf8");
await db.exec(demo);
await db.exec(demo);
assert.equal(
  (await db.query("select count(*)::int count from vp_private.tracks")).rows[0]
    .count,
  75,
);
console.log(
  "OK seed idempotente: 75 brani, 15 generi, nessun utente o voto fittizio",
);
const user1 = "11111111-1111-1111-1111-111111111111";
const user2 = "22222222-2222-2222-2222-222222222222";
await db.query("insert into auth.users(id) values ($1), ($2)", [user1, user2]);
assert.equal(
  (
    await db.query(
      "select to_regprocedure('public.spotify_server(text,uuid,jsonb)') value",
    )
  ).rows[0].value,
  null,
);
await db.exec(
  `set role authenticated; set request.jwt.claim.sub = '${user1}';`,
);
assert.equal((await db.query("select * from public.profiles")).rows.length, 1);

await assert.rejects(
  db.query("select * from vp_private.tracks"),
  /permission denied/,
);
await assert.rejects(
  db.query(`update public.profiles set theme='house'`),
  /permission denied/,
);
await db.query(
  "select public.save_profile('Test', 'pulse', ARRAY['Indie', 'Pop'], true)",
);
const dashboard = (await db.query("select public.get_dashboard() value"))
  .rows[0].value;
const day = dashboard.clock.day;
assert.equal(dashboard.profile.rounds[day].ids.length, 5);
const slot = dashboard.profile.rounds[day].ids[0];
const second = dashboard.profile.rounds[day].ids[1];
const again = (await db.query("select public.get_dashboard() value")).rows[0]
  .value;
assert.deepEqual(
  again.profile.rounds[day].ids,
  dashboard.profile.rounds[day].ids,
);
if (!dashboard.clock.revealed) {
  assert.ok(
    dashboard.tracks.every(
      (track) => track.title === null && track.artist === null,
    ),
  );
  await assert.rejects(
    db.query("select public.get_reveal($1)", [day]),
    /Reveal non disponibile/,
  );
  await assert.rejects(
    db.query("select public.toggle_favorite($1)", [slot]),
    /Attendi il reveal/,
  );
}
await assert.rejects(
  db.query("select public.begin_listening($1)", [second]),
  /Completa il brano precedente/,
);
let session = (
  await db.query("select public.begin_listening($1) value", [slot])
).rows[0].value;
await assert.rejects(
  db.query("select public.listening_progress($1, 12, true)", [
    session.sessionId,
  ]),
  /Ascolto discontinuo|Ascolta il brano/,
);
// Tante richieste veloci non devono sommare le piccole tolleranze fino a
// completare un audio senza aspettarne la durata reale.
const burstStarted = performance.now();
let burstCredit = 0;
for (let index = 1; index <= 30; index++) {
  const progress = await db.query(
    "select public.listening_progress($1, $2, false) value",
    [session.sessionId, index / 10],
  );
  burstCredit = progress.rows[0].value.creditedSeconds;
}
assert.ok(burstCredit <= (performance.now() - burstStarted) / 1000 + 0.5);
session = (await db.query("select public.begin_listening($1) value", [slot]))
  .rows[0].value;
console.log("OK richieste ripetute: il credito resta limitato al tempo server");
await assert.rejects(
  db.query("select public.cast_vote($1)", [slot]),
  /Completa tutti|chiuso/,
);
await db.query(
  "select public.save_profile('Test', 'house', ARRAY['Jazz'], true)",
);
assert.deepEqual(
  (await db.query("select public.get_dashboard() value")).rows[0].value.profile
    .rounds[day].ids,
  dashboard.profile.rounds[day].ids,
);
await db.exec(`set request.jwt.claim.sub = '${user2}';`);
await assert.rejects(
  db.query("select public.begin_listening($1)", [slot]),
  /non disponibile/,
);
await assert.rejects(
  db.query("select public.listening_progress($1, 0, false)", [
    session.sessionId,
  ]),
  /Sessione scaduta/,
);
assert.equal(
  (await db.query("select * from public.profiles")).rows[0].id,
  user2,
);
await db.exec("reset role;");
const profileOwner = (
  await db.query(
    "select user_id from vp_private.daily_selections where id=$1",
    [slot],
  )
).rows[0].user_id;
assert.equal(profileOwner, user1);
// Simula elapsed server senza attese: si verifica la transizione, non l'audio umano.
await db.query(
  "update vp_private.listening_sessions set last_ping_at = clock_timestamp() - interval '6 seconds', started_at = clock_timestamp() - interval '12 seconds' where id=$1",
  [session.sessionId],
);
await db.exec(
  `set role authenticated; set request.jwt.claim.sub = '${user1}';`,
);
await db.query("select public.listening_progress($1, 6, false)", [
  session.sessionId,
]);
await db.exec("reset role;");
await db.query(
  "update vp_private.listening_sessions set last_ping_at = clock_timestamp() - interval '6 seconds', started_at = clock_timestamp() - interval '12 seconds' where id=$1",
  [session.sessionId],
);
await db.exec(
  `set role authenticated; set request.jwt.claim.sub = '${user1}';`,
);
await db.query("select public.listening_progress($1, 12, true)", [
  session.sessionId,
]);
assert.equal(
  (await db.query("select public.get_dashboard() value")).rows[0].value.profile
    .rounds[day].listened.length,
  1,
);
await db.query("select public.begin_listening($1)", [second]);
await db.exec("reset role;");
// Prepara un contest già chiuso per verificare reveal e metriche condivise.
await db.query(
  "insert into vp_private.contests(day, closes_at) values ('2020-01-01', '2020-01-01 21:00 Europe/Rome')",
);
await db.query(
  "insert into vp_private.daily_selections(user_id, day, slot, track_id, completed_at) select user_id, '2020-01-01', slot, track_id, clock_timestamp() from vp_private.daily_selections where user_id=$1 and day=$2",
  [user1, day],
);
await db.query(
  "insert into vp_private.votes(user_id, day, selection_id) select user_id, day, id from vp_private.daily_selections where user_id=$1 and day='2020-01-01' and slot=1",
  [user1],
);
await assert.rejects(
  db.query(
    "insert into vp_private.votes(user_id, day, selection_id) select user_id, day, id from vp_private.daily_selections where user_id=$1 and day='2020-01-01' and slot=2",
    [user1],
  ),
  /duplicate key/,
);
await db.exec(
  `set role authenticated; set request.jwt.claim.sub = '${user1}';`,
);
const reveal = (await db.query("select public.get_reveal('2020-01-01') value"))
  .rows[0].value;
assert.equal(reveal.length, 5);
assert.equal(reveal[0].votes, 1);
assert.equal(reveal[0].score, 1);
await db.query("select public.toggle_favorite($1)", [reveal[0].id]);
assert.equal(
  (await db.query("select public.get_dashboard() value")).rows[0].value
    .favorites.length,
  1,
);
await db.query(
  "select public.submit_application('Artist', 'Song', 20, 'Pop', 'Italiano', 'Indie pop', 'Sognante', '1234567890123456789012', true)",
);
assert.equal(
  (await db.query("select * from public.artist_applications")).rows.length,
  1,
);
await db.exec(`set request.jwt.claim.sub = '${user2}';`);
assert.equal(
  (await db.query("select * from public.artist_applications")).rows.length,
  0,
);
await db.exec("reset role; set role anon;");
assert.equal((await db.query("select * from public.genres")).rows.length, 15);
await assert.rejects(
  db.query("select * from public.profiles"),
  /permission denied/,
);
await assert.rejects(
  db.query("select public.get_dashboard()"),
  /permission denied/,
);
console.log(
  "OK RLS, ACL, anonimato prima del reveal, selezione stabile, ascolti in ordine, completamento server, voti unici, candidature e preferiti",
);
await db.close();
