import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "dist-web");
const destination = path.join(root, "site-public");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(path.join(source, "app.js"), path.join(destination, "app.js"));
await cp(path.join(source, "app.css"), path.join(destination, "app.css"));
await cp(path.join(source, "assets"), path.join(destination, "assets"), { recursive: true });

console.log(`Staged Tweaksy Live assets at ${destination}`);
