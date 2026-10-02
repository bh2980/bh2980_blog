import { type AiFeatureSpec, type AiFeatureSpecInput, aiFeatureSpecSchema, KEBAB_PATTERN } from "./definition";

/**
 * AI 기능 목록(v2 D). 화면 자리가 몇 곳으로 정해져 있어, 기능도 코드로 정해 둔다.
 * 마이그레이션이 기능마다 한 번 넣고, AI 화면에서는 아래 "고칠 수 있는 것"만 바꾼다.
 * 자리(연결 장치)가 여럿 생기면 그때 사용자가 기능을 더하는 방식으로 넓힌다.
 *
 * - 정해 둔 것: 이름·붙는 곳·대상·컬렉션·결과·적용·방식·판단 선택지·고르는 방식·검사 종류
 * - 고칠 수 있는 것: 켜기·요청 받기·연결·모델·보낼 내용·지시문·기준 확률·최대 개수·검사 켜기와 값
 */
export const BUILTIN_AI_FEATURES: Record<string, { id: string; spec: AiFeatureSpecInput }> = {
	slug: {
		id: "00000000-0000-4000-8000-00000000a101",
		spec: {
			name: "주소 추천",
			enabled: true,
			slot: "field",
			target: "slug",
			collections: ["post", "memo"],
			inputs: ["title", "body"],
			result: "candidates",
			apply: "replace",
			checks: [{ kind: "pattern", pattern: KEBAB_PATTERN }, { kind: "maxLength", max: 80 }, { kind: "unique" }],
			prompt: [
				"글 제목과 본문을 보고 영어 URL 주소(slug) 후보 3개를 만든다.",
				"- 소문자 영어, 숫자, 하이픈만 쓴다. 점·밑줄·공백은 쓰지 않는다",
				"- 2~5단어. 관사와 전치사는 되도록 뺀다",
				"- 기술 이름은 널리 쓰는 표기를 따른다 (nextjs, react-query, typescript)",
				"- 글의 핵심 주제가 드러나게 한다",
			].join("\n"),
		},
	},
	summary: {
		id: "00000000-0000-4000-8000-00000000a103",
		spec: {
			name: "요약 만들기",
			enabled: true,
			askInstruction: true,
			slot: "field",
			target: "summary",
			collections: ["post"],
			inputs: ["title", "body"],
			result: "text",
			apply: "replace",
			checks: [{ kind: "maxLength", max: 160 }],
			prompt: [
				"글 목록과 공유 미리보기에 보일 요약을 쓴다.",
				"- 1~2문장, 160자 이내",
				"- 본문과 같은 언어, '~다'체",
				"- 글에서 무엇을 알 수 있는지 드러낸다. '이 글에서는' 같은 말로 시작하지 않는다",
			].join("\n"),
		},
	},
	tags: {
		id: "00000000-0000-4000-8000-00000000a102",
		spec: {
			name: "태그 추천",
			enabled: true,
			slot: "field",
			target: "tagIds",
			collections: ["post", "memo"],
			engine: "decide",
			options: "tags",
			pick: "many",
			threshold: 0.6,
			maxCount: 5,
			inputs: ["title", "summary", "body"],
			result: "candidates",
			apply: "append",
			checks: [{ kind: "exists" }],
			prompt: "글이 이 태그의 주제를 주로 다루는가. 잠깐 언급만 하고 지나가면 해당하지 않는다.",
		},
	},
	category: {
		id: "00000000-0000-4000-8000-00000000a109",
		spec: {
			name: "카테고리 추천",
			enabled: true,
			slot: "field",
			target: "categoryId",
			collections: ["post"],
			engine: "decide",
			options: "categories",
			pick: "one",
			threshold: 0.3,
			maxCount: 2,
			inputs: ["title", "summary", "body"],
			result: "candidates",
			apply: "replace",
			checks: [{ kind: "exists" }],
			prompt: "이 글이 들어갈 블로그 카테고리를 고른다.",
		},
	},
	seoTitle: {
		id: "00000000-0000-4000-8000-00000000a10a",
		spec: {
			name: "검색 제목 추천",
			enabled: true,
			askInstruction: true,
			slot: "field",
			target: "seoTitle",
			collections: ["post", "memo"],
			inputs: ["title", "summary", "body"],
			result: "candidates",
			apply: "replace",
			checks: [{ kind: "maxLength", max: 60 }],
			prompt: [
				"검색 결과에 보일 제목 후보 3개를 쓴다.",
				"- 60자 이내, 본문과 같은 언어",
				"- 글이 답하는 질문이나 핵심 키워드를 앞쪽에 둔다",
				"- 과장하거나 낚는 표현은 쓰지 않는다",
			].join("\n"),
		},
	},
	seoDescription: {
		id: "00000000-0000-4000-8000-00000000a10b",
		spec: {
			name: "검색 설명 추천",
			enabled: true,
			askInstruction: true,
			slot: "field",
			target: "seoDescription",
			collections: ["post", "memo"],
			inputs: ["title", "summary", "body"],
			result: "text",
			apply: "replace",
			checks: [{ kind: "maxLength", max: 155 }],
			prompt: [
				"검색 결과에 제목 아래로 보일 설명을 쓴다.",
				"- 155자 이내, 1~2문장, 본문과 같은 언어",
				"- 검색한 사람이 이 글에서 무엇을 얻는지 드러낸다",
			].join("\n"),
		},
	},
	imageAlt: {
		id: "00000000-0000-4000-8000-00000000a104",
		spec: {
			name: "대체 텍스트 추천",
			enabled: true,
			askInstruction: true,
			slot: "image",
			target: "alt",
			collections: [],
			inputs: ["title", "image", "around"],
			result: "candidates",
			apply: "replace",
			checks: [{ kind: "maxLength", max: 200 }],
			prompt: [
				"이미지의 대체 텍스트 후보 3개를 쓴다.",
				"- 화면을 볼 수 없는 독자가 이 이미지가 무엇을 보여 주는지 알 수 있게 한 문장으로. 앞뒤 문단이 있으면 글 흐름에 맞춘다",
				"- 앞뒤 문단이 있으면 그 언어, 없으면 한국어",
				"- '이미지', '사진', '스크린샷' 같은 말로 시작하지 않는다",
				"- 이미지 속 글자가 중요하면 그 내용을 담는다",
			].join("\n"),
		},
	},
	imageCaption: {
		id: "00000000-0000-4000-8000-00000000a105",
		spec: {
			name: "캡션 추천",
			enabled: true,
			askInstruction: true,
			slot: "image",
			target: "caption",
			collections: [],
			inputs: ["image", "around"],
			result: "candidates",
			apply: "replace",
			checks: [{ kind: "maxLength", max: 120 }],
			prompt: [
				"이미지 아래에 붙일 짧은 캡션 후보 3개를 쓴다.",
				"- 명사형으로 짧게 끝낸다 (예: 'React Query 설정 화면')",
				"- 앞뒤 문단이 있으면 그 언어, 없으면 한국어",
				"- 대체 텍스트처럼 이미지를 자세히 묘사하지 않는다",
			].join("\n"),
		},
	},
	mediaFilename: {
		id: "00000000-0000-4000-8000-00000000a106",
		spec: {
			name: "파일 이름 추천",
			enabled: true,
			slot: "media",
			target: "filename",
			collections: [],
			inputs: ["image", "filename"],
			result: "candidates",
			apply: "replace",
			checks: [
				{ kind: "pattern", pattern: KEBAB_PATTERN },
				{ kind: "maxLength", max: 80 },
			],
			prompt: [
				"이미지 내용을 보고 파일 이름 후보 3개를 만든다.",
				"- 영어 소문자, 숫자, 하이픈만 쓰고 3~6단어로",
				"- 확장자는 쓰지 않는다(원래 확장자를 붙여 저장한다)",
				"- 'screenshot', 'image', 날짜처럼 내용과 상관없는 말은 쓰지 않는다",
			].join("\n"),
		},
	},
	translate: {
		id: "00000000-0000-4000-8000-00000000a10c",
		spec: {
			name: "번역",
			enabled: true,
			askInstruction: true,
			slot: "body",
			target: "translate",
			collections: [],
			inputs: [],
			result: "text",
			apply: "replace",
			checks: [{ kind: "structure" }],
			prompt: [
				"기술 블로그 글의 한 부분(MDX)을 대상 언어로 번역한다.",
				"- 사람이 읽는 글만 번역한다. MDX 문법, JSX·directive 이름, 코드 블록과 인라인 코드, 수식, 링크 주소, 이미지 주소는 그대로 둔다",
				"- 콜아웃 제목(title), 탭 이름(label과 defaultValue), 이미지 alt·캡션, 툴팁 설명처럼 사람이 읽는 속성 값은 번역한다",
				"- 문단·목록·표의 개수와 순서를 바꾸지 않는다. 합치거나 나누지 않는다",
				"- 기술 용어와 제품 이름은 그 언어권 개발자가 흔히 쓰는 표기를 따른다",
				"- 원문의 말투와 문체를 대상 언어에서 자연스럽게 옮긴다",
			].join("\n"),
		},
	},
	codeFold: {
		id: "00000000-0000-4000-8000-00000000a108",
		spec: {
			name: "코드 블록 정규식 생성",
			enabled: true,
			askInstruction: true,
			slot: "codeRules",
			target: "fold",
			collections: [],
			inputs: ["code"],
			result: "candidates",
			apply: "append",
			checks: [{ kind: "regexRuns" }],
			prompt: [
				"코드에서 읽는 사람이 접어 두어도 되는 부분을 찾는 JavaScript 정규식 후보 3개를 만든다.",
				"- 예: 긴 import 목록의 이름들, 긴 문자열, 반복되는 설정 값, 설명에 중요하지 않은 인자",
				"- 정규식 본문만 쓴다. 앞뒤 슬래시와 플래그는 쓰지 않는다",
				"- 한 줄 안에서 찾는다",
				"- 코드의 핵심 흐름은 접지 않는다",
			].join("\n"),
		},
	},
};

/** 기능마다 정해 둔 부분. 저장·시험 때 사용자 값보다 앞선다. */
const FIXED_KEYS = [
	"name",
	"slot",
	"target",
	"collections",
	"result",
	"apply",
	"engine",
	"options",
	"optionList",
	"pick",
] as const satisfies readonly (keyof AiFeatureSpec)[];

/**
 * 사용자 값에 기능의 정해 둔 부분을 덮어 최종 정의를 만든다. 검사는 기능에 정해 둔 종류만 남기고
 * (순서도 기능 정의대로) 사용자가 고친 켜기·값을 얹는다. 모르는 기능이면 `null`.
 * 사용자 값이 규칙에 맞지 않으면(예전 모양 등) 기본 정의를 쓴다.
 */
export function withBuiltin(builtin: string | null, value: unknown): AiFeatureSpec | null {
	const definition = builtin ? BUILTIN_AI_FEATURES[builtin] : undefined;
	if (!definition) return null;
	const base = aiFeatureSpecSchema.parse(definition.spec);
	if (!value || typeof value !== "object") return base;
	// 예전 모양(검사 하나)도 검사 목록으로 옮긴 뒤 합친다.
	const user = aiFeatureSpecSchema.safeParse(value).data;
	const raw = (user ?? value) as Record<string, unknown>;
	const userChecks = Array.isArray(raw.checks) ? (raw.checks as Array<{ kind?: unknown }>) : [];
	const fixed = Object.fromEntries(FIXED_KEYS.map((key) => [key, base[key]]));
	// 정해 둔 부분을 먼저 덮은 뒤 검사한다. 사용자 값이 규칙에 맞지 않으면 기본 정의를 쓴다.
	const merged = aiFeatureSpecSchema.safeParse({
		...raw,
		...fixed,
		checks: base.checks.map((check) => {
			const mine = userChecks.find((item) => item?.kind === check.kind);
			return mine ? { ...check, ...mine } : check;
		}),
	});
	return merged.success ? merged.data : base;
}
