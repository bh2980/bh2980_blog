/**
 * M8-DA-1 변환 CLI — 레거시 JSX를 §4.4 directive로 바꾼다.
 *
 *   pnpm cms:convert            # 기본이 --check: 바뀔 파일·개수·잔여 이름·분석 오류만 보고한다
 *   pnpm cms:convert --write    # 실제로 파일을 쓴다(한 커밋으로 만들 것)
 *
 * 검사 항목(배치 2 완료 조건):
 * - 변환 후 `analyze` 오류 0
 * - 등록 이름인데 변환하지 못한 JSX 0(`leftovers`)
 * - 산문에 남은 등록 컴포넌트 태그 0
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyze } from "@/cms/mdx";
import { convertLegacySource, type LegacyConversionCounts } from "./legacy-jsx-to-directive";

const args = process.argv.slice(2);
const write = args.includes("--write");
const rootFlag = args.indexOf("--root");
const root = path.resolve(rootFlag >= 0 ? (args[rootFlag + 1] ?? process.cwd()) : process.cwd());
const contentsRoot = path.join(root, "src", "contents");

type FileReport = {
	path: string;
	changed: boolean;
	counts: LegacyConversionCounts;
	leftovers: string[];
	errors: string[];
};

const listFiles = (): string[] =>
	["posts", "memos"].flatMap((kind) =>
		readdirSync(path.join(contentsRoot, kind))
			.filter((file) => file.endsWith(".mdx"))
			.sort()
			.map((file) => path.join(kind, file)),
	);

const report: FileReport[] = [];
const totals: LegacyConversionCounts = {};

for (const relative of listFiles()) {
	const absolute = path.join(contentsRoot, relative);
	const source = readFileSync(absolute, "utf8");
	const result = convertLegacySource(source);
	const changed = result.source !== source;

	for (const [key, value] of Object.entries(result.counts)) {
		totals[key] = (totals[key] ?? 0) + value;
	}

	const errors = changed ? analyze(result.source, relative).errors.map((error) => error.message) : [];
	report.push({ path: relative, changed, counts: result.counts, leftovers: result.leftovers, errors });

	if (write && changed) writeFileSync(absolute, result.source, "utf8");
}

const changedFiles = report.filter((file) => file.changed);
const withLeftovers = report.filter((file) => file.leftovers.length > 0);
const withErrors = report.filter((file) => file.errors.length > 0);

console.log(`검사 대상: ${report.length}편 · ${write ? "변환" : "변환 예정"}: ${changedFiles.length}편`);
console.log("컴포넌트 합계:", JSON.stringify(totals));

for (const file of changedFiles) {
	console.log(`  ${file.path} — ${JSON.stringify(file.counts)}`);
}
for (const file of withLeftovers) {
	console.log(`  [잔여] ${file.path} — ${file.leftovers.join(", ")}`);
}
for (const file of withErrors) {
	console.log(`  [분석 오류] ${file.path} — ${file.errors.join(" / ")}`);
}

if (withLeftovers.length > 0 || withErrors.length > 0) {
	console.error("변환 실패: 잔여 이름 또는 분석 오류가 있습니다.");
	process.exit(1);
}

console.log(write ? "변환 완료." : "검사 통과(잔여 이름 0 · 분석 오류 0).");
