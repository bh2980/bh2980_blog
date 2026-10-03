import { z } from "zod";

/**
 * AI 공통 정의(v2 D). 기능 정의(`action.ts`)·실행기·관리자 화면이 함께 쓰는 선택지와 결과 모양이다.
 * 서버와 브라우저가 함께 쓰므로 비밀 값이나 SDK를 넣지 않는다.
 */

/**
 * 기능이 붙는 화면 자리. 자리마다 주는 재료가 정해져 있다(`SLOT_INPUTS`).
 * `translation`은 번역본 편집기의 블록 번역(블록 메뉴와 `모두 번역`), `selection`은 본문에서 글자를 고르면 뜨는 메뉴
 * (예: 문체 다듬기, 고른 글을 바꾼다), `insert`는 슬래시(`/`) 메뉴와 빈 문서(예: 초안 쓰기, 커서에 넣는다)다.
 * `block`은 본문 블록 하나(예: Mermaid 다이어그램)의 손잡이 옆 버튼이다. 블록 원문을 보내고 바꾼 블록으로 바꾼다.
 */
export const AI_SLOTS = [
	"field",
	"image",
	"codeRules",
	"media",
	"translation",
	"selection",
	"insert",
	"block",
] as const;
export type AiSlot = (typeof AI_SLOTS)[number];

/**
 * 방식. `generate`는 대화 모델(LLM)이 글로 답을 만든다. `decide`는 판단 모델(System One, 예: Jev)이
 * 정해 둔 선택지마다 맞을 확률을 매기고, 기준 확률을 넘는 선택지만 후보가 된다. 판단 모델은 글을 만들지 않는다.
 */
export const AI_ENGINES = ["generate", "decide"] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

/** 판단 방식에서 하나만 고르나(`one`), 선택지마다 따로 판단해 여러 개 고르나(`many`). */
export const AI_PICKS = ["one", "many"] as const;
export type AiPick = (typeof AI_PICKS)[number];

/**
 * 결과 모양. `candidates`는 누르는 후보 여러 개, `text`는 긴 글 하나, `mdx`는 본문 조각(MDX) 하나,
 * `note`는 보여 주기만 하는 메모.
 */
export const AI_RESULTS = ["candidates", "text", "mdx", "note"] as const;
export type AiResult = (typeof AI_RESULTS)[number];

/** 적용 방식. `append`는 목록 값(태그·정규식 규칙)에 더한다. */
export const AI_APPLIES = ["replace", "append", "none"] as const;
export type AiApply = (typeof AI_APPLIES)[number];

/**
 * 결과 검사 종류. 기능마다 목록으로 정하고(기능 편집기에 모두 보인다), 통과하지 못한 후보는 버린다.
 * - `pattern`: 정규식에 맞는 값만
 * - `maxLength`: 최대 글자 수를 넘지 않는 값만
 * - `unique`: 같은 컬렉션·언어의 다른 항목이 이미 쓰는 주소는 뺌
 * - `exists`: 선택지(`choices`)에 실제로 있는 값만
 * - `regexRuns`: 올바른 정규식이고 `code` 입력에서 한 곳 이상 찾는 것만
 * - `structure`: MDX 결과가 원문 입력과 같은 뼈대(요소·링크·코드·속성)인 것만
 * - `oneOf`: 정해 둔 목록(`items`) 중 하나인 것만
 *
 * 이 밖의 검사는 기능 정의의 `validate` 함수(코드)로 더한다.
 */
export const AI_CHECK_KINDS = ["pattern", "maxLength", "unique", "exists", "regexRuns", "structure", "oneOf"] as const;
export type AiCheckKind = (typeof AI_CHECK_KINDS)[number];

const patternSchema = z
	.string()
	.trim()
	.min(1)
	.max(500)
	.refine(
		(pattern) => {
			try {
				new RegExp(pattern, "u");
				return true;
			} catch {
				return false;
			}
		},
		{ message: "올바르지 않은 정규식입니다." },
	);

/** 검사 하나. 기능마다 정해 둔 검사를 켜고 끄며, 형식·길이는 값을 고친다. */
const enabled = z.boolean().default(true);
export const aiCheckSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("pattern"), enabled, pattern: patternSchema }),
	z.object({ kind: z.literal("maxLength"), enabled, max: z.number().int().min(1).max(5000) }),
	z.object({ kind: z.literal("unique"), enabled }),
	z.object({ kind: z.literal("exists"), enabled }),
	z.object({ kind: z.literal("regexRuns"), enabled }),
	z.object({ kind: z.literal("structure"), enabled }),
	z.object({ kind: z.literal("oneOf"), enabled, items: z.array(z.string().trim().min(1).max(200)).min(1).max(100) }),
]);
export type AiCheck = z.output<typeof aiCheckSchema>;
export type AiCheckInput = z.input<typeof aiCheckSchema>;

/** 주소·파일 이름처럼 소문자·숫자·하이픈만 쓰는 값의 형식. 기본 기능의 `형식` 검사에 채워 둔다. */
export const KEBAB_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

export const SLOT_LABELS: Record<AiSlot, string> = {
	field: "필드",
	image: "본문 이미지",
	codeRules: "코드 블록 규칙",
	media: "미디어 파일",
	translation: "번역",
	selection: "선택 영역 메뉴",
	insert: "넣기 메뉴",
	block: "블록",
};

/** 필드 밖 자리의 대상. 필드 자리의 대상은 컬렉션 정의의 필드 이름이다. */
export const SLOT_TARGETS = {
	image: { alt: "대체 텍스트", caption: "캡션" },
	codeRules: { fold: "글자 접기 규칙" },
	media: { filename: "파일 이름", defaultAlt: "기본 대체 텍스트", defaultCaption: "기본 캡션" },
} as const satisfies Record<
	Exclude<AiSlot, "field" | "translation" | "selection" | "insert" | "block">,
	Record<string, string>
>;

export const RESULT_LABELS: Record<AiResult, string> = {
	candidates: "짧은 후보 여러 개",
	text: "긴 글 하나",
	mdx: "본문 조각",
	note: "메모만",
};

export const APPLY_LABELS: Record<AiApply, string> = {
	replace: "바꾸기",
	append: "넣기",
	none: "보기만",
};

export const CHECK_LABELS: Record<AiCheckKind, string> = {
	pattern: "형식",
	maxLength: "길이",
	unique: "중복 없음",
	exists: "있는 값만",
	regexRuns: "정규식 실행",
	structure: "구조 유지",
	oneOf: "선택지 안",
};

/** 관리자 화면에서 어느 기능에든 더할 수 있는 검사와 처음 값. 나머지는 기능 정의가 정한다. */
export const ADDABLE_CHECKS = {
	pattern: { kind: "pattern", enabled: true, pattern: ".+" },
	maxLength: { kind: "maxLength", enabled: true, max: 100 },
	oneOf: { kind: "oneOf", enabled: true, items: ["값"] },
} as const satisfies Partial<Record<AiCheckKind, AiCheck>>;
export type AddableCheckKind = keyof typeof ADDABLE_CHECKS;
export const isAddableCheck = (kind: AiCheckKind): kind is AddableCheckKind => Object.hasOwn(ADDABLE_CHECKS, kind);

export const ENGINE_LABELS: Record<AiEngine, string> = { generate: "생성", decide: "판단" };

export const PICK_LABELS: Record<AiPick, string> = { one: "하나 고르기", many: "여러 개 고르기" };

/** 판단 모델에 한 번에 물을 수 있는 선택지 수. */
export const MAX_DECISION_OPTIONS = 255;

export const MAX_PROMPT_LENGTH = 4000;
export const MAX_REQUEST_LENGTH = 1000;

/** 자리에 결과로 보여 줄 후보 하나. `value`가 적용될 값이고 `label`은 보이는 글자다. */
export interface AiCandidate {
	value: string;
	label: string;
	/** 덧붙일 짧은 설명(정규식이 찾은 곳 수 등). */
	detail?: string;
}

export type AiRunResult =
	| { kind: "candidates"; items: AiCandidate[] }
	| { kind: "text"; text: string }
	| { kind: "mdx"; text: string }
	| { kind: "note"; text: string };

/**
 * 화면 자리가 누를 때 넘기는 지금 상황. 자리마다 아는 값만 채운다. 기능의 입력(`action.input`)으로 옮겨 보낸다.
 * 태그 목록과 이미지는 서버가 직접 읽는다(브라우저가 보낸 목록·주소를 믿지 않는다).
 */
export interface AiRunContext {
	/** 실행할 때 적은 추가 요청. 기능이 `askInstruction`일 때만 지시문에 붙는다. */
	request?: string;
	collection?: string;
	locale?: string;
	entryId?: string;
	title?: string;
	summary?: string;
	body?: string;
	/** 대상의 현재 값. 목록 값(태그 id 등)은 배열이다. */
	current?: string | readonly string[];
	around?: string;
	/** 선택 영역 메뉴에서 고른 글(MDX). */
	selection?: string;
	code?: string;
	language?: string;
	mediaId?: string;
	/** 미디어 라이브러리 밖 이미지의 사이트 주소(`/images/...`). 서버가 자기 사이트에서 읽는다. */
	imageSrc?: string;
	filename?: string;
}

/**
 * 검사 목록을 두기 전(`check` 하나 + `maxLength`)에 저장한 값을 검사 목록으로 옮긴다.
 * 예전 `ai_features` 행을 고친 값으로 옮길 때 쓴다.
 */
export function migrateLegacyCheck(value: unknown): unknown {
	if (!value || typeof value !== "object" || "checks" in value || !("check" in value)) return value;
	const { check, maxLength, ...rest } = value as { check?: unknown; maxLength?: unknown };
	const legacy: Record<string, AiCheckInput[]> = {
		slug: [{ kind: "pattern", pattern: KEBAB_PATTERN }, { kind: "unique" }],
		tags: [{ kind: "exists" }],
		regex: [{ kind: "regexRuns" }],
		filename: [{ kind: "pattern", pattern: KEBAB_PATTERN }],
		maxLength: typeof maxLength === "number" ? [{ kind: "maxLength", max: maxLength }] : [],
	};
	return { ...rest, checks: typeof check === "string" ? (legacy[check] ?? []) : [] };
}
