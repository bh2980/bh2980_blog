import { afterEach, describe, expect, it, vi } from "vitest";
import { getKeystaticAdminHomePath, getKeystaticMemoEditPath, getKeystaticPostEditPath } from "../keystatic-url";

describe("keystatic url", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("관리자 홈 경로를 생성한다", () => {
		expect(getKeystaticAdminHomePath()).toBe("/keystatic");
	});

	it("post 수정 경로를 생성한다", () => {
		expect(getKeystaticPostEditPath("기술-스택-선정하기")).toBe(
			"/keystatic/branch/main/collection/post/item/%EA%B8%B0%EC%88%A0-%EC%8A%A4%ED%83%9D-%EC%84%A0%EC%A0%95%ED%95%98%EA%B8%B0",
		);
	});

	it("memo 수정 경로를 생성한다", () => {
		expect(getKeystaticMemoEditPath("1-implement-curry")).toBe(
			"/keystatic/branch/main/collection/memo/item/1-implement-curry",
		);
	});

	it("local mode에서는 branch 없이 수정 경로를 생성한다", () => {
		expect(getKeystaticPostEditPath("기술-스택-선정하기", { mode: "local" })).toBe(
			"/keystatic/collection/post/item/%EA%B8%B0%EC%88%A0-%EC%8A%A4%ED%83%9D-%EC%84%A0%EC%A0%95%ED%95%98%EA%B8%B0",
		);
		expect(getKeystaticMemoEditPath("1-implement-curry", { mode: "local" })).toBe(
			"/keystatic/collection/memo/item/1-implement-curry",
		);
	});

	it("slug를 URL-safe하게 인코딩한다", () => {
		expect(getKeystaticPostEditPath("hello world?")).toBe(
			"/keystatic/branch/main/collection/post/item/hello%20world%3F",
		);
	});

	it("KEYSTATIC_DEFAULT_BRANCH 환경변수가 있으면 해당 브랜치를 기본값으로 사용한다", () => {
		vi.stubEnv("KEYSTATIC_DEFAULT_BRANCH", "master");
		expect(getKeystaticPostEditPath("기술-스택-선정하기")).toBe(
			"/keystatic/branch/master/collection/post/item/%EA%B8%B0%EC%88%A0-%EC%8A%A4%ED%83%9D-%EC%84%A0%EC%A0%95%ED%95%98%EA%B8%B0",
		);
	});
});
