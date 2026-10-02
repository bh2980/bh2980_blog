/** AI 실행 오류. API 응답 코드는 `error-handler.ts`가 정한다. */
export type AiErrorCode = "ai_unavailable" | "ai_failed" | "ai_input_too_large" | "ai_rate_limited";

export class AiError extends Error {
	constructor(
		readonly code: AiErrorCode,
		message: string,
	) {
		super(message);
		this.name = "AiError";
	}
}
