import { runMigrate } from "./run-migrate";

/**
 * 예전 진입점(`import "@bh2980/cms/migrate"`): 불러오면 바로 표를 만든다. 새 앱은 명령줄 `cms migrate`를 쓴다.
 *
 * ```sh
 * tsx --env-file=.env.local --import @bh2980/cms/register migrate.ts   # migrate.ts: import "@bh2980/cms/migrate";
 * ```
 */
void runMigrate().then((ok) => {
	if (!ok) process.exitCode = 1;
});
