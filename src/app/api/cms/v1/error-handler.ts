import { NextResponse } from "next/server";
import { AuthError } from "@/cms/adapters/auth";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { ServiceError } from "@/cms/services/types";

export function handleApiError(error: unknown): NextResponse {
	if (error instanceof AuthError) {
		return NextResponse.json(
			{ code: error.code, message: error.message },
			{ status: error.code === "unauthorized" ? 401 : 403 },
		);
	}

	if (error instanceof CmsError) {
		if (error.code === "conflict") {
			return NextResponse.json(
				{ code: "conflict", message: error.message, serverVersion: error.serverVersion },
				{ status: 409 },
			);
		}
		if (error.code === "slug_conflict" || error.code === "in_use") {
			return NextResponse.json({ code: error.code, message: error.message }, { status: 409 });
		}
		if (error.code === "not_found") {
			return NextResponse.json({ code: "not_found", message: error.message }, { status: 404 });
		}
		if (error.code === "invalid_input") {
			return NextResponse.json({ code: "invalid_input", message: error.message }, { status: 400 });
		}
		return NextResponse.json({ code: error.code, message: error.message }, { status: 400 });
	}

	if (error instanceof ServiceError) {
		if (error.code === "slug_reserved") {
			return NextResponse.json({ code: error.code, message: "Slug is reserved" }, { status: 409 });
		}
		return NextResponse.json({ code: error.code, message: error.message }, { status: 422 });
	}

	console.error("Unhandled API error:", error);
	return NextResponse.json({ code: "internal_error", message: "Internal server error" }, { status: 500 });
}
