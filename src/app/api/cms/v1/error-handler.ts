import { NextResponse } from "next/server";
import { AuthError } from "@/cms/adapters/auth";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { ServiceError } from "@/cms/services/types";

export function handleApiError(error: unknown): NextResponse {
	if (error instanceof AuthError) {
		return NextResponse.json(
			{ error: error.message, code: error.code },
			{ status: error.code === "unauthorized" ? 401 : 403 },
		);
	}

	if (error instanceof CmsError) {
		if (error.code === "conflict") {
			return NextResponse.json(
				{ error: error.message, code: "conflict", serverVersion: error.serverVersion },
				{ status: 409 },
			);
		}
		if (error.code === "slug_conflict") {
			return NextResponse.json({ error: error.message, code: "slug_conflict" }, { status: 409 });
		}
		if (error.code === "not_found") {
			return NextResponse.json({ error: error.message, code: "not_found" }, { status: 404 });
		}
		if (error.code === "invalid_input") {
			return NextResponse.json({ error: error.message, code: "invalid_input" }, { status: 400 });
		}
		return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
	}

	if (error instanceof ServiceError) {
		if (error.code === "slug_reserved") {
			return NextResponse.json({ error: "Slug is reserved", code: error.code }, { status: 409 });
		}
		return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
	}

	console.error("Unhandled API error:", error);
	return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
