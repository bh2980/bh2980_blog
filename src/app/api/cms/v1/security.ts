import { AuthError } from "@bh2980/cms/adapters/auth";
import type { NextRequest } from "next/server";
import { HttpError } from "./error-handler";

/**
 * 상태를 바꾸는 요청(POST·PATCH·PUT·DELETE)의 동일 출처 검사(§10.2 CSRF 방어).
 * Origin/Host 일치 또는 `Sec-Fetch-Site: same-origin`을 요구하고, 신호가 하나도 없으면 거부한다(fail-closed).
 * 본문을 받는 요청은 `Content-Type: application/json`이어야 한다(아니면 415).
 */
export function validateSameOrigin(request: NextRequest): void {
	const method = request.method.toUpperCase();
	if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

	const host = request.headers.get("host") || request.nextUrl.host;
	const origin = request.headers.get("origin");
	const secFetchSite = request.headers.get("sec-fetch-site");
	const referer = request.headers.get("referer");

	const sameHost = (value: string, label: string) => {
		let url: URL;
		try {
			url = new URL(value);
		} catch {
			throw new AuthError("forbidden", `Invalid ${label} header`);
		}
		if (url.host !== host) throw new AuthError("forbidden", `Cross-origin ${label} rejected`);
	};

	if (origin) {
		sameHost(origin, "origin");
	} else if (secFetchSite) {
		// same-origin 또는 none(직접 탐색·도구)만 허용한다.
		if (secFetchSite !== "same-origin" && secFetchSite !== "none") {
			throw new AuthError("forbidden", "Cross-site request rejected");
		}
	} else if (referer) {
		sameHost(referer, "referer");
	} else {
		throw new AuthError("forbidden", "Missing origin verification headers");
	}

	if (["POST", "PATCH", "PUT"].includes(method)) {
		const contentType = request.headers.get("content-type");
		if (!contentType?.toLowerCase().includes("application/json")) {
			throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json");
		}
	}
}
