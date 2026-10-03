import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_ADMIN_PATH, isAdminPath } from "../config/define";
import { CONFIG_ALIAS, parseJsonc, SERVER_ALIAS } from "./config-paths";
import {
	ADMIN_LAYOUT_TEMPLATE,
	ADMIN_PAGE_TEMPLATE,
	API_ROUTE_TEMPLATE,
	CSS_LINES,
	configTemplate,
	ENV_VARS,
	INSTALL_COMMANDS,
	nextConfigTemplate,
	SERVER_TEMPLATE,
} from "./templates";

export interface InitOptions {
	/** Next 앱 폴더(`package.json`이 있는 곳). */
	readonly cwd: string;
	/** 관리자 화면 경로(기본 `/admin`). 다르면 사이트 설정에 `admin.path`를 적고 라우트 폴더도 그 경로로 만든다. */
	readonly adminPath?: string;
}

export interface InitReport {
	/** 새로 만든 파일(`cwd` 기준). */
	readonly created: string[];
	/** 이미 있어 그대로 둔 파일. 덮어쓰지 않는다. */
	readonly skipped: string[];
	/** 고친 파일(tsconfig `paths`·전역 CSS·next 설정). */
	readonly updated: string[];
	/** 직접 할 일(자동으로 못 고친 것·설치·환경 변수·다음 단계). */
	readonly todo: string[];
}

/** 경로를 `/`로 잇는다(보고와 설정 값은 운영체제와 상관없이 같다). */
const posix = (file: string) => file.split(path.sep).join("/");
const dotted = (file: string) => (file.startsWith(".") ? file : `./${file}`);

const CSS_CANDIDATES = ["app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css"];
const NEXT_CONFIGS = ["next.config.ts", "next.config.mjs", "next.config.js"];

/**
 * `cms init`: Next 앱에 CMS를 붙이는 파일을 만든다. **있는 파일은 덮어쓰지 않고** 건너뛴 것으로 알린다.
 * 만드는 것: 사이트·서버 설정, 관리자 라우트(페이지·레이아웃), 관리자 API 라우트(로그인 포함).
 * 고치는 것(안전할 때만): tsconfig `paths`, 전역 CSS의 스타일 줄, 기본 모양의 next 설정. 못 고치면 할 일로 알린다.
 */
export function initProject(options: InitOptions): InitReport {
	const { cwd } = options;
	const adminPath = options.adminPath ?? DEFAULT_ADMIN_PATH;
	if (!isAdminPath(adminPath)) {
		throw new Error(`--admin-path "${adminPath}" must be a path like "/admin" (not "/" and not under "/api")`);
	}
	if (!existsSync(path.join(cwd, "package.json"))) {
		throw new Error("package.json not found; run `cms init` in the Next app folder");
	}

	const report: InitReport = { created: [], skipped: [], updated: [], todo: [] };
	const exists = (file: string) => existsSync(path.join(cwd, file));
	const read = (file: string) => readFileSync(path.join(cwd, file), "utf8");
	const write = (file: string, content: string) => {
		mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
		writeFileSync(path.join(cwd, file), content);
	};
	const create = (file: string, content: string) => {
		if (exists(file)) report.skipped.push(posix(file));
		else {
			write(file, content);
			report.created.push(posix(file));
		}
	};

	// `src/app`을 쓰는 앱은 설정 파일도 `src/`에 둔다.
	const useSrc = exists("src/app");
	const appDir = useSrc ? "src/app" : "app";
	const configFile = useSrc ? "src/cms.config.ts" : "cms.config.ts";
	const serverFile = useSrc ? "src/cms.server.ts" : "cms.server.ts";
	if (!exists(appDir))
		report.todo.push(`App Router 폴더(${appDir})가 없어 새로 만들었다. Next App Router 앱인지 확인한다.`);

	const hadConfig = exists(configFile);
	create(configFile, configTemplate(adminPath));
	if (hadConfig && adminPath !== DEFAULT_ADMIN_PATH && !read(configFile).includes(adminPath)) {
		report.todo.push(`${configFile}에 admin: { path: "${adminPath}" }를 적는다(관리자 라우트 폴더와 같아야 한다).`);
	}
	create(serverFile, SERVER_TEMPLATE);
	const adminDir = posix(path.join(appDir, "(admin)", ...adminPath.split("/").filter(Boolean), "[[...path]]"));
	create(`${adminDir}/page.tsx`, ADMIN_PAGE_TEMPLATE);
	create(
		posix(path.join(appDir, "(admin)", ...adminPath.split("/").filter(Boolean), "layout.tsx")),
		ADMIN_LAYOUT_TEMPLATE,
	);
	create(`${appDir}/api/cms/[...path]/route.ts`, API_ROUTE_TEMPLATE);

	addTsconfigPaths(cwd, { [CONFIG_ALIAS]: configFile, [SERVER_ALIAS]: serverFile }, report);
	addCssLines(cwd, report);
	addWithCms(cwd, dotted(configFile), dotted(serverFile), report);

	report.todo.push(
		`패키지 설치: ${INSTALL_COMMANDS.join(" && ")}`,
		[".env.local에 둘 값:", ...ENV_VARS.map((env) => `  ${env.name.padEnd(20)} ${env.note}`)].join("\n"),
		"GitHub OAuth 앱 콜백 주소: <사이트 주소>/api/cms/auth/callback/github",
		`${configFile}에서 컬렉션을 고친 뒤 \`cms migrate\`로 DB 표를 만들고, next dev에서 ${adminPath}를 연다.`,
	);
	return report;
}

/** tsconfig `paths`에 설정 별칭을 더한다. 주석 없는 JSON일 때만 고치고, 이미 있는 별칭은 그대로 둔다. */
function addTsconfigPaths(cwd: string, aliases: Readonly<Record<string, string>>, report: InitReport): void {
	const file = path.join(cwd, "tsconfig.json");
	const manual = () =>
		`tsconfig.json compilerOptions.paths에 ${Object.entries(aliases)
			.map(([alias, target]) => `"${alias}": ["${dotted(target)}"]`)
			.join(", ")}를 더한다.`;
	if (!existsSync(file)) {
		report.todo.push(manual());
		return;
	}
	const text = readFileSync(file, "utf8");
	let json: { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
	try {
		json = JSON.parse(text);
	} catch {
		// 주석·끝 쉼표가 있으면 다시 쓰면서 지우게 되므로 고치지 않는다.
		const parsed = parseJsonc(text) as typeof json | undefined;
		const paths = parsed?.compilerOptions?.paths ?? {};
		if (Object.keys(aliases).every((alias) => paths[alias])) report.skipped.push("tsconfig.json");
		else report.todo.push(manual());
		return;
	}
	json.compilerOptions ??= {};
	json.compilerOptions.paths ??= {};
	const base = path.resolve(cwd, json.compilerOptions.baseUrl ?? ".");
	let changed = false;
	for (const [alias, target] of Object.entries(aliases)) {
		if (json.compilerOptions.paths[alias]) continue;
		json.compilerOptions.paths[alias] = [dotted(posix(path.relative(base, path.join(cwd, target))))];
		changed = true;
	}
	if (!changed) {
		report.skipped.push("tsconfig.json");
		return;
	}
	const indent = /^\{\r?\n(\s+)/.exec(text)?.[1] ?? "\t";
	// 한 값짜리 배열(`["./x"]`)은 한 줄로 둔다(Next가 만든 tsconfig 모양).
	const out = JSON.stringify(json, null, indent).replace(/\[\s*("(?:[^"\\]|\\.)*")\s*\]/g, "[$1]");
	writeFileSync(file, `${out}\n`);
	report.updated.push("tsconfig.json");
}

/** 전역 CSS(Tailwind 입력)에 관리자 스타일 줄을 더한다. 마지막 `@import` 다음에 넣고, 이미 있는 줄은 넣지 않는다. */
function addCssLines(cwd: string, report: InitReport): void {
	const file = CSS_CANDIDATES.find((candidate) => existsSync(path.join(cwd, candidate)));
	const manual = `전역 CSS(Tailwind 입력)의 @import "tailwindcss"; 다음에 넣는다: ${CSS_LINES.join(" ")}`;
	if (!file) {
		report.todo.push(manual);
		return;
	}
	const text = readFileSync(path.join(cwd, file), "utf8");
	if (!/@import\s+["']tailwindcss["']/.test(text)) {
		report.todo.push(`${file}에 Tailwind CSS 4(@import "tailwindcss";)가 없다. Tailwind 4를 설치한 뒤 ${manual}`);
		return;
	}
	const missing = CSS_LINES.filter((line) => !text.includes(line.replace(/;$/, "")));
	if (missing.length === 0) {
		report.skipped.push(file);
		return;
	}
	const lines = text.split("\n");
	let last = -1;
	lines.forEach((line, index) => {
		if (/^@import\s/.test(line.trim())) last = index;
	});
	lines.splice(last + 1, 0, "/* @bh2980/cms 관리자 화면 */", ...missing);
	writeFileSync(path.join(cwd, file), lines.join("\n"));
	report.updated.push(file);
}

/** next 설정을 `withCms`로 감싼다. 기본 모양(`export default nextConfig;` 한 줄)일 때만 고치고, 없으면 만든다. */
function addWithCms(cwd: string, config: string, server: string, report: InitReport): void {
	const file = NEXT_CONFIGS.find((candidate) => existsSync(path.join(cwd, candidate)));
	if (!file) {
		writeFileSync(path.join(cwd, "next.config.ts"), nextConfigTemplate(config, server));
		report.created.push("next.config.ts");
		return;
	}
	const text = readFileSync(path.join(cwd, file), "utf8");
	if (text.includes("withCms")) {
		report.skipped.push(file);
		return;
	}
	const exportLine = /^export default nextConfig;?[ \t]*$/m;
	const exports = text.match(new RegExp(exportLine.source, "gm")) ?? [];
	if (exports.length !== 1) {
		report.todo.push(
			`${file}의 설정을 감싼다: import { withCms } from "@bh2980/cms/next"; export default withCms(nextConfig, { config: "${config}", server: "${server}" });`,
		);
		return;
	}
	const importLine = 'import { withCms } from "@bh2980/cms/next";\n';
	const replaced = text.replace(
		exportLine,
		`export default withCms(nextConfig, { config: "${config}", server: "${server}" });`,
	);
	writeFileSync(path.join(cwd, file), `${importLine}${replaced}`);
	report.updated.push(file);
}

/** 보고를 사람이 읽는 글로. */
export function formatInitReport(report: InitReport): string {
	const section = (title: string, items: readonly string[]) =>
		items.length === 0 ? [] : [title, ...items.map((item) => `  - ${item.replaceAll("\n", "\n    ")}`), ""];
	return [
		...section("만든 파일:", report.created),
		...section("고친 파일:", report.updated),
		...section("이미 있어 건너뛴 파일(덮어쓰지 않음):", report.skipped),
		...section("할 일:", report.todo),
	]
		.join("\n")
		.trimEnd();
}
