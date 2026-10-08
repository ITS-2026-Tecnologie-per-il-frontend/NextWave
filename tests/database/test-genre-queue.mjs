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
const listener = "22222222-2222-2222-2222-222222222222";
await db.query(
  "insert into auth.users values($1,'santonithomas9@gmail.com',now()),($2,'listener@example.com',now())",
  [owner, listener],
);
await db.query("update public.profiles set account_type='artist' where id=$1", [
  owner,
]);
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function command(action, data) {
  return (
    await db.query("select public.admin_console($1,$2::jsonb) value", [
      action,
      JSON.stringify(data),
    ])
  ).rows[0].value;
}
async function application(index, genre = "Trap") {
  await db.exec("reset role");
  const id = (
    await db.query(
      `insert into public.artist_applications(user_id,artist,title,listeners,genre,language,subgenre,mood,spotify_id,rights_confirmed,submitted_at,created_at)
  values($1,'Artist',$2,50,$3,'Italiano','Trap','Intimo',$4,true,$5::timestamptz,$5::timestamptz) returning id`,
      [
        owner,
        `Song ${genre} ${index}`,
        genre,
        String(index + (genre === "Trap" ? 0 : 100)).padStart(22, "0"),
        `2026-10-06T${String(index).padStart(2, "0")}:00:00Z`,
      ],
    )
  ).rows[0].id;
  await db.query(
    "insert into vp_private.audio_assets(application_id,user_id,state,duration,bytes,expires_at) values($1,$2,'ready',12,1000,'2026-10-14T08:00:00Z')",
    [id, owner],
  );
  return id;
}
const applications = [];
for (let i = 1; i <= 12; i++) applications.push(await application(i));
// Approviamo in ordine inverso: contano gli invii, non i clic degli admin.
await login(owner);
for (const id of applications.toReversed())
  await command("approve", {
    applicationId: id,
    day: "2026-10-08",
    checks: [true, true, true],
  });
await db.exec("reset role");
const schedule = (
  await db.query(`select a.title,t.contest_day::text as "day",aa.expires_at::text expiry from public.artist_applications a
join vp_private.audio_assets aa on aa.application_id=a.id join vp_private.tracks t on t.id=aa.track_id order by a.submitted_at`)
).rows;
assert.deepEqual(
  schedule.map((row) => row.day),
  Array(5)
    .fill("2026-10-08")
    .concat(Array(5).fill("2026-10-09"), Array(2).fill("2026-10-10")),
);
assert.equal(
  new Date(schedule[11].expiry).toISOString(),
  "2026-10-10T19:00:00.000Z",
);
for (let i = 1; i <= 5; i++) {
  const id = await application(i, "Indie");
  await login(owner);
  await command("approve", {
    applicationId: id,
    day: "2026-10-08",
    checks: [true, true, true],
  });
}
// Un rifiuto non prende un posto in coda.
const rejected = await application(13);
await login(owner);
await command("reject", { applicationId: rejected, note: "Non idoneo" });
await login(listener);
await db.query(
  "select public.save_profile('Test','pulse',ARRAY['Trap','Indie','Rock','Pop','House'],true)",
);
await assert.rejects(
  db.query(
    "select public.save_profile('Test','pulse',ARRAY['Trap','Indie','Rock','Pop','House','Techno'],true)",
  ),
  /1 a 5/,
);
await db.query("select public.save_profile('Test','pulse',ARRAY['Trap'],true)");
await db.exec(
  "reset role; update public.test_clock set stamp='2026-10-08T08:00:00Z'",
);
await login(listener);
async function dashboard() {
  return (await db.query("select public.get_dashboard() value")).rows[0].value;
}
const first = await dashboard();
assert.equal(first.tracks.length, 5);
assert.ok(first.tracks.every((track) => track.genre === "Trap"));
const assigned = first.profile.rounds["2026-10-08"].ids;
await db.exec("reset role");
const titles = (
  await db.query(
    `select a.title from vp_private.daily_selections s join vp_private.tracks t on t.id=s.track_id
join vp_private.audio_assets aa on aa.track_id=t.id join public.artist_applications a on a.id=aa.application_id where s.user_id=$1 and s.day='2026-10-08' order by s.slot`,
    [listener],
  )
).rows.map((row) => row.title);
assert.deepEqual(
  new Set(titles),
  new Set([1, 2, 3, 4, 5].map((i) => `Song Trap ${i}`)),
);
await login(listener);
assert.deepEqual(
  (await dashboard()).profile.rounds["2026-10-08"].ids,
  assigned,
);
// Cambiare gusti durante il giorno non rigenera una selezione già assegnata.
await db.query(
  "select public.save_profile('Test','pulse',ARRAY['Trap','Indie'],true)",
);
assert.deepEqual(
  (await dashboard()).profile.rounds["2026-10-08"].ids,
  assigned,
);
// Nuovi utenti: cinque brani reali, casuali e tutti nei gusti scelti.
await db.exec("reset role");
const distinct = new Set();
for (let i = 0; i < 12; i++) {
  const id = `33333333-3333-3333-3333-${String(i).padStart(12, "0")}`;
  await db.query("insert into auth.users(id) values($1)", [id]);
  await login(id);
  await db.query(
    "select public.save_profile('Test','pulse',ARRAY['Trap','Indie'],true)",
  );
  const data = await dashboard();
  assert.equal(data.tracks.length, 5);
  assert.ok(
    data.tracks.every((track) => ["Trap", "Indie"].includes(track.genre)),
  );
  distinct.add(
    data.tracks
      .map((track) => track.id)
      .sort()
      .join(","),
  );
  await db.exec("reset role");
}
assert.ok(distinct.size > 1);
// Una nuova approvazione più vecchia lascia intatto il contest già iniziato.
const late = await application(0);
await login(owner);
const result = await command("approve", {
  applicationId: late,
  day: "2026-10-09",
  checks: [true, true, true],
});
assert.equal(result.contestDay, "2026-10-09");
const admin = await command("dashboard", {});
assert.ok(
  admin.applications.some(
    (a) => a.requestedDay === "2026-10-08" && a.contestDay === "2026-10-10",
  ),
);
await login(listener);
assert.deepEqual(
  (await dashboard()).profile.rounds["2026-10-08"].ids,
  assigned,
);
await db.close();
console.log(
  "OK coda FIFO 5/5/2, approvazioni inverse, audio conservato, rifiuti, preferenze 1–5, generi, sorteggio personale e selezione stabile.",
);
