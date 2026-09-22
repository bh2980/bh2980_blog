import { NextResponse } from "next/server";
import { CmsError } from "@/cms/adapters/postgres/content-store";

/**
 * 공개 API 오류 응답 (M7-BE-3).
 *
 * - §10.1의 400·404·503만 사용한다.
 * - 내부 오류 메시지·DB 메시지·스택을 응답에 넣지 않는다.
 * - DB·설정 오류를 404로 위장하지 않고 503으로 돌려준다(종료 조건 6). 원인은 서버 로그에만 남긴다.
 */
/**
 * 공개 응답은 캐시하지 않는다. 보관·slug 변경이 다음 요청에 그대로 반영되어야 한다(O1 A1).
 * 오류 응답도 같다: CDN이 404를 보관하면 발행 직후 404가 남는다(R4 리뷰 P2).
 */
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function handlePublicApiError(error: unknown): NextResponse {
	if (error instanceof CmsError) {
		if (error.code === "not_found") {
			return NextResponse.json({ code: "not_found", message: "Not found" }, { status: 404, headers: NO_STORE_HEADERS });
		}
		if (error.code === "invalid_input") {
			return NextResponse.json(
				{ code: "invalid_input", message: error.message },
				{ status: 400, headers: NO_STORE_HEADERS },
			);
		}
	}

	console.error("Public API error:", error);

	return NextResponse.json(
		{ code: "unavailable", message: "Public content is temporarily unavailable" },
		{ status: 503, headers: NO_STORE_HEADERS },
	);
}

export function publicJson(body: unknown): NextResponse {
	return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}

export function publicError(code: "invalid_input" | "not_found", message: string): NextResponse {
	return NextResponse.json({ code, message }, { status: code === "not_found" ? 404 : 400, headers: NO_STORE_HEADERS });
}
