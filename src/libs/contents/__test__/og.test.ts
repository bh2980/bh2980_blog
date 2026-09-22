import { describe, expect, it } from "vitest";
import { createOgImageResponse } from "../og";

/**
 * M7-RV-1 P1: `@vercel/og`는 프로덕션에서 1년 immutable 캐시를 기본으로 심는다.
 * O1 A1은 **슬러그별 OG만** `no-store`로 고정했으므로, 옵션이 그 기본값을 실제로 덮는지 고정한다.
 */
describe("createOgImageResponse 캐시 헤더", () => {
	it("noStore면 라이브러리 기본 캐시를 no-store로 덮는다", async () => {
		const response = await createOgImageResponse("제목", { noStore: true });

		expect(response.headers.get("cache-control")).toBe("no-store");
	});

	it("noStore가 없으면 라이브러리 기본 헤더를 그대로 둔다(고정 문구 OG는 정적 유지)", async () => {
		const response = await createOgImageResponse("제목");

		expect(response.headers.get("cache-control")).not.toBe("no-store");
	});
});
