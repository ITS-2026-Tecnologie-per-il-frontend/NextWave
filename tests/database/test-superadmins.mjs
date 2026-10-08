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

const emails = [
  "santonithomas9@gmail.com",
  "lorenzo.petraccini06@gmail.com",
  "alessiolimongelli99@gmail.com",
];
const ids = emails.map(
  (_, i) => "11111111-1111-1111-1111-11111111111" + (i + 1),
);
const regular = "22222222-2222-2222-2222-222222222222";
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
for (let i = 0; i < ids.length; i++) {
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values ($1,$2,null)",
    [ids[i], emails[i].toUpperCase()],
  );
  await login(ids[i]);
  assert.deepEqual(await access(), { allowed: false, owner: false });
  await assert.rejects(command("dashboard"), /Accesso non autorizzato/);
  await db.exec("reset role");
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    ids[i],
  ]);
  await db.query(
    "update public.profiles set display_name=$2,avatar_path=$3 where id=$1",
    [ids[i], "Superadmin " + i, ids[i] + "/profile.png"],
  );
  await db.query("insert into storage.objects values ('nextwave-avatars',$1)", [
    ids[i] + "/profile.png",
  ]);
}
await db.query(
  "insert into auth.users(id,email,email_confirmed_at) values ($1,'moderator@example.com',now())",
  [regular],
);
for (const id of ids) {
  await login(id);
  assert.deepEqual(await access(), { allowed: true, owner: true });
  const accounts = (await command("dashboard")).accounts;
  assert.equal(accounts.length, 3);
  assert.ok(
    accounts.every(
      (account) => account.owner && account.name && account.avatarPath,
    ),
  );
  assert.equal(
    (await db.query("select name from storage.objects")).rows.length,
    3,
  );
  await command("grant", { email: "MODERATOR@example.com" });
  await login(regular);
  assert.deepEqual(await access(), { allowed: true, owner: false });
  assert.deepEqual((await command("dashboard")).accounts, []);
  await assert.rejects(command("grant", { email: emails[0] }), /Solo/);
  await login(id);
  for (let i = 0; i < ids.length; i++) {
    await assert.rejects(
      command("revoke", { userId: ids[i] }),
      /non può essere modificato/,
    );
    await assert.rejects(
      command("grant", { email: emails[i] }),
      /non può essere modificato/,
    );
  }
  await command("revoke", { userId: regular });
  await login(regular);
  assert.deepEqual(await access(), { allowed: false, owner: false });
}
await db.exec("reset role");
for (const id of ids) {
  await assert.rejects(
    db.query("delete from auth.users where id=$1", [id]),
    /non può essere eliminato/,
  );
  await assert.rejects(
    db.query("update auth.users set email='changed@example.com' where id=$1", [
      id,
    ]),
    /non può essere modificata/,
  );
  await db.query("update auth.users set email=lower(email) where id=$1", [id]);
}
await login(regular);
await assert.rejects(
  db.query("select vp_private.is_superadmin_email('santonithomas9@gmail.com')"),
  /permission denied/,
);
await db.close();
console.log(
  "Superadmin: tre account, conferma email, gestione accessi, identità/avatar e protezioni verificati.",
);
