import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
for (const file of (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
await db.exec(`create table public.test_clock(stamp timestamptz); insert into public.test_clock values('2026-10-07T08:00:00Z');
create function public.test_now() returns timestamptz language sql volatile security definer as $$ select stamp from public.test_clock $$;`);
for (const signature of [
  "public.audio_server(text,uuid,jsonb)",
  "vp_private.schedule_genre(text)",
  "vp_private.ensure_daily_selection(uuid)",
  "public.get_dashboard()",
  "public.admin_console(text,jsonb)",
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

const owner = "11111111-1111-1111-1111-111111111111";
const user = "22222222-2222-2222-2222-222222222222";
const delegated = "33333333-3333-3333-3333-333333333333";
await db.query(
  "insert into auth.users values($1,'santonithomas9@gmail.com',now()),($2,'artist@example.com',now()),($3,'admin@example.com',now())",
  [owner, user, delegated],
);
await db.query("update public.profiles set account_type='artist'");
await db.query(
  "insert into vp_private.admin_accounts(user_id,granted_by) values($1,$2)",
  [delegated, owner],
);
async function reserve(uid, url, extra = {}) {
  return (
    await db.query("select public.audio_server('reserve',$1,$2::jsonb) value", [
      uid,
      JSON.stringify({
        artist: "Artist",
        title: "Song",
        listeners: 50,
        genre: "Rap",
        language: "Italiano",
        subgenre: "Rap",
        mood: "Intimo",
        rights: true,
        spotify: url,
        ...extra,
      }),
    ])
  ).rows[0].value;
}
for (const uid of [owner, delegated]) {
  const url = "https://suno.com/song/" + uid;
  const asset = await reserve(uid, url);
  const app = (
    await db.query(
      "select * from public.artist_applications where user_id=$1",
      [uid],
    )
  ).rows[0];
  assert.equal(app.source_url, url);
  assert.equal(app.spotify_id, null);
  await assert.rejects(() => reserve(uid, url));
  await db.query(
    "update vp_private.audio_assets set state='ready',duration=120,bytes=1000 where id=$1",
    [asset.id],
  );
  const reviews = (
    await db.query("select public.audio_server('review-list') value")
  ).rows[0].value;
  assert.equal(reviews.find((a) => a.id === app.id).spotify, url);
  await db.query("select public.audio_server('approve',null,$1::jsonb)", [
    JSON.stringify({ applicationId: app.id, day: "2026-10-08" }),
  ]);
  const track = (
    await db.query(
      "select t.* from vp_private.tracks t join vp_private.audio_assets aa on aa.track_id=t.id where aa.id=$1",
      [asset.id],
    )
  ).rows[0];
  assert.equal(track.source_url, url);
  assert.equal(track.spotify_id, null);
  await db.exec(
    "set role authenticated; set request.jwt.claim.sub='" + uid + "'",
  );
  const dashboard = (await db.query("select public.get_dashboard() value"))
    .rows[0].value;
  assert.equal(
    dashboard.profile.applications.find((a) => a.id === app.id).spotify,
    url,
  );
  await db.exec("reset role");
}
for (const url of [
  "https://suno.com/song/test",
  "https://youtube.com/watch?v=test",
])
  await assert.rejects(
    () =>
      reserve(user, url, { admin: true, spotifyId: "1234567890123456789012" }),
    /Spotify/,
  );
for (const url of [
  "javascript:alert(1)",
  "data:text/html,test",
  "https://user:pass@example.com/song",
  "broken",
])
  await assert.rejects(() => reserve(owner, url), /link valido/);
const spotify =
  "https://open.spotify.com/intl-it/track/1234567890123456789012?si=abc";
const valid = await reserve(user, spotify);
assert.ok(valid.id);
const stored = (
  await db.query(
    "select source_url,spotify_id from public.artist_applications where user_id=$1",
    [user],
  )
).rows[0];
assert.equal(stored.source_url, spotify);
assert.equal(stored.spotify_id, "1234567890123456789012");
await db.query("delete from vp_private.admin_accounts where user_id=$1", [
  delegated,
]);
await assert.rejects(
  () => reserve(delegated, "https://suno.com/song/revoked"),
  /Spotify/,
);
const track = (
  await db.query("select * from vp_private.tracks where source_url=$1", [
    "https://suno.com/song/" + owner,
  ])
).rows[0];
await db.query(
  "insert into vp_private.contests(day,closes_at) values('2026-10-08','2026-10-08T19:00:00Z') on conflict do nothing",
);
await db.query(
  "insert into vp_private.daily_selections(user_id,day,slot,track_id) values($1,'2026-10-08',1,$2)",
  [owner, track.id],
);
await db.query(
  "insert into vp_private.favorites(user_id,track_id) values($1,$2)",
  [owner, track.id],
);
await db.exec(
  "update public.test_clock set stamp='2026-10-08T20:00:00Z'; set role authenticated; set request.jwt.claim.sub='" +
    owner +
    "'",
);
const revealed = (await db.query("select public.get_dashboard() value")).rows[0]
  .value;
assert.equal(revealed.tracks[0].spotifyUrl, track.source_url);
assert.equal(revealed.favorites[0].spotifyUrl, track.source_url);
await db.exec("reset role");
const ranking = (
  await db.query(
    "select vp_private.ranking_rows('2026-10-08','2026-10-08') value",
  )
).rows[0].value;
assert.equal(ranking[0].spotifyUrl, track.source_url);
console.log(
  "Link admin: ruoli, revoca, utenti ordinari, URL non sicuri, duplicati, approvazione, dashboard, reveal, preferiti e classifiche verificati.",
);
await db.close();
