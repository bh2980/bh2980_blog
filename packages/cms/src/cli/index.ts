import { parseArgs } from "node:util";
import { formatInitReport, initProject } from "./init";
import { migrate } from "./migrate";

/**
 * 명령줄 `cms`(패키지 `bin`). `bin/cms.mjs`가 tsx를 건 뒤 부른다.
 *
 * - `cms init [--admin-path /admin]`: Next 앱에 설정·라우트 파일을 만들고 tsconfig·CSS·next 설정을 잇는다.
 * - `cms migrate [--env-file .env.local] [--no-env-file] [--config <파일>] [--server <파일>]`: DB 표를 만든다.
 */

export { type ConfigPaths, parseJsonc, resolveConfigPaths } from "./config-paths";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env";
export { formatInitReport, type InitOptions, type InitReport, initProject } from "./init";
export { type MigrateOptions, migrate } from "./migrate";

const HELP = `사용법: cms <명령> [옵션]

명령:
  init      Next 앱에 CMS 파일을 만든다(있는 파일은 덮어쓰지 않는다)
              --admin-path <경로>   관리자 화면 경로(기본 /admin)
  migrate   서버 설정의 DB에 표를 만들거나 최신 모양으로 맞춘다
              --env-file <파일>     읽을 환경 파일(여러 번 가능, 기본 .env.local·.env)
              --no-env-file         환경 파일을 읽지 않는다
              --config <파일>       사이트 설정(기본: tsconfig paths의 @cms-config, ./cms.config.ts, ./src/cms.config.ts)
              --server <파일>       서버 설정(기본: 같은 순서로 cms.server.ts)
`;

export interface CliIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
}

/** 명령을 돌리고 종료 코드를 돌려준다. */
export async function runCli(
	argv: readonly string[],
	io: CliIo = { cwd: process.cwd(), log: console.log, error: console.error },
): Promise<number> {
	const [command, ...rest] = argv;
	try {
		if (command === "init") {
			const { values } = parseArgs({ args: [...rest], options: { "admin-path": { type: "string" } } });
			io.log(formatInitReport(initProject({ cwd: io.cwd, adminPath: values["admin-path"] })));
			return 0;
		}
		if (command === "migrate") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					"env-file": { type: "string", multiple: true },
					"no-env-file": { type: "boolean" },
					config: { type: "string" },
					server: { type: "string" },
				},
			});
			const ok = await migrate({
				cwd: io.cwd,
				envFiles: values["no-env-file"] ? [] : values["env-file"],
				config: values.config,
				server: values.server,
				log: io.log,
			});
			return ok ? 0 : 1;
		}
		if (command === undefined || command === "help" || command === "--help" || command === "-h") {
			io.log(HELP);
			return 0;
		}
		io.error(`알 수 없는 명령: ${command}\n\n${HELP}`);
		return 1;
	} catch (error) {
		io.error(error instanceof Error ? error.message : String(error));
		return 1;
	}
}
