import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(
    entries.map((entry) => {
      const file = `${directory}/${entry.name}`;
      return entry.isDirectory() ? filesIn(file) : [file];
    }),
  );
  return children.flat();
}

// Audit locale: import statici/dinamici, file sorgente raggiungibili e collocazione hook.
const files = (
  await Promise.all(["src", "server", "api", "tests", "scripts"].map(filesIn))
)
  .flat()
  .filter((file) => /\.(js|jsx|mjs|ts|tsx|css)$/.test(file));
const graph = new Map();
const errors = [];
const sourceFolders = new Set([
  "app",
  "assets",
  "components",
  "config",
  "context",
  "data",
  "domain",
  "hooks",
  "screens",
  "services",
  "styles",
  "types",
]);
for (const entry of await readdir("src", { withFileTypes: true })) {
  if (entry.isDirectory() && !sourceFolders.has(entry.name))
    errors.push(
      `src/${entry.name}: cartella fuori dalla struttura documentata`,
    );
  if (entry.isFile() && entry.name !== "main.tsx")
    errors.push(
      `src/${entry.name}: collocare il file nella cartella della sua responsabilità`,
    );
}
for (const file of files) {
  const source = await readFile(file, "utf8");
  const dependencies = [];
  const imports = source.matchAll(
    /(?:from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']/g,
  );
  for (const [, specifier] of imports) {
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), specifier.split("?")[0]),
    );
    try {
      await access(target);
      dependencies.push(target);
    } catch {
      errors.push(`${file}: riferimento mancante ${specifier}`);
    }
  }
  graph.set(file, dependencies);
  if (
    /^src\/(components|screens|services|domain)\/[^/]+\.(tsx?|css)$/.test(file)
  )
    errors.push(`${file}: usare una sottocartella dedicata alla funzione`);
  if (/^scripts\/test-/.test(file))
    errors.push(`${file}: i test del database appartengono a tests/database/`);
  if (
    file.startsWith("src/") &&
    /export function use[A-Z]/.test(source) &&
    !file.startsWith("src/hooks/")
  ) {
    errors.push(`${file}: spostare l'hook in src/hooks/`);
  }
}

// Riferimenti locali della documentazione e risorse pubbliche: lo spostamento non deve lasciare link rotti.
for (const file of [
  "README.md",
  ...(await filesIn("docs")).filter((file) => file.endsWith(".md")),
]) {
  const source = await readFile(file, "utf8");
  for (const [, reference] of source.matchAll(/\]\(([^)]+)\)/g)) {
    if (/^(?:https?:|#|\/)/.test(reference)) continue;
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), reference.split("#")[0]),
    );
    try {
      await access(target);
    } catch {
      errors.push(`${file}: collegamento locale mancante ${reference}`);
    }
  }
}
for (const file of ["index.html", ...files]) {
  const source = await readFile(file, "utf8");
  for (const [, resource] of source.matchAll(
    /(?:src|href)\s*=\s*["'](\/(?:images|brand)\/[^"']+)["']/g,
  )) {
    try {
      await access(`public${resource}`);
    } catch {
      errors.push(`${file}: risorsa pubblica mancante ${resource}`);
    }
  }
}

const reachable = new Set();
const manifest = JSON.parse(await readFile("package.json", "utf8"));
for (const [name, command] of Object.entries(manifest.scripts)) {
  for (const [, target] of String(command).matchAll(
    /(?:node|tsx)\s+(?:--\S+\s+)*(\S+\.mjs)(?:\s|$)/g,
  )) {
    try {
      await access(target);
    } catch {
      errors.push(`package.json: comando ${name} riferisce ${target} mancante`);
    }
  }
}
const hosting = JSON.parse(await readFile("vercel.json", "utf8"));
for (const redirect of hosting.redirects ?? []) {
  if (!/^\/(?:images|brand)\//.test(redirect.destination)) continue;
  try {
    await access(`public${redirect.destination}`);
  } catch {
    errors.push(`vercel.json: destinazione mancante ${redirect.destination}`);
  }
}
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency);
}
visit("src/main.tsx");
// I moduli della precedente demo restano solo per le prove di regressione.
for (const file of files.filter((file) => file.startsWith("tests/")))
  visit(file);
for (const file of files.filter((file) => file.startsWith("src/"))) {
  if (!reachable.has(file))
    errors.push(`${file}: sorgente non raggiungibile dall'app`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Audit completato: ${files.length} moduli, import validi e nessun sorgente isolato.`,
  );
}
