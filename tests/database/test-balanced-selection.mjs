import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// All fixtures live only in this disposable PostgreSQL database.
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
for (const file of (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort())
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
await db.exec(`create table public.test_clock(stamp timestamptz);
insert into public.test_clock values('2026-10-08T08:00:00Z');
create function public.test_now() returns timestamptz language sql volatile security definer as $$ select stamp from public.test_clock $$;`);
async function freezeClock() {
  for (const signature of [
    "vp_private.ensure_daily_selection(uuid)",
    "public.get_dashboard()",
    "public.save_profile(text,text,text[],boolean)",
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
}
await freezeClock();
const genres = (
  await db.query("select name from public.genres order by display_order")
).rows.map((row) => row.name);
assert.equal(genres.length, 15);
const artist = (
  await db.query(
    "insert into vp_private.artists(name,monthly_listeners,eligibility_verified_at) values('Fixture artist',50,now()) returning id",
  )
).rows[0].id;
await db.query(
  `insert into vp_private.tracks(artist_id,title,genre,audio_path,duration_seconds,rights_verified_at,active,contest_day,created_at)
select $1,g.name||' '||position,g.name,'storage://nextwave-audio/tracks/11111111-1111-1111-1111-111111111111.mp3',12,now(),true,
date '2026-10-08'+offset_day,timestamptz '2026-10-01T08:00:00Z'+position*interval '1 second'
from public.genres g cross join generate_series(1,5) position cross join generate_series(0,9) offset_day`,
  [artist],
);
// A sixth late candidate must never bypass the five chronological genre places.
const sixth = (
  await db.query(
    `insert into vp_private.tracks(artist_id,title,genre,audio_path,duration_seconds,rights_verified_at,active,contest_day,created_at)
values($1,'Sixth Rap','Rap','storage://nextwave-audio/tracks/11111111-1111-1111-1111-111111111111.mp3',12,now(),true,'2026-10-08','2026-10-02') returning id`,
    [artist],
  )
).rows[0].id;
let sequence = 0;
async function user(preferences, onboarded = true) {
  await db.exec("reset role");
  const id = `11111111-1111-1111-1111-${String(++sequence).padStart(12, "0")}`;
  await db.query("insert into auth.users(id) values($1)", [id]);
  await login(id);
  await db.query("select public.save_profile('Test','pulse',$1,$2)", [
    preferences,
    onboarded,
  ]);
  await db.exec("reset role");
  if (!onboarded)
    await db.query("update public.profiles set onboarded=false where id=$1", [
      id,
    ]);
  return id;
}
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function dashboard(id) {
  await login(id);
  const data = (await db.query("select public.get_dashboard() value")).rows[0]
    .value;
  await db.exec("reset role");
  return data;
}
async function assigned(id, day) {
  return (
    await db.query(
      `select s.id,s.track_id,t.genre,s.slot,t.contest_day::text as contest_day
from vp_private.daily_selections s join vp_private.tracks t on t.id=s.track_id
where s.user_id=$1 and s.day=$2::date order by s.slot`,
      [id, day],
    )
  ).rows;
}
function distribution(rows, preferences) {
  return preferences.map(
    (genre) => rows.filter((row) => row.genre === genre).length,
  );
}
function balanced(numbers) {
  assert.ok(
    Math.max(...numbers) - Math.min(...numbers) <= 1,
    JSON.stringify(numbers),
  );
}

for (const genre of genres) {
  const id = await user([genre]);
  await dashboard(id);
  const rows = await assigned(id, "2026-10-08");
  assert.equal(rows.length, 5);
  assert.ok(rows.every((row) => row.genre === genre && row.track_id !== sixth));
}
// Rotate across days for 1..5 preferences with different users and genre sets.
const scenarios = [];
for (let size = 1; size <= 5; size++)
  for (let offset = 0; offset < 10; offset++) {
    const preferences = Array.from(
      { length: size },
      (_, index) => genres[(offset + index) % genres.length],
    );
    scenarios.push({ id: await user(preferences), preferences, history: [] });
  }
for (let offset = 0; offset < 10; offset++) {
  const day = `2026-10-${String(8 + offset).padStart(2, "0")}`;
  await db.query("update public.test_clock set stamp=$1::timestamptz", [
    `${day}T08:00:00Z`,
  ]);
  for (const scenario of scenarios) {
    const data = await dashboard(scenario.id);
    const rows = await assigned(scenario.id, day);
    assert.equal(rows.length, 5);
    assert.equal(new Set(rows.map((row) => row.track_id)).size, 5);
    assert.deepEqual(
      rows.map((row) => row.slot),
      [1, 2, 3, 4, 5],
    );
    assert.ok(
      rows.every(
        (row) =>
          scenario.preferences.includes(row.genre) && row.contest_day === day,
      ),
    );
    assert.ok(
      data.tracks
        .filter((track) => data.profile.rounds[day].ids.includes(track.id))
        .every((track) => track.title === null && track.artist === null),
    );
    balanced(distribution(rows, scenario.preferences));
    scenario.history.push(...rows);
    balanced(distribution(scenario.history, scenario.preferences));
    assert.deepEqual(
      (await dashboard(scenario.id)).profile.rounds[day].ids,
      data.profile.rounds[day].ids,
    );
  }
}

await db.exec("update public.test_clock set stamp='2026-10-18T08:00:00Z'");
await db.query(
  `insert into vp_private.tracks(artist_id,title,genre,audio_path,duration_seconds,rights_verified_at,active,contest_day)
select $1,'Sparse fixture',genre,'storage://nextwave-audio/tracks/11111111-1111-1111-1111-111111111111.mp3',12,now(),true,'2026-10-18'
from unnest(ARRAY['Rap','Jazz','Jazz','Jazz','Jazz','Jazz']) genre`,
  [artist],
);
const sparse = await user(["Rap", "Hip hop", "Jazz"]);
await dashboard(sparse);
assert.deepEqual(
  distribution(await assigned(sparse, "2026-10-18"), [
    "Rap",
    "Hip hop",
    "Jazz",
  ]),
  [1, 0, 4],
);
const short = await user(["Rap", "Hip hop"]);
await dashboard(short);
assert.equal((await assigned(short, "2026-10-18")).length, 1);
const empty = await user(["Hip hop"]);
await dashboard(empty);
assert.equal((await assigned(empty, "2026-10-18")).length, 0);
const unready = await user(["Jazz"], false);
await dashboard(unready);
assert.equal((await assigned(unready, "2026-10-18")).length, 0);

// Le nuove preferenze aggiornano gli slot non iniziati; riapplicare la migrazione non li cambia.
await login(sparse);
await db.query("select public.save_profile('Test','pulse',ARRAY['Jazz'],true)");
await db.exec("reset role");
await dashboard(sparse);
const before = await assigned(sparse, "2026-10-18");
assert.deepEqual(distribution(before, ["Jazz"]), [5]);
await db.exec(`create schema supabase_migrations;
create table supabase_migrations.schema_migrations(version text primary key,name text);`);
await db.exec(
  await readFile("supabase/updates/balanced-genre-selection.sql", "utf8"),
);
await freezeClock();
await dashboard(sparse);
assert.deepEqual(await assigned(sparse, "2026-10-18"), before);
await login(sparse);
await assert.rejects(
  db.query("select vp_private.ensure_daily_selection($1)", [sparse]),
  /permission denied/,
);
await db.exec(
  "reset role; update public.test_clock set stamp='2026-10-18T19:00:00Z'",
);
const late = await user(["Jazz"]);
await dashboard(late);
assert.equal((await assigned(late, "2026-10-18")).length, 0);
await db.close();
console.log(
  "OK estrazione ufficiale: 15 generi, quote 1..5, rotazione su 10 giorni, coda, preferenze, pochi/zero brani, stabilità, migrazione e permessi.",
);
