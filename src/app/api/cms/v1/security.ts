import { type NextRequest } from "next/server";
import { AuthError } from "@/cms/adapters/auth";

/**
 * Validates Same-Origin requests for state-changing HTTP methods (POST, PATCH, PUT, DELETE).
 * Enforces Origin/Host equality or Sec-Fetch-Site: same-origin.
 * Enforces Content-Type: application/json when body is expected.
 */
export function validateSameOrigin(request: NextRequest): void {
	const method = request.method.toUpperCase();
	if (["GET", "HEAD", "OPTIONS"].includes(method)) {
		return;
	}

	const origin = request.headers.get("origin");
	const host = request.headers.get("host") || request.nextUrl.host;

	if (origin) {
		try {
			const originUrl = new URL(origin);
			if (originUrl.host !== host) {
				throw new AuthError("forbidden", "Cross-origin requests are forbidden");
			}
		} catch {
			throw new AuthError("forbidden", "Invalid request origin");
		}
	} else {
		// If Origin header is missing (some same-origin POST/PATCH in safari/older clients),
		// check Sec-Fetch-Site or Referer
		const secFetchSite = request.headers.get("sec-fetch-site");
		if (secFetchSite && !["same-origin", "same-site", "none"].includes(secFetchSite)) {
			throw new AuthError("forbidden", "Cross-site request rejected");
		}

		const referer = request.headers.get("referer");
		if (referer) {
			try {
				const refererUrl = new URL(referer);
				if (refererUrl.host !== host) {
					throw new AuthError("forbidden", "Cross-origin referer rejected");
				}
			} catch {
				throw new AuthError("forbidden", "Invalid referer header");
			}
		}
	}

	// Validate Content-Type for JSON body requests
	const contentType = request.headers.get("content-type");
	if (["POST", "PATCH", "PUT"].includes(method)) {
		if (!contentType || !contentType.toLowerCase().includes("application/json")) {
			throw new AuthError("forbidden", "Content-Type must be application/json");
		}
	}
}
