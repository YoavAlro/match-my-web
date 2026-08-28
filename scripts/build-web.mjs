import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outdir = path.join(root, "dist-web");

await rm(outdir, { recursive: true, force: true });
await mkdir(path.join(outdir, "assets"), { recursive: true });
await cp(path.join(root, "web"), outdir, { recursive: true });
await cp(
  path.join(root, "assets", "tweaksy-mark.svg"),
  path.join(outdir, "assets", "tweaksy-mark.svg"),
);

await build({
  entryPoints: { app: "src/web/main.ts" },
  bundle: true,
  format: "esm",
  target: "es2022",
  outdir,
  sourcemap: true,
  minify: false,
  logLevel: "info",
});

console.log(`Built Tweaksy Live at ${outdir}`);
