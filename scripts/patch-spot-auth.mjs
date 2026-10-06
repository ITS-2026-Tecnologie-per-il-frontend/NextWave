import { readFile, writeFile } from "node:fs/promises";
// Adaptations audited against spot-auth 0.1.0. Fail closed on upstream changes.
const root = new URL("../node_modules/spot-auth/", import.meta.url);
const pkg = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (pkg.version !== "0.1.0")
  throw new Error("Review spot-auth before upgrading");
const path = new URL("src/react/SpotAuthContext.jsx", root);
let source = await readFile(path, "utf8");
if (!source.includes("/* Next Wave server PKCE */")) {
  const changes = [
    ["redirectUri, children })", "redirectUri, children, beforeAuthorize })"],
    [
      "const [tokenData, setTokenData] = useState(() => store.get());",
      "const [tokenData, setTokenData] = useState(() => beforeAuthorize ? null : store.get());",
    ],
    [
      "const state = Math.random().toString(36).substring(7);",
      "/* Next Wave server PKCE */\n    const state = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');",
    ],
    [
      "window.location.href = buildAuthUrl",
      "if (beforeAuthorize) await beforeAuthorize({ state });\n    window.location.href = buildAuthUrl",
    ],
  ];
  for (const [from, to] of changes) {
    if (!source.includes(from))
      throw new Error(`spot-auth source changed: ${from}`);
    source = source.replace(from, to);
  }
  await writeFile(path, source);
}
const barrierPath = new URL("src/react/SpotAuthBarrier.jsx", root);
let barrier = await readFile(barrierPath, "utf8");
if (!barrier.includes("/* Next Wave single redirect */")) {
  const changes = [
    ["import { useEffect }", "import { useEffect, useRef }"],
    ["fallback = null })", "fallback = null, onError })"],
    [
      "useEffect(() => {",
      "/* Next Wave single redirect */\n  const started = useRef(false);\n  useEffect(() => {",
    ],
    [
      "if (!isAuthenticated) {\n      triggerAuth();",
      "if (!isAuthenticated && !started.current) {\n      started.current = true;\n      triggerAuth().catch(error => onError?.(error));",
    ],
  ];
  for (const [from, to] of changes) {
    if (!barrier.includes(from))
      throw new Error(`spot-auth barrier changed: ${from}`);
    barrier = barrier.replace(from, to);
  }
  await writeFile(barrierPath, barrier);
}
console.log(
  "spot-auth 0.1.0: secure state, server handoff and single redirect applied",
);
