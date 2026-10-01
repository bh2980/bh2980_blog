import { z } from "zod";

/**
 * AI 기능 정의(v2 D). 기능 하나는 "어디에 붙나 · 방식 · 연결·모델 · 무엇을 보내나 · 결과 모양 · 적용 방식 · 검사 · 지시문"의 조합이고,
 * DB(`ai_features`)에 저장해 관리자 AI 화면에서 만들고 고친다. 코드는 조합의 선택지만 가진다.
 *
 * 서버와 브라우저가 함께 쓰므로 비밀 값이나 SDK를 넣지 않는다.
 */

/** 붙는 곳. 화면의 자리 이름과 같다(`src/cms/slots`). */
export const AI_SLOTS = ["field", "image", "codeRules", "media", "body"] as const;
export type AiSlot = (typeof AI_SLOTS)[number];

/**
 * 방식. `generate`는 대화 모델(LLM)이 글로 답을 만든다. `decide`는 판단 모델(System One, 예: Jev)이
 * 정해 둔 선택지마다 맞을 확률을 매기고, 기준 확률을 넘는 선택지만 후보가 된다. 판단 모델은 글을 만들지 않는다.
 */
export const AI_ENGINES = ["generate", "decide"] as const;
export type AiEngine = (typeof AI_ENGINES)[number];

/** 판단 방식의 선택지 출처. `field`는 대상 필드의 선택 목록, `list`는 직접 적은 목록. */
export const AI_OPTION_SOURCES = ["tags", "categories", "field", "list"] as const;
export type AiOptionSource = (typeof AI_OPTION_SOURCES)[number];

/** 판단 방식에서 하나만 고르나(`one`), 선택지마다 따로 판단해 여러 개 고르나(`many`). */
export const AI_PICKS = ["one", "many"] as const;
export type AiPick = (typeof AI_PICKS)[number];

/** 보낼 수 있는 내용. 자리마다 쓸 수 있는 것이 다르다(`SLOT_INPUTS`). */
export const AI_INPUTS = [
	"title",
	"summary",
	"body",
	"tags",
	"current",
	"image",
	"around",
	"code",
	"filename",
] as const;
export type AiInput = (typeof AI_INPUTS)[number];

/** 결과 모양. `candidates`는 누르는 후보 여러 개, `text`는 긴 글 하나, `note`는 보여 주기만 하는 메모. */
export const AI_RESULTS = ["candidates", "text", "note"] as const;
export type AiResult = (typeof AI_RESULTS)[number];

/** 적용 방식. `append`는 목록 값(태그·정규식 규칙)에 더한다. */
export const AI_APPLIES = ["replace", "append", "none"] as const;
export type AiApply = (typeof AI_APPLIES)[number];

/**
 * 결과 검사 종류. 기능마다 목록으로 고르고(기능 편집기에 모두 보인다), 통과하지 못한 후보는 버린다.
 * 대상 자리가 재료를 줄 수 있는 검사만 고를 수 있다(`availableChecks`).
 * - `pattern`: 정규식에 맞는 값만
 * - `maxLength`: 최대 글자 수를 넘지 않는 값만
 * - `unique`: 다른 항목이 이미 쓰는 값은 뺌(주소 필드)
 * - `exists`: 선택지(태그·카테고리·선택 목록)에 실제로 있는 값만
 * - `regexRuns`: 올바른 정규식이고 대상 코드에서 한 곳 이상 찾는 것만(코드 블록 규칙)
 * - `structure`: 번역한 MDX가 원문과 같은 뼈대(요소·링크·코드·속성)인 것만(본문 번역)
 */
export const AI_CHECK_KINDS = ["pattern", "maxLength", "unique", "exists", "regexRuns", "structure"] as const;
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
]);
export type AiCheck = z.output<typeof aiCheckSchema>;
export type AiCheckInput = z.input<typeof aiCheckSchema>;

/** 주소·파일 이름처럼 소문자·숫자·하이픈만 쓰는 값의 형식. 기본 기능의 `형식` 검사에 채워 둔다. */
export const KEBAB_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

export const INPUT_LABELS: Record<AiInput, string> = {
	title: "제목",
	summary: "요약",
	body: "본문",
	tags: "태그 목록",
	current: "현재 값",
	image: "이미지",
	around: "앞뒤 문단",
	code: "코드",
	filename: "파일 이름",
};

export const SLOT_LABELS: Record<AiSlot, string> = {
	field: "필드",
	image: "본문 이미지",
	codeRules: "코드 블록 규칙",
	media: "미디어 파일",
	body: "본문",
};

export const RESULT_LABELS: Record<AiResult, string> = {
	candidates: "짧은 후보 여러 개",
	text: "긴 글 하나",
	note: "메모만",
};

export const APPLY_LABELS: Record<AiApply, string> = {
	replace: "누르면 교체",
	append: "누르면 추가",
	none: "적용 안 함",
};

export const CHECK_LABELS: Record<AiCheckKind, string> = {
	pattern: "형식",
	maxLength: "길이",
	unique: "중복 없음",
	exists: "있는 값만",
	regexRuns: "정규식 실행",
	structure: "구조 유지",
};

export const ENGINE_LABELS: Record<AiEngine, string> = { generate: "생성", decide: "판단" };

export const OPTION_SOURCE_LABELS: Record<AiOptionSource, string> = {
	tags: "태그",
	categories: "카테고리",
	field: "필드 선택 목록",
	list: "직접 적기",
};

export const PICK_LABELS: Record<AiPick, string> = { one: "하나 고르기", many: "여러 개 고르기" };

/** 판단 모델에 한 번에 물을 수 있는 선택지 수. */
export const MAX_DECISION_OPTIONS = 255;

/** 자리마다 보낼 수 있는 내용. */
export const SLOT_INPUTS: Record<AiSlot, readonly AiInput[]> = {
	field: ["title", "summary", "body", "tags", "current"],
	image: ["title", "image", "around", "current"],
	codeRules: ["title", "code"],
	media: ["image", "filename", "current"],
	// 본문 번역은 번역할 블록 MDX를 따로 보낸다(보낼 내용을 고르지 않는다).
	body: [],
};

/**
 * 같은 일을 하는 자리. 미디어 화면의 기본 대체 텍스트·기본 캡션은 본문 이미지의 대체 텍스트·캡션 기능을 같이 쓴다
 * (기능을 둘로 나누지 않는다). 키는 `자리:대상`이다.
 */
export const SHARED_SLOT_TARGETS: Record<string, { slot: AiSlot; target: string }> = {
	"media:defaultAlt": { slot: "image", target: "alt" },
	"media:defaultCaption": { slot: "image", target: "caption" },
};

/** 필드 밖 자리의 대상. 필드 자리의 대상은 컬렉션 정의의 필드 이름이다. */
export const SLOT_TARGETS: Record<Exclude<AiSlot, "field">, Record<string, string>> = {
	image: { alt: "대체 텍스트", caption: "캡션" },
	codeRules: { fold: "글자 접기 규칙" },
	media: { filename: "파일 이름", defaultAlt: "기본 대체 텍스트", defaultCaption: "기본 캡션" },
	body: { translate: "번역" },
};

export const MAX_PROMPT_LENGTH = 4000;
export const MAX_FEATURE_NAME_LENGTH = 60;

/** 기능 정의에서 사용자가 고치는 부분. 저장·시험 요청이 함께 쓴다. */
const aiFeatureSpecBase = z
	.object({
		name: z.string().trim().min(1).max(MAX_FEATURE_NAME_LENGTH),
		enabled: z.boolean(),
		slot: z.enum(AI_SLOTS),
		target: z.string().trim().min(1).max(60),
		/** 필드 자리에서 이 컬렉션에만 붙인다. 비우면 그 필드가 있는 모든 컬렉션. */
		collections: z.array(z.string().max(40)).max(10),
		inputs: z.array(z.enum(AI_INPUTS)).max(AI_INPUTS.length),
		result: z.enum(AI_RESULTS),
		apply: z.enum(AI_APPLIES),
		/** 결과 검사 목록. 위에서부터 차례로 적용한다. */
		checks: z.array(aiCheckSchema).max(10).default([]),
		/** 실행할 때 추가 요청을 받는다(예: 이 코드에서는 tailwind 클래스만 접기). 고정 지시문 뒤에 붙는다. */
		askInstruction: z.boolean().default(false),
		/** 쓸 연결의 id. 비우면 방식에 맞는 첫 연결을 쓴다. */
		providerId: z.string().max(60).nullable().default(null),
		/** 쓸 모델 이름. 비우면 연결의 기본 모델을 쓴다. 같은 연결에서도 기능마다 다른 모델을 고를 수 있다. */
		modelName: z.string().trim().max(200).default(""),
		prompt: z.string().trim().min(1).max(MAX_PROMPT_LENGTH),
		// 아래는 판단 방식 설정이다. 예전에 저장한 정의도 읽히도록 기본값을 둔다.
		engine: z.enum(AI_ENGINES).default("generate"),
		options: z.enum(AI_OPTION_SOURCES).default("tags"),
		/** `options: "list"`의 선택지. */
		optionList: z.array(z.string().trim().min(1).max(200)).max(MAX_DECISION_OPTIONS).default([]),
		pick: z.enum(AI_PICKS).default("many"),
		/** 이 확률 이상인 선택지만 후보로 보여 준다(0~1). */
		threshold: z.number().min(0.01).max(0.99).default(0.6),
		/** 후보 최대 개수. */
		maxCount: z.number().int().min(1).max(20).default(5),
	})
	.superRefine((spec, ctx) => {
		const allowed = SLOT_INPUTS[spec.slot];
		for (const input of spec.inputs) {
			if (!allowed.includes(input)) {
				ctx.addIssue({ code: "custom", path: ["inputs"], message: `${spec.slot}에서 보낼 수 없는 내용: ${input}` });
			}
		}
		if (spec.slot !== "field" && !(spec.target in SLOT_TARGETS[spec.slot])) {
			ctx.addIssue({ code: "custom", path: ["target"], message: `알 수 없는 대상: ${spec.target}` });
		}
		if (spec.result === "note" && spec.apply !== "none") {
			ctx.addIssue({ code: "custom", path: ["apply"], message: "메모는 적용하지 않습니다." });
		}
		if (spec.result !== "note" && spec.apply === "none") {
			ctx.addIssue({ code: "custom", path: ["apply"], message: "적용 방식을 고르세요." });
		}
		const kinds = spec.checks.map((check) => check.kind);
		if (new Set(kinds).size !== kinds.length) {
			ctx.addIssue({ code: "custom", path: ["checks"], message: "같은 검사를 두 번 넣었습니다." });
		}
		if (spec.engine === "decide") {
			if (spec.result !== "candidates") {
				ctx.addIssue({ code: "custom", path: ["result"], message: "판단 방식은 후보로만 답합니다." });
			}
			if (spec.inputs.includes("image")) {
				ctx.addIssue({ code: "custom", path: ["inputs"], message: "판단 모델은 이미지를 읽지 못합니다." });
			}
			if (spec.options === "list" && spec.optionList.length === 0) {
				ctx.addIssue({ code: "custom", path: ["optionList"], message: "선택지를 적으세요." });
			}
			if (spec.options === "field" && spec.slot !== "field") {
				ctx.addIssue({ code: "custom", path: ["options"], message: "필드 선택 목록은 필드 자리에서만 씁니다." });
			}
		}
	});

/**
 * 검사 목록을 두기 전(`check` 하나 + `maxLength`)에 저장한 정의를 검사 목록으로 옮긴다.
 * 예전에 코드 안에서 하던 일을 같은 뜻의 검사로 바꿔, 사용자가 다시 설정하지 않아도 되게 한다.
 */
function migrateLegacyCheck(value: unknown): unknown {
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

export const aiFeatureSpecSchema = z.preprocess(migrateLegacyCheck, aiFeatureSpecBase);

export type AiFeatureSpec = z.output<typeof aiFeatureSpecBase>;
/** 저장·요청에 보내는 모양. 판단 방식 설정·검사 목록은 빠져도 기본값이 채워진다. */
export type AiFeatureSpecInput = z.input<typeof aiFeatureSpecBase>;

export interface AiFeature extends AiFeatureSpec {
	id: string;
	/** 처음부터 들어 있는 기능의 이름표. 기본값으로 되돌릴 때 쓴다. 직접 만든 기능은 `null`. */
	builtin: string | null;
	version: number;
	createdAt: string;
	updatedAt: string;
}

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
	| { kind: "note"; text: string };

/**
 * 실행할 때 자리가 보내는 지금 상황. 서버는 기능의 `inputs`에 있는 것만 AI에게 넘긴다.
 * 태그 목록과 이미지는 서버가 직접 읽는다(브라우저가 보낸 목록·주소를 믿지 않는다).
 */
export const MAX_REQUEST_LENGTH = 1000;

export const aiRunContextSchema = z.object({
	/** 실행할 때 적은 추가 요청. 기능이 `askInstruction`일 때만 지시문에 붙는다. */
	request: z.string().max(MAX_REQUEST_LENGTH).optional(),
	collection: z.string().max(40).optional(),
	locale: z.string().max(10).optional(),
	entryId: z.string().uuid().optional(),
	title: z.string().max(1000).optional(),
	summary: z.string().max(5000).optional(),
	body: z.string().max(200_000).optional(),
	/** 대상의 현재 값. 목록 값(태그 id 등)은 배열이다. */
	current: z.union([z.string().max(10_000), z.array(z.string().max(200)).max(200)]).optional(),
	around: z.string().max(20_000).optional(),
	code: z.string().max(100_000).optional(),
	language: z.string().max(40).optional(),
	mediaId: z.string().uuid().optional(),
	/** 미디어 라이브러리 밖 이미지의 사이트 주소(`/images/...`). 서버가 자기 사이트에서 읽는다. */
	imageSrc: z.string().max(2000).optional(),
	filename: z.string().max(300).optional(),
});

export type AiRunContext = z.output<typeof aiRunContextSchema>;

export const aiRunBodySchema = z.object({
	featureId: z.string().uuid(),
	/** 저장하지 않은 설정으로 시험한다(AI 화면의 `시험`). 기능마다 정해 둔 부분은 바뀌지 않는다. */
	draft: z.unknown().optional(),
	context: aiRunContextSchema,
});
