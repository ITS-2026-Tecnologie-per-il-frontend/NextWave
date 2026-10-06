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
const files = (await Promise.all(["src", "tests", "scripts"].map(filesIn)))
  .flat()
  .filter((file) => /\.(js|jsx|mjs|ts|tsx)$/.test(file));
const graph = new Map();
const errors = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const dependencies = [];
  const imports = source.matchAll(
    /(?:from\s*|import\s*\(\s*|import\s*)["'](\.[^"']+)["']/g,
  );
  for (const [, specifier] of imports) {
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(file), specifier),
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
    file.startsWith("src/") &&
    /export function use[A-Z]/.test(source) &&
    !file.startsWith("src/hooks/")
  ) {
    errors.push(`${file}: spostare l'hook in src/hooks/`);
  }
}

const reachable = new Set();
function visit(file) {
  if (reachable.has(file)) return;
  reachable.add(file);
  for (const dependency of graph.get(file) ?? []) visit(dependency);
}
visit("src/main.tsx");
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
