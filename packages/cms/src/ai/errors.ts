/** AI 실행 오류. API 응답 코드는 `error-handler.ts`가 정한다. */
export type AiErrorCode =
	| "ai_unavailable"
	| "ai_failed"
	| "ai_input_too_large"
	| "ai_rate_limited"
	/** 설정에 없는 기능 이름. */
	| "ai_unknown_action"
	/** 고친 값·입력이 기능 정의에 맞지 않는다. */
	| "ai_invalid_input";

export class AiError extends Error {
	constructor(
		readonly code: AiErrorCode,
		message: string,
	) {
		super(message);
		this.name = "AiError";
	}
}
