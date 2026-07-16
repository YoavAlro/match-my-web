import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const watch = process.argv.includes("--watch");
const root = process.cwd();
const outdir = path.join(root, "dist");

await rm(outdir, { recursive: true, force: true });
await mkdir(path.join(outdir, "icons"), { recursive: true });
await cp(path.join(root, "public"), outdir, { recursive: true });

const icon = path.join(root, "assets", "match-my-web-mark.svg");
await Promise.all(
  [16, 32, 48, 128].map((size) =>
    sharp(icon).resize(size, size).png().toFile(path.join(outdir, "icons", `icon-${size}.png`)),
  ),
);

const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    "main-world": "src/main-world.ts",
    sidepanel: "src/sidepanel.ts"
  },
  bundle: true,
  format: "iife",
  target: "chrome114",
  outdir,
  sourcemap: true,
  minify: false,
  logLevel: "info"
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("Watching Match My Web sources…");
} else {
  await build(options);
}
