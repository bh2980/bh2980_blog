import path from "node:path";
import { runApply, runInspect } from "./migration-runner";

const args = process.argv.slice(2);
const command = args[0] ?? "inspect";

const readFlag = (name: string): string | undefined => {
	const index = args.indexOf(`--${name}`);
	if (index < 0) return undefined;
	const value = args[index + 1];
	return value && !value.startsWith("--") ? value : undefined;
};

const root = path.resolve(readFlag("root") ?? process.cwd());
const out = readFlag("out");
const schemaName = readFlag("schema");

async function main(): Promise<void> {
	if (command === "inspect") {
		runInspect({ root, ...(out ? { out } : {}) });
		return;
	}
	if (command === "apply") {
		await runApply({
			root,
			dryRun: args.includes("--dry-run"),
			reuseSchema: args.includes("--reuse"),
			...(out ? { out } : {}),
			...(schemaName ? { schemaName } : {}),
		});
		return;
	}

	console.error(
		[
			"사용법:",
			"  tsx src/cms/migrate-from-files/cli.ts inspect [--out <path>] [--root <dir>]",
			"  tsx src/cms/migrate-from-files/cli.ts apply [--dry-run] [--reuse] [--schema cms_m6_xxx] [--out <path>]",
			"",
			"apply는 CMS_TEST_DATABASE_URL과 cms_m6_* 격리 schema만 사용하고, CMS_MIGRATION_ALLOW=1 일 때만 실행한다.",
		].join("\n"),
	);
	process.exit(1);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
