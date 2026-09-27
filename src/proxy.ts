import { type NextRequest, NextResponse } from "next/server";
import { localeFromPath } from "@/libs/i18n/locales";

/** 요청 경로의 공개 화면 언어를 루트 레이아웃에 넘기는 요청 헤더(v2 B4). */
export const LOCALE_HEADER = "x-blog-locale";

/**
 * 공개 화면 언어를 요청 헤더로 넘긴다(v2 B4). 루트 레이아웃이 `<html lang>`을 정할 때 읽는다.
 * 언어는 주소의 접두사(`/en`, `/ja`)로만 정하고, 브라우저 언어를 보고 다른 주소로 보내지 않는다.
 */
export function proxy(request: NextRequest) {
	const headers = new Headers(request.headers);
	headers.set(LOCALE_HEADER, localeFromPath(request.nextUrl.pathname));
	return NextResponse.next({ request: { headers } });
}

export const config = {
	// API·정적 파일·파일 확장자가 있는 주소(rss.xml, sitemap.xml, 이미지)는 HTML이 아니라 건너뛴다.
	matcher: ["/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)"],
};
