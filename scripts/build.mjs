import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist");

rmSync(output, { force: true, recursive: true });

const compilation = spawnSync(
	process.execPath,
	[join(root, "node_modules", "typescript", "bin", "tsc"), "-p", join(root, "tsconfig.build.json")],
	{ stdio: "inherit" },
);

if (compilation.error) throw compilation.error;
if (compilation.status !== 0) process.exit(compilation.status ?? 1);

const nativeOutput = join(output, "spi_bindings", "libs");
mkdirSync(dirname(nativeOutput), { recursive: true });
cpSync(join(root, "spi_bindings", "libs"), nativeOutput, { recursive: true });
