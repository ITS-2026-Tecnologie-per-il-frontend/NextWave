import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create schema storage;
create table auth.users(id uuid primary key, email text unique, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,storage to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated;
grant select on storage.objects to anon;
`);
for (const file of (await readdir("supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
}
const owner = "11111111-1111-1111-1111-111111111111";
const admin = "22222222-2222-2222-2222-222222222222";
const regular = "33333333-3333-3333-3333-333333333333";
const oldPath = `${admin}/profile.png`;
const newPath = `${admin}/profile-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.webp`;
await db.query(
  "insert into auth.users(id,email,email_confirmed_at) values ($1,'santonithomas9@gmail.com',now()),($2,'admin@example.com',now()),($3,'listener@example.com',now())",
  [owner, admin, regular],
);
async function login(id) {
  await db.exec(
    `reset role; set role authenticated; set request.jwt.claim.sub='${id}';`,
  );
}
async function command(action, data = {}) {
  return (
    await db.query("select public.admin_console($1,$2::jsonb) value", [
      action,
      JSON.stringify(data),
    ])
  ).rows[0].value;
}
async function paths() {
  return (
    await db.query("select name from storage.objects order by name")
  ).rows.map((row) => row.name);
}
await login(owner);
await command("grant", { email: "ADMIN@example.com" });
await login(admin);
await db.query("select public.set_avatar_path($1)", [oldPath]);
await db.query("select public.set_avatar_path($1)", [newPath]);
await assert.rejects(
  db.query("select public.set_avatar_path($1)", [`${regular}/profile.png`]),
  /Percorso immagine/,
);
await db.exec("reset role");
await db.query(
  "update public.profiles set display_name='Nome attuale',avatar_position_x=25,avatar_position_y=75 where id=$1",
  [admin],
);
await db.query("update public.profiles set avatar_path=$2 where id=$1", [
  regular,
  `${regular}/profile.png`,
]);
for (const path of [oldPath, newPath, `${regular}/profile.png`])
  await db.query("insert into storage.objects values ('nextwave-avatars',$1)", [
    path,
  ]);
await db.query("insert into storage.objects values ('nextwave-audio',$1)", [
  newPath,
]);
await login(owner);
const account = (await command("dashboard")).accounts.find(
  (account) => account.id === admin,
);
assert.equal(account.name, "Nome attuale");
assert.equal(account.avatarPath, newPath);
assert.equal(account.avatarPositionX, 25);
assert.equal(account.avatarPositionY, 75);
assert.deepEqual(await paths(), [newPath]);
assert.equal(
  (
    await db.query(
      "update storage.objects set name='changed' where name=$1 returning name",
      [newPath],
    )
  ).rows.length,
  0,
);
assert.equal(
  (
    await db.query("delete from storage.objects where name=$1 returning name", [
      newPath,
    ])
  ).rows.length,
  0,
);
await login(admin);
assert.deepEqual((await command("dashboard")).accounts, []);
assert.equal(
  (await db.query("select public.can_view_admin_avatar($1) value", [oldPath]))
    .rows[0].value,
  false,
);
assert.deepEqual(await paths(), [newPath, oldPath].sort());
await login(regular);
assert.deepEqual(await paths(), [`${regular}/profile.png`]);
await assert.rejects(command("dashboard"), /Accesso non autorizzato/);
await db.exec("reset role; set role anon");
assert.deepEqual(await paths(), []);
await assert.rejects(
  db.query("select public.can_view_admin_avatar($1)", [newPath]),
  /permission denied/,
);
await login(owner);
await login(admin);
await db.query(
  "select public.save_profile('Nome aggiornato', 'pulse', ARRAY['Rap'], true)",
);
await db.query("select public.set_avatar_path(null)");
await login(owner);
const changedAccount = (await command("dashboard")).accounts.find(
  (account) => account.id === admin,
);
assert.equal(changedAccount.name, "Nome aggiornato");
assert.equal(changedAccount.avatarPath, null);
assert.deepEqual(await paths(), []);
await login(admin);
await db.query("select public.set_avatar_path($1)", [newPath]);
await login(owner);
await command("revoke", { userId: admin });
assert.deepEqual(await paths(), []);
assert.equal(
  (await command("dashboard")).accounts.some((account) => account.id === admin),
  false,
);
await db.exec("reset role");
assert.equal(
  (
    await db.query(
      "select public from storage.buckets where id='nextwave-avatars'",
    )
  ).rows[0].public,
  false,
);
await db.close();
console.log(
  "OK nomi e avatar correnti, percorsi versionati, grant via email, revoca, bucket privato, RLS di lettura e divieto di modifica degli avatar altrui.",
);
