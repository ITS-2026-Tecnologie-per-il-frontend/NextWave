import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;`);
for (const file of (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
}
const owner = "11111111-1111-1111-1111-111111111111";
const moderator = "22222222-2222-2222-2222-222222222222";
const regular = "33333333-3333-3333-3333-333333333333";
const unverified = "44444444-4444-4444-4444-444444444444";
await db.query(
  `insert into auth.users(id,email,email_confirmed_at) values
($1,'santonithomas9@gmail.com',null),($2,'moderator@example.com',now()),($3,'santonithomas737@gmail.com',now()),($4,'unverified@example.com',null)`,
  [owner, moderator, regular, unverified],
);
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function access() {
  return (await db.query("select public.get_admin_access() value")).rows[0]
    .value;
}
async function command(action, data = {}) {
  return (
    await db.query("select public.admin_console($1,$2::jsonb) value", [
      action,
      JSON.stringify(data),
    ])
  ).rows[0].value;
}
await login(owner);
assert.equal((await access()).allowed, false);
await db.exec("reset role");
await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
  owner,
]);
await login(regular);
assert.deepEqual(await access(), { allowed: false, owner: false });
for (const action of [
  "dashboard",
  "preview",
  "approve",
  "reject",
  "grant",
  "revoke",
]) {
  await assert.rejects(
    command(action, { email: "moderator@example.com" }),
    /Accesso non autorizzato/,
  );
}
await assert.rejects(
  db.query("select * from vp_private.admin_accounts"),
  /permission denied/,
);
await assert.rejects(
  db.query("select public.audio_server('review-list')"),
  /permission denied/,
);
await login(owner);
assert.deepEqual(await access(), { allowed: true, owner: true });
await assert.rejects(
  command("grant", { email: "unverified@example.com" }),
  /confermare/,
);
await assert.rejects(
  command("grant", { email: "unknown@example.com" }),
  /registrarsi/,
);
await command("grant", { email: "MODERATOR@example.com" });
await command("grant", { email: "moderator@example.com" });
assert.equal((await command("dashboard")).accounts.length, 2);
await assert.rejects(
  command("revoke", { userId: owner }),
  /non può essere modificato/,
);
await db.exec("reset role");
await assert.rejects(
  db.query("delete from auth.users where id=$1", [owner]),
  /non può essere eliminato/,
);
await assert.rejects(
  db.query("update auth.users set email='changed@example.com' where id=$1", [
    owner,
  ]),
  /non può essere modificata/,
);
// Gli altri account rimangono modificabili ed eliminabili.
await db.query("delete from auth.users where id=$1", [unverified]);
assert.equal(
  (
    await db.query("select count(*)::int n from auth.users where id=$1", [
      unverified,
    ])
  ).rows[0].n,
  0,
);
const application = (
  await db.query(
    `insert into public.artist_applications(user_id,artist,title,listeners,genre,language,subgenre,mood,spotify_id,rights_confirmed)
values($1,'Artist','Song',50,'Pop','Italiano','Pop','Intimo','1234567890123456789012',true) returning id`,
    [regular],
  )
).rows[0].id;
await db.query(
  "insert into vp_private.audio_assets(application_id,user_id,state,duration,bytes,expires_at) values($1,$2,'ready',12,1000,now()+interval '7 days')",
  [application, regular],
);
await login(moderator);
assert.deepEqual(await access(), { allowed: true, owner: false });
assert.equal((await command("dashboard")).accounts.length, 0);
await assert.rejects(
  command("grant", { email: "santonithomas737@gmail.com" }),
  /Solo l’amministratore/,
);
await assert.rejects(
  command("revoke", { userId: owner }),
  /Solo l’amministratore/,
);
assert.match(
  (await command("preview", { applicationId: application })).path,
  /^tracks\/.+\.mp3$/,
);
const tomorrow = (
  await db.query(
    "select ((clock_timestamp() at time zone 'Europe/Rome')::date+1)::text as day",
  )
).rows[0].day;
await assert.rejects(
  command("approve", { applicationId: application, day: tomorrow }),
  /tutte le verifiche/,
);
await assert.rejects(
  command("approve", {
    applicationId: application,
    day: "2020-01-01",
    checks: [true, true, true],
  }),
  /contest futuro/,
);
await assert.rejects(
  command("reject", { applicationId: application, note: "" }),
  /motivo del rifiuto/,
);
const approved = await command("approve", {
  applicationId: application,
  day: tomorrow,
  checks: [true, true, true],
  note: "Verificato",
});
assert.ok(approved.trackId);
await assert.rejects(
  command("approve", {
    applicationId: application,
    day: tomorrow,
    checks: [true, true, true],
  }),
  /già esaminata/,
);
await db.exec("reset role");
const reviewed = (
  await db.query(
    "select status,reviewed_by,review_note from public.artist_applications where id=$1",
    [application],
  )
).rows[0];
assert.deepEqual(reviewed, {
  status: "approved",
  reviewed_by: moderator,
  review_note: "Verificato",
});
const rejectedApplication = (
  await db.query(
    `insert into public.artist_applications(user_id,artist,title,listeners,genre,language,subgenre,mood,spotify_id,rights_confirmed)
values($1,'Artist','Second song',50,'Pop','Italiano','Pop','Intimo','2234567890123456789012',true) returning id`,
    [regular],
  )
).rows[0].id;
await db.query(
  "insert into vp_private.audio_assets(application_id,user_id,state,duration,bytes,expires_at) values($1,$2,'ready',12,1000,now()+interval '7 days')",
  [rejectedApplication, regular],
);
await login(moderator);
await command("reject", {
  applicationId: rejectedApplication,
  note: "Audio diverso dal link Spotify",
});
await db.exec("reset role");
assert.equal(
  (
    await db.query(
      "select status from public.artist_applications where id=$1",
      [rejectedApplication],
    )
  ).rows[0].status,
  "rejected",
);
assert.equal(
  (
    await db.query(
      "select count(*)::int n from vp_private.audio_assets where application_id=$1 and track_id is not null",
      [rejectedApplication],
    )
  ).rows[0].n,
  0,
);
await login(owner);
await command("revoke", { userId: moderator });
await login(moderator);
assert.equal((await access()).allowed, false);
await assert.rejects(command("dashboard"), /Accesso non autorizzato/);
await db.exec("reset role; set role anon");
await assert.rejects(
  db.query("select public.admin_console('dashboard')"),
  /permission denied/,
);
await assert.rejects(
  db.query("select public.get_admin_access()"),
  /permission denied/,
);
await db.close();
console.log(
  "OK admin: accesso verificato, superadmin protetto, concessione/revoca, revisione e programmazione, isolamento utenti e anonimi.",
);
