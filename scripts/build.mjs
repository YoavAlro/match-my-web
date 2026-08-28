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

const icon = path.join(root, "assets", "tweaksy-mark.svg");
await Promise.all(
  [16, 32, 48, 128].flatMap((size) => [
    sharp(icon).resize(size, size).png().toFile(path.join(outdir, "icons", `icon-${size}.png`)),
    sharp(icon).resize(size, size).grayscale().modulate({ brightness: 0.82 }).png().toFile(path.join(outdir, "icons", `icon-disabled-${size}.png`)),
  ]),
);

const options = {
  entryPoints: {
    background: "src/background.ts",
    content: "src/content.ts",
    "main-world": "src/main-world.ts",
    sidepanel: "src/sidepanel.ts",
    popup: "src/popup.ts"
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
  console.log("Watching Tweaksy sources…");
} else {
  await build(options);
}
