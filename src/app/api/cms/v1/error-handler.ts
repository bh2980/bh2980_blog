import { NextResponse } from "next/server";
import { AuthError } from "@/cms/adapters/auth";
import { CmsError } from "@/cms/adapters/postgres/content-store";
import { ServiceError } from "@/cms/services/types";

/**
 * 라우트가 직접 만드는 HTTP 오류(요청 형식·버전 누락 등).
 * 응답 모양은 다른 오류와 같다: `code`, `message`, 필요하면 `issues`(§10.1).
 */
export class HttpError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly issues?: unknown,
	) {
		super(message);
		this.name = "HttpError";
	}
}

const CMS_ERROR_STATUS: Record<string, number> = {
	not_found: 404,
	conflict: 409,
	slug_conflict: 409,
	in_use: 409,
	invalid_status: 409,
	locked: 409,
	folder_name_conflict: 409,
	translation_exists: 409,
	has_translations: 409,
	invalid_input: 400,
	invalid_reference: 400,
	invalid_state: 500,
};

const SERVICE_ERROR_STATUS: Record<string, number> = {
	invalid_input: 400,
	unknown_collection: 400,
	slug_reserved: 409,
	mdx_too_large: 413,
	metadata_too_large: 413,
};

/** DB 연결 장애는 일시 오류(503)다. 없는 콘텐츠나 빈 목록으로 위장하지 않는다(§10.1, §11.1). */
const isUnavailable = (error: unknown) => {
	const code = (error as { code?: unknown })?.code;
	return (
		typeof code === "string" &&
		(code === "ECONNREFUSED" ||
			code === "ETIMEDOUT" ||
			code === "ENOTFOUND" ||
			code === "57P01" ||
			code.startsWith("08"))
	);
};

export function handleApiError(error: unknown): NextResponse {
	if (error instanceof HttpError) {
		return NextResponse.json(
			{ code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) },
			{ status: error.status },
		);
	}

	if (error instanceof AuthError) {
		return NextResponse.json(
			{ code: error.code, message: error.message },
			{ status: error.code === "unauthorized" ? 401 : 403 },
		);
	}

	if (error instanceof CmsError) {
		const status = CMS_ERROR_STATUS[error.code] ?? 400;
		if (status === 500) console.error("CMS store invariant broken:", error);
		return NextResponse.json(
			{
				code: error.code,
				message: status === 500 ? "Internal server error" : error.message,
				...(error.serverVersion !== undefined ? { serverVersion: error.serverVersion } : {}),
				...(error.details !== undefined ? { details: error.details } : {}),
			},
			{ status },
		);
	}

	if (error instanceof ServiceError) {
		return NextResponse.json(
			{ code: error.code, message: error.message, ...(error.issues ? { issues: error.issues } : {}) },
			{ status: SERVICE_ERROR_STATUS[error.code] ?? 422 },
		);
	}

	if (isUnavailable(error)) {
		console.error("CMS storage unavailable:", error);
		return NextResponse.json({ code: "unavailable", message: "Storage is temporarily unavailable" }, { status: 503 });
	}

	console.error("Unhandled API error:", error);
	return NextResponse.json({ code: "internal_error", message: "Internal server error" }, { status: 500 });
}
