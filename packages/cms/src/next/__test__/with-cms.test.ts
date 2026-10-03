import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { missingOptionalPeers } from "../with-cms";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

const app = (files: Record<string, object>) => {
	const dir = mkdtempSync(path.join(tmpdir(), "cms-with-"));
	dirs.push(dir);
	for (const [file, json] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), JSON.stringify(json));
	}
	return dir;
};

describe("withCms: 설치하지 않은 선택 의존성", () => {
	it("CMS 패키지의 선택 peer 중 찾을 수 없는 것만 고른다", () => {
		const dir = app({
			"package.json": { dependencies: { "@bh2980/cms-blocks": "x", "other-lib": "x" } },
			"node_modules/@bh2980/cms-blocks/package.json": {
				peerDependenciesMeta: { mermaid: { optional: true }, recharts: { optional: true }, react: {} },
			},
			"node_modules/recharts/package.json": {},
			// CMS 패키지가 아닌 라이브러리의 선택 의존성은 건드리지 않는다.
			"node_modules/other-lib/package.json": { peerDependenciesMeta: { nodemailer: { optional: true } } },
		});
		expect(missingOptionalPeers(dir)).toEqual(["mermaid"]);
	});

	it("package.json이 없거나 CMS 패키지가 없으면 빈 목록", () => {
		expect(missingOptionalPeers(app({}))).toEqual([]);
		expect(missingOptionalPeers(app({ "package.json": { dependencies: { "@bh2980/cms": "x" } } }))).toEqual([]);
	});

	it("Turbopack root 밖에 설치된 것은 없는 것으로 본다", () => {
		const outer = app({ "node_modules/mermaid/package.json": {} });
		const root = path.join(outer, "site");
		mkdirSync(path.join(root, "node_modules/@bh2980/cms-blocks"), { recursive: true });
		writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { "@bh2980/cms-blocks": "x" } }));
		writeFileSync(
			path.join(root, "node_modules/@bh2980/cms-blocks/package.json"),
			JSON.stringify({ peerDependenciesMeta: { mermaid: { optional: true } } }),
		);
		expect(missingOptionalPeers(root)).toEqual([]);
		expect(missingOptionalPeers(root, realpathSync(root))).toEqual(["mermaid"]);
	});
});
