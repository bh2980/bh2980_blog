import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * M7-BE-4: `docs/cms/openapi.yaml`과 실제 라우트 목록의 대조.
 *
 * 명세 §10.1의 표와 구현이 어긋나는 것을 문서 리뷰가 아니라 테스트로 잡는다.
 * YAML 파서를 새 의존성으로 들이지 않으려고 이 문서의 고정된 들여쓰기 규칙을 읽는다.
 */
const API_ROOT = join(process.cwd(), "src/app/api/cms/v1");
const OPENAPI_PATH = join(process.cwd(), "docs/cms/openapi.yaml");

function findRouteFiles(dir: string): string[] {
	const found: string[] = [];

	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			found.push(...findRouteFiles(full));
			continue;
		}
		if (name === "route.ts") found.push(full);
	}

	return found;
}

function toOpenApiPath(routeFile: string): string {
	const segments = relative(API_ROOT, routeFile)
		.split(sep)
		.slice(0, -1)
		.map((segment) => (segment.startsWith("[") && segment.endsWith("]") ? `{${segment.slice(1, -1)}}` : segment));

	return `/${segments.join("/")}`;
}

function methodsOf(routeFile: string): string[] {
	return [...readFileSync(routeFile, "utf8").matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)]
		.map((match) => match[1].toLowerCase())
		.sort();
}

function documentedEndpoints(): Record<string, string[]> {
	const documented: Record<string, string[]> = {};
	let currentPath: string | null = null;

	for (const line of readFileSync(OPENAPI_PATH, "utf8").split("\n")) {
		const pathMatch = line.match(/^ {2}(\/[^\s:]+):\s*$/);
		if (pathMatch) {
			currentPath = pathMatch[1];
			documented[currentPath] = [];
			continue;
		}

		const methodMatch = line.match(/^ {4}(get|post|patch|put|delete):\s*$/);
		if (methodMatch && currentPath) documented[currentPath].push(methodMatch[1]);
	}

	for (const path of Object.keys(documented)) documented[path].sort();

	return documented;
}

function actualEndpoints(): Record<string, string[]> {
	const actual: Record<string, string[]> = {};
	for (const file of findRouteFiles(API_ROOT)) actual[toOpenApiPath(file)] = methodsOf(file);

	return actual;
}

describe("M7-BE-4 OpenAPI ↔ 라우트 대조", () => {
	it("문서의 경로·메서드가 실제 라우트와 정확히 일치한다", () => {
		expect(documentedEndpoints()).toEqual(actualEndpoints());
	});

	it("공개 API 2경로가 문서에 있고 호출 예제와 별칭 표시가 있다", () => {
		const source = readFileSync(OPENAPI_PATH, "utf8");

		expect(source).toContain("/public/entries:");
		expect(source).toContain("/public/entries/{collection}/{slug}:");
		expect(source).toContain("examples:");
		expect(source).toContain("isAlias");
		// 공개 경로는 관리자 세션을 요구하지 않는다.
		expect(source).toContain("PublicEntryResponse");
	});
});
