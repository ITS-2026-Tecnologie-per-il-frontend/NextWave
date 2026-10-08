import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
const files = (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort();
for (const file of files.filter(
  (file) =>
    !file.startsWith("20261006000600") &&
    !file.startsWith("20261007000100") &&
    !file.startsWith("20261007000200") &&
    !file.startsWith("20261008000100"),
))
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
await db.exec(await readFile("supabase/seeds/demo.sql", "utf8"));
const owner = "11111111-1111-1111-1111-111111111111",
  mod = "22222222-2222-2222-2222-222222222222",
  user = "33333333-3333-3333-3333-333333333333",
  fresh = "44444444-4444-4444-4444-444444444444";
await db.query(
  "insert into auth.users(id,email,email_confirmed_at) values($1,'santonithomas9@gmail.com',now()),($2,'mod@example.com',now()),($3,'ordinary@example.com',now()),($4,'fresh@example.com',now())",
  [owner, mod, user, fresh],
);
await db.exec("update public.profiles set account_type='artist'");
const artist = (
  await db.query(
    "insert into vp_private.artists(name,monthly_listeners,eligibility_verified_at) values('Real fixture artist',20,now()) returning id",
  )
).rows[0].id;
const real = [];
for (let i = 0; i < 5; i++)
  real.push(
    (
      await db.query(
        "insert into vp_private.tracks(artist_id,title,genre,audio_path,duration_seconds,rights_verified_at,active) values($1,$2,'Pop','storage://nextwave-audio/tracks/11111111-1111-1111-1111-111111111111.mp3',12,now(),true) returning id",
        [artist, `Real fixture ${i}`],
      )
    ).rows[0].id,
  );
const demo = (
  await db.query("select id from vp_private.tracks where is_demo limit 1")
).rows[0].id;
const dates = (
  await db.query(
    "select ((clock_timestamp() at time zone 'Europe/Rome')::date)::text as today,((clock_timestamp() at time zone 'Europe/Rome')::date-1)::text as yesterday,((clock_timestamp() at time zone 'Europe/Rome')::date-2)::text as older",
  )
).rows[0];
for (const day of [dates.today, dates.yesterday, dates.older])
  await db.query(
    "insert into vp_private.contests(day,closes_at) values($1::date,($1::date+time '21:00') at time zone 'Europe/Rome')",
    [day],
  );
await db.query(
  "insert into vp_private.daily_selections(user_id,day,slot,track_id) values($1,$2::date,1,$3),($1,$2::date,2,$4),($1,$5::date,1,$6),($1,$7::date,1,$4)",
  [user, dates.yesterday, real[0], demo, dates.older, real[1], dates.today],
);
await db.query(
  "insert into vp_private.favorites(user_id,track_id) values($1,$2),($1,$3)",
  [user, demo, real[0]],
);
await db.exec(
  await readFile(
    `supabase/migrations/${files.find((file) => file.startsWith("20261006000600"))}`,
    "utf8",
  ),
);
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function rpc(name, args = []) {
  return (
    await db.query(
      `select public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")}) value`,
      args,
    )
  ).rows[0].value;
}
await login(user);
const yesterday = await rpc("get_rankings", ["day", dates.yesterday]);
assert.equal(yesterday.reference, dates.yesterday);
assert.equal(yesterday.rows.length, 1);
assert.equal(yesterday.rows[0].id, real[0]);
assert.equal(yesterday.rows[0].votes, 0);
assert.equal(
  (await rpc("get_rankings", ["day", dates.older])).rows[0].id,
  real[1],
);
assert.equal((await rpc("get_rankings", ["day", "2020-01-01"])).rows.length, 0);
await assert.rejects(rpc("get_rankings", ["day", "2099-01-01"]), /21:00/);
const weekly = await rpc("get_rankings", ["week", dates.yesterday]);
assert.equal(new Date(`${weekly.reference}T12:00:00Z`).getUTCDay(), 0);
const dashboard = await rpc("get_dashboard");
assert.equal(dashboard.tracks.length, 2);
assert.ok(dashboard.tracks.every((track) => !track.isDemo));
assert.equal(dashboard.favorites.length, 1);
assert.equal(dashboard.profile.rounds[dates.yesterday].ids.length, 1);
assert.equal(dashboard.profile.rounds[dates.today], undefined);
assert.equal((await rpc("get_reveal", [dates.yesterday])).length, 1);
await db.exec("reset role");
const demoSlot = (
  await db.query(
    "select id from vp_private.daily_selections where user_id=$1 and day=$2::date",
    [user, dates.today],
  )
).rows[0].id;
await login(user);
await assert.rejects(rpc("begin_listening", [demoSlot]), /non disponibile/);
await db.exec(
  "reset role; update vp_private.tracks set active=true where is_demo",
);
await login(fresh);
await rpc("save_profile", ["Fresh", "pulse", ["Pop"], true]);
const freshDashboard = await rpc("get_dashboard");
assert.equal(freshDashboard.tracks.length, 5);
assert.ok(freshDashboard.tracks.every((track) => !track.isDemo));
await login(owner);
await rpc("admin_console", [
  "grant",
  JSON.stringify({ email: "mod@example.com" }),
]);
async function upload(id, index) {
  await db.exec("reset role; set role service_role");
  const data = {
    artist: "Test artist",
    title: `Song ${index}`,
    listeners: 20,
    genre: "Pop",
    language: "Italiano",
    subgenre: "Pop",
    mood: "Intimo",
    rights: true,
    spotifyId: `${index}`.padStart(22, "0"),
  };
  const asset = await rpc("audio_server", [
    "reserve",
    id,
    JSON.stringify(data),
  ]);
  await rpc("audio_server", [
    "claim-upload",
    id,
    JSON.stringify({ id: asset.id }),
  ]);
  await rpc("audio_server", [
    "complete-upload",
    id,
    JSON.stringify({ id: asset.id, bytes: 1000, duration: 12 }),
  ]);
}
await upload(owner, 1);
await upload(owner, 2);
await upload(mod, 3);
await upload(mod, 4);
await upload(user, 5);
await assert.rejects(upload(user, 6), /questo mese/);
await login(owner);
await rpc("admin_console", ["revoke", JSON.stringify({ userId: mod })]);
await assert.rejects(upload(mod, 7), /questo mese/);
await db.close();
console.log(
  "OK contest reali: calendario e date chiuse, storico demo escluso, selezioni reali, superadmin/admin senza quota e ripristino dopo revoca.",
);
