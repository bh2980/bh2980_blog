import { type NextRequest } from "next/server";
import { AuthError } from "@/cms/adapters/auth";

/**
 * Validates Same-Origin requests for state-changing HTTP methods (POST, PATCH, PUT, DELETE).
 * Enforces Origin/Host equality or Sec-Fetch-Site: same-origin.
 * Denies requests missing all origin indicators by default (fail-closed).
 * Enforces Content-Type: application/json when body is expected.
 */
export function validateSameOrigin(request: NextRequest): void {
	const method = request.method.toUpperCase();
	if (["GET", "HEAD", "OPTIONS"].includes(method)) {
		return;
	}

	const origin = request.headers.get("origin");
	const host = request.headers.get("host") || request.nextUrl.host;
	const secFetchSite = request.headers.get("sec-fetch-site");
	const referer = request.headers.get("referer");

	let isVerified = false;

	if (origin) {
		try {
			const originUrl = new URL(origin);
			if (originUrl.host !== host) {
				throw new AuthError("forbidden", "Cross-origin requests are forbidden");
			}
			isVerified = true;
		} catch (err) {
			if (err instanceof AuthError) throw err;
			throw new AuthError("forbidden", "Invalid request origin");
		}
	} else if (secFetchSite) {
		// Only strictly allow same-origin or none (direct navigation/tools)
		if (secFetchSite === "same-origin" || secFetchSite === "none") {
			isVerified = true;
		} else {
			throw new AuthError("forbidden", "Cross-site request rejected");
		}
	} else if (referer) {
		try {
			const refererUrl = new URL(referer);
			if (refererUrl.host !== host) {
				throw new AuthError("forbidden", "Cross-origin referer rejected");
			}
			isVerified = true;
		} catch (err) {
			if (err instanceof AuthError) throw err;
			throw new AuthError("forbidden", "Invalid referer header");
		}
	}

	// Fail-closed: State-changing requests must present at least one valid origin verification signal
	if (!isVerified) {
		throw new AuthError("forbidden", "Missing origin verification headers");
	}

	// Validate Content-Type for JSON body requests
	const contentType = request.headers.get("content-type");
	if (["POST", "PATCH", "PUT"].includes(method)) {
		if (!contentType || !contentType.toLowerCase().includes("application/json")) {
			throw new AuthError("forbidden", "Content-Type must be application/json");
		}
	}
}
