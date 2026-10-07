import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;`);
const files = (await readdir("supabase/migrations"))
  // Regressione dello storico demo; il percorso reale è verificato da contests:test.
  .filter(
    (file) =>
      file.endsWith(".sql") &&
      !file.startsWith("20261006000600") &&
      !file.startsWith("20261007000100"),
  )
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
await db.query("update public.profiles set account_type='artist'");
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
await assert.rejects(
  db.query(
    "select public.submit_application('Artist', 'Song', 20, 'Pop', 'Italiano', 'Indie pop', 'Sognante', '1234567890123456789012', true)",
  ),
  /permission denied/,
);
await assert.rejects(
  db.query("select public.audio_server('reserve')"),
  /permission denied/,
);
await db.exec("reset role; set role service_role;");
const submission = {
  artist: "Artist",
  title: "Song",
  listeners: 20,
  genre: "Pop",
  language: "Italiano",
  subgenre: "Indie pop",
  mood: "Sognante",
  spotifyId: "1234567890123456789012",
  rights: true,
};
async function audioCommand(action, data = {}) {
  return (
    await db.query("select public.audio_server($1,$2,$3::jsonb) value", [
      action,
      user1,
      JSON.stringify(data),
    ])
  ).rows[0].value;
}
const asset = await audioCommand("reserve", submission);
await assert.rejects(
  audioCommand("reserve", {
    ...submission,
    spotifyId: "2234567890123456789012",
  }),
  /caricamento in corso/,
);
await assert.rejects(
  db.query("select public.audio_server('claim-upload',$1,$2::jsonb)", [
    user2,
    JSON.stringify({ id: asset.id }),
  ]),
  /scaduto/,
);
await audioCommand("claim-upload", { id: asset.id });
await audioCommand("complete-upload", {
  id: asset.id,
  bytes: 1000,
  duration: 12,
});
await db.exec(
  `reset role; set role authenticated; set request.jwt.claim.sub = '${user1}';`,
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
await assert.rejects(
  db.query("select public.audio_server('cleanup-list')"),
  /permission denied/,
);
await db.exec("reset role; set role service_role;");
const ready = await audioCommand("review-list");
assert.equal(ready.length, 1);
const applicationId = ready[0].id;
const tomorrow = (
  await db.query(
    "select ((clock_timestamp() at time zone 'Europe/Rome')::date+1)::text as day",
  )
).rows[0].day;
const approved = await audioCommand("approve", {
  applicationId,
  day: tomorrow,
});
await db.exec("reset role;");
// Il brano approvato per domani non può entrare nei cinque di oggi.
const user3 = "33333333-3333-3333-3333-333333333333";
await db.query("insert into auth.users(id) values ($1)", [user3]);
await db.query("update vp_private.tracks set active=false where is_demo");
await db.query(
  "update vp_private.tracks set active=true where id in(select id from vp_private.tracks where is_demo and genre='Pop' limit 4)",
);
await db.exec(
  `set role authenticated; set request.jwt.claim.sub = '${user3}';`,
);
await db.query(
  "select public.save_profile('Future', 'pulse', ARRAY['Pop'], true)",
);
assert.equal(
  (await db.query("select public.get_dashboard() value")).rows[0].value.tracks
    .length,
  0,
);
await db.exec("reset role;");
await db.query("update vp_private.tracks set active=true where is_demo");
assert.equal(
  (
    await db.query(
      "select count(*)::int n from vp_private.daily_selections where track_id=$1 and day=$2",
      [approved.trackId, day],
    )
  ).rows[0].n,
  0,
);
await db.query(
  "update vp_private.audio_assets set expires_at=clock_timestamp()-interval '1 minute' where id=$1",
  [asset.id],
);
// Un riferimento in un contest ancora aperto impedisce la cancellazione.
await db.query(
  "insert into vp_private.contests(day,closes_at) values($1::date,($1::date+time '21:00') at time zone 'Europe/Rome')",
  [tomorrow],
);
await db.query(
  "insert into vp_private.daily_selections(user_id,day,slot,track_id,completed_at) values($1,$2::date,1,$3,clock_timestamp())",
  [user2, tomorrow, approved.trackId],
);
await db.exec("set role service_role;");
assert.equal(
  (await audioCommand("cleanup-list")).some(
    (job) => job.id === asset.id && job.kind === "audio",
  ),
  false,
);
await db.exec("reset role;");
await db.query(
  "update vp_private.daily_selections set day='2020-01-01' where user_id=$1 and track_id=$2",
  [user2, approved.trackId],
);
await db.query(
  "insert into vp_private.votes(user_id,day,selection_id) select user_id,day,id from vp_private.daily_selections where user_id=$1 and day='2020-01-01'",
  [user2],
);
await db.exec("set role service_role;");
const jobs = await audioCommand("cleanup-list");
assert.equal(
  jobs.some((job) => job.id === asset.id && job.kind === "audio"),
  true,
);
await db.exec("reset role;");
assert.equal(
  (
    await db.query(
      "select audio_path is not null available from vp_private.tracks where id=$1",
      [approved.trackId],
    )
  ).rows[0].available,
  true,
);
await db.exec("set role service_role;");
await audioCommand("cleanup-done", { id: asset.id, kind: "audio" });
await db.exec("reset role;");
const retained = (
  await db.query(
    "select t.title,t.spotify_id,t.audio_path,a.status,a.audio_deleted_at from vp_private.tracks t join vp_private.audio_assets aa on aa.track_id=t.id join public.artist_applications a on a.id=aa.application_id where t.id=$1",
    [approved.trackId],
  )
).rows[0];
assert.equal(retained.title, "Song");
assert.equal(retained.spotify_id, submission.spotifyId);
assert.equal(retained.audio_path, null);
assert.equal(retained.status, "approved");
assert.ok(retained.audio_deleted_at);
assert.equal(
  (await db.query("select count(*)::int n from vp_private.votes")).rows[0].n,
  2,
);
await db.exec(
  `set role authenticated; set request.jwt.claim.sub = '${user2}';`,
);
const retainedReveal = (
  await db.query("select public.get_reveal('2020-01-01') value")
).rows[0].value;
assert.equal(retainedReveal[0].title, "Song");
assert.equal(
  retainedReveal[0].spotifyUrl,
  `https://open.spotify.com/track/${submission.spotifyId}`,
);
assert.equal(retainedReveal[0].votes, 1);
await db.query("select public.toggle_favorite($1)", [retainedReveal[0].id]);
const favorite = (await db.query("select public.get_dashboard() value")).rows[0]
  .value.favorites[0];
assert.equal(favorite.spotifyUrl, retainedReveal[0].spotifyUrl);
// La prenotazione rimane occupata finché esiste l'originale, anche se il file pulito è eliminato.
await db.exec("reset role;");
await db.query(
  "insert into auth.users(id) select md5('capacity-'||n)::uuid from generate_series(1,39) n",
);
await db.query(
  "update public.profiles set account_type='artist' where id in(select md5('capacity-'||n)::uuid from generate_series(1,39) n)",
);
await db.query(
  "insert into public.artist_applications(user_id,artist,title,listeners,genre,language,subgenre,mood,spotify_id,rights_confirmed) select md5('capacity-'||n)::uuid,'Artist','Song',20,'Pop','Italiano','Pop','Intimo','1234567890123456789012',true from generate_series(1,39) n",
);
await db.query(
  "insert into vp_private.audio_assets(application_id,user_id) select id,user_id from public.artist_applications where id<>$1",
  [applicationId],
);
await db.exec("set role service_role;");
await assert.rejects(
  db.query("select public.audio_server('reserve',$1,$2::jsonb)", [
    user2,
    JSON.stringify(submission),
  ]),
  /Spazio/,
);
await db.exec("reset role;");
await db.query(
  "update vp_private.audio_assets set upload_expires_at=clock_timestamp()-interval '1 minute' where id=$1",
  [asset.id],
);
await db.exec("set role service_role;");
await audioCommand("cleanup-done", { id: asset.id, kind: "raw" });
await db.query("select public.audio_server('reserve',$1,$2::jsonb)", [
  user2,
  JSON.stringify(submission),
]);
await audioCommand("demo-ready");
await db.exec(
  `reset role; set role authenticated; set request.jwt.claim.sub = '${user1}';`,
);
const demoReveal = (
  await db.query("select public.get_reveal('2020-01-01') value")
).rows[0].value;
assert.ok(
  demoReveal.every(
    (row) => row.isDemo && row.spotifyUrl.includes("7iNLydOMjLLb7BiwkdoPDU"),
  ),
);
console.log(
  "OK RLS, ACL, anonimato, ascolti in ordine, voti unici, candidature, giorno assegnato, capacità Storage e conservazione di link/risultati dopo la pulizia",
);
await db.close();
