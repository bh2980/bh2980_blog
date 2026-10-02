import { aiAction, aiInput } from "./action";
import { KEBAB_PATTERN } from "./definition";

/**
 * 기본 AI 기능(프리셋). `aiPlugin({ actions })`에 이름을 붙여 넣는다. 필드·컬렉션 이름은 사이트가 정한다.
 *
 * ```ts
 * aiPlugin({ actions: { summary: aiPresets.summary({ collections: ["post"] }) } })
 * ```
 *
 * 지시문은 관리자 AI 화면에서 고칠 수 있고, 프리셋 옵션 `prompt`로 처음 값을 바꿀 수도 있다.
 */

/** 필드 옆 자리가 주는 재료. 필드 기능은 이 입력을 모두 받을 수 있고, 무엇을 보낼지는 `send`로 고른다. */
const fieldInput = {
	title: aiInput.text({ label: "제목" }),
	summary: aiInput.text({ label: "요약" }),
	body: aiInput.mdx({ label: "본문" }),
	current: aiInput.value({ label: "현재 값" }),
};

type FieldOptions = {
	/** 붙일 필드. 없으면 프리셋의 기본 필드 이름. */
	readonly field?: string;
	/** 붙일 컬렉션. 없으면 그 필드가 있는 모든 컬렉션. */
	readonly collections?: readonly string[];
	readonly prompt?: string;
};

const fieldAttach = (field: string, collections?: readonly string[]) =>
	[{ slot: "field", field, ...(collections ? { collections } : {}) }] as const;

const lines = (...text: string[]) => text.join("\n");

export const aiPresets = {
	/** 주소(slug) 후보. 형식·길이·같은 컬렉션·언어 안의 중복을 검사한다. */
	slug: (options: FieldOptions = {}) =>
		aiAction({
			label: "주소 추천",
			input: fieldInput,
			send: ["title", "body"],
			result: "candidates",
			checks: [{ kind: "pattern", pattern: KEBAB_PATTERN }, { kind: "maxLength", max: 80 }, { kind: "unique" }],
			prompt:
				options.prompt ??
				lines(
					"글 제목과 본문을 보고 영어 URL 주소(slug) 후보 3개를 만든다.",
					"- 소문자 영어, 숫자, 하이픈만 쓴다. 점·밑줄·공백은 쓰지 않는다",
					"- 2~5단어. 관사와 전치사는 되도록 뺀다",
					"- 기술 이름은 널리 쓰는 표기를 따른다 (nextjs, react-query, typescript)",
					"- 글의 핵심 주제가 드러나게 한다",
				),
			attach: fieldAttach(options.field ?? "slug", options.collections),
		}),

	/** 요약 글. */
	summary: (options: FieldOptions & { readonly maxLength?: number } = {}) =>
		aiAction({
			label: "요약 만들기",
			input: fieldInput,
			send: ["title", "body"],
			result: "text",
			askInstruction: true,
			checks: [{ kind: "maxLength", max: options.maxLength ?? 160 }],
			prompt:
				options.prompt ??
				lines(
					"글 목록과 공유 미리보기에 보일 요약을 쓴다.",
					`- 1~2문장, ${options.maxLength ?? 160}자 이내`,
					"- 본문과 같은 언어, '~다'체",
					"- 글에서 무엇을 알 수 있는지 드러낸다. '이 글에서는' 같은 말로 시작하지 않는다",
				),
			attach: fieldAttach(options.field ?? "summary", options.collections),
		}),

	/** 관계 필드(여러 개)에 더할 항목을 판단 모델로 고른다. 예: 태그. */
	tags: (
		options: FieldOptions & { readonly choices: string; readonly threshold?: number; readonly maxCount?: number },
	) =>
		aiAction({
			label: "태그 추천",
			input: fieldInput,
			send: ["title", "summary", "body"],
			engine: "decide",
			choices: { from: "collection", collection: options.choices },
			pick: "many",
			threshold: options.threshold ?? 0.6,
			maxCount: options.maxCount ?? 5,
			result: "candidates",
			apply: "append",
			checks: [{ kind: "exists" }],
			prompt: options.prompt ?? "글이 이 태그의 주제를 주로 다루는가. 잠깐 언급만 하고 지나가면 해당하지 않는다.",
			attach: fieldAttach(options.field ?? "tagIds", options.collections),
		}),

	/** 관계 필드(하나)에 넣을 항목을 판단 모델로 고른다. 예: 카테고리. */
	category: (
		options: FieldOptions & { readonly choices: string; readonly threshold?: number; readonly maxCount?: number },
	) =>
		aiAction({
			label: "카테고리 추천",
			input: fieldInput,
			send: ["title", "summary", "body"],
			engine: "decide",
			choices: { from: "collection", collection: options.choices },
			pick: "one",
			threshold: options.threshold ?? 0.3,
			maxCount: options.maxCount ?? 2,
			result: "candidates",
			checks: [{ kind: "exists" }],
			prompt: options.prompt ?? "이 글이 들어갈 블로그 카테고리를 고른다.",
			attach: fieldAttach(options.field ?? "categoryId", options.collections),
		}),

	/** 검색 결과에 보일 제목 후보. */
	seoTitle: (options: FieldOptions = {}) =>
		aiAction({
			label: "검색 제목 추천",
			input: fieldInput,
			send: ["title", "summary", "body"],
			result: "candidates",
			askInstruction: true,
			checks: [{ kind: "maxLength", max: 60 }],
			prompt:
				options.prompt ??
				lines(
					"검색 결과에 보일 제목 후보 3개를 쓴다.",
					"- 60자 이내, 본문과 같은 언어",
					"- 글이 답하는 질문이나 핵심 키워드를 앞쪽에 둔다",
					"- 과장하거나 낚는 표현은 쓰지 않는다",
				),
			attach: fieldAttach(options.field ?? "seoTitle", options.collections),
		}),

	/** 검색 결과에 보일 설명. */
	seoDescription: (options: FieldOptions = {}) =>
		aiAction({
			label: "검색 설명 추천",
			input: fieldInput,
			send: ["title", "summary", "body"],
			result: "text",
			askInstruction: true,
			checks: [{ kind: "maxLength", max: 155 }],
			prompt:
				options.prompt ??
				lines(
					"검색 결과에 제목 아래로 보일 설명을 쓴다.",
					"- 155자 이내, 1~2문장, 본문과 같은 언어",
					"- 검색한 사람이 이 글에서 무엇을 얻는지 드러낸다",
				),
			attach: fieldAttach(options.field ?? "seoDescription", options.collections),
		}),

	/** 본문 이미지의 대체 텍스트. 미디어 화면의 기본 대체 텍스트도 같은 기능을 쓴다. */
	imageAlt: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "대체 텍스트 추천",
			input: {
				image: aiInput.image({ label: "이미지" }),
				around: aiInput.text({ label: "앞뒤 문단" }),
				current: aiInput.value({ label: "현재 값" }),
			},
			send: ["image", "around"],
			result: "candidates",
			askInstruction: true,
			checks: [{ kind: "maxLength", max: 200 }],
			prompt:
				options.prompt ??
				lines(
					"이미지의 대체 텍스트 후보 3개를 쓴다.",
					"- 화면을 볼 수 없는 독자가 이 이미지가 무엇을 보여 주는지 알 수 있게 한 문장으로. 앞뒤 문단이 있으면 글 흐름에 맞춘다",
					"- 앞뒤 문단이 있으면 그 언어, 없으면 한국어",
					"- '이미지', '사진', '스크린샷' 같은 말로 시작하지 않는다",
					"- 이미지 속 글자가 중요하면 그 내용을 담는다",
				),
			attach: [
				{ slot: "image", target: "alt" },
				{ slot: "media", target: "defaultAlt" },
			],
		}),

	/** 본문 이미지의 캡션. 미디어 화면의 기본 캡션도 같은 기능을 쓴다. */
	imageCaption: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "캡션 추천",
			input: {
				image: aiInput.image({ label: "이미지" }),
				around: aiInput.text({ label: "앞뒤 문단" }),
				current: aiInput.value({ label: "현재 값" }),
			},
			send: ["image", "around"],
			result: "candidates",
			askInstruction: true,
			checks: [{ kind: "maxLength", max: 120 }],
			prompt:
				options.prompt ??
				lines(
					"이미지 아래에 붙일 짧은 캡션 후보 3개를 쓴다.",
					"- 명사형으로 짧게 끝낸다 (예: 'React Query 설정 화면')",
					"- 앞뒤 문단이 있으면 그 언어, 없으면 한국어",
					"- 대체 텍스트처럼 이미지를 자세히 묘사하지 않는다",
				),
			attach: [
				{ slot: "image", target: "caption" },
				{ slot: "media", target: "defaultCaption" },
			],
		}),

	/** 미디어 파일 이름 후보. */
	mediaFilename: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "파일 이름 추천",
			input: {
				image: aiInput.image({ label: "이미지" }),
				filename: aiInput.text({ label: "파일 이름" }),
				current: aiInput.value({ label: "현재 값" }),
			},
			send: ["image", "filename"],
			result: "candidates",
			checks: [
				{ kind: "pattern", pattern: KEBAB_PATTERN },
				{ kind: "maxLength", max: 80 },
			],
			prompt:
				options.prompt ??
				lines(
					"이미지 내용을 보고 파일 이름 후보 3개를 만든다.",
					"- 영어 소문자, 숫자, 하이픈만 쓰고 3~6단어로",
					"- 확장자는 쓰지 않는다(원래 확장자를 붙여 저장한다)",
					"- 'screenshot', 'image', 날짜처럼 내용과 상관없는 말은 쓰지 않는다",
				),
			attach: [{ slot: "media", target: "filename" }],
		}),

	/** 번역본 편집기의 블록 번역. 원문과 뼈대가 같은 MDX만 받는다. */
	translate: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "번역",
			input: {
				block: aiInput.mdx({ label: "원문", required: true }),
				from: aiInput.locale({ label: "원문 언어", required: true }),
				to: aiInput.locale({ label: "대상 언어", required: true }),
			},
			result: "mdx",
			sameStructureAs: "block",
			askInstruction: true,
			checks: [{ kind: "structure" }],
			prompt:
				options.prompt ??
				lines(
					"블로그 글의 한 부분(MDX)을 대상 언어로 번역한다.",
					"- 사람이 읽는 글만 번역한다. MDX 문법, JSX·directive 이름, 코드 블록과 인라인 코드, 수식, 링크 주소, 이미지 주소는 그대로 둔다",
					"- 콜아웃 제목(title), 탭 이름(label과 defaultValue), 이미지 alt·캡션, 툴팁 설명처럼 사람이 읽는 속성 값은 번역한다",
					"- 문단·목록·표의 개수와 순서를 바꾸지 않는다. 합치거나 나누지 않는다",
					"- 기술 용어와 제품 이름은 그 언어권 개발자가 흔히 쓰는 표기를 따른다",
					"- 원문의 말투와 문체를 대상 언어에서 자연스럽게 옮긴다",
				),
			attach: [{ slot: "translation" }],
		}),

	/**
	 * 문체 다듬기(M8-2). 본문에서 고른 글을 다듬어 바뀐 곳을 보여 주고, 누르면 고른 글을 바꾼다. 결과는 흘려받는다.
	 * `styleGuide`에 공통 문구 이름을 주면 그 문구(예: 문체 가이드)를 지시문에 넣는다.
	 */
	polish: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) =>
		aiAction({
			label: "문체 다듬기",
			input: {
				selection: aiInput.mdx({ label: "고칠 글", required: true }),
				title: aiInput.text({ label: "제목" }),
			},
			result: "mdx",
			stream: true,
			askInstruction: true,
			prompt:
				options.prompt ??
				lines(
					"블로그 글에서 고른 부분(MDX)의 문체를 다듬는다.",
					"- 뜻과 사실, 링크 주소, 코드, 수식, MDX 문법은 그대로 둔다",
					"- 어색하거나 긴 문장을 자연스럽고 읽기 쉽게 고친다. 없는 내용을 더하지 않는다",
					"- 원문과 같은 언어, 같은 말투로 쓴다",
					...(options.styleGuide ? ["", "문체 가이드:", `{{shared.${options.styleGuide}}}`] : []),
				),
			attach: [{ slot: "selection" }],
		}),

	/**
	 * 초안 쓰기(M8-3). 슬래시 메뉴·빈 문서에서 요청을 받아 커서 자리에 넣을 본문 초안(MDX)을 쓴다. 결과는 흘려받는다.
	 * `styleGuide`에 공통 문구 이름을 주면 그 문구를 지시문에 넣는다.
	 */
	draft: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) =>
		aiAction({
			label: "초안 쓰기",
			input: {
				title: aiInput.text({ label: "제목" }),
				body: aiInput.mdx({ label: "지금 본문" }),
			},
			result: "mdx",
			stream: true,
			askInstruction: true,
			prompt:
				options.prompt ??
				lines(
					"블로그 글의 제목과 지금까지 쓴 본문, 이번 요청을 보고 커서 자리에 넣을 본문 초안을 MDX로 쓴다.",
					"- 본문 제목은 ## 부터 쓴다(글 제목은 따로 있다)",
					"- 지금 본문과 겹치지 않게, 앞뒤 흐름에 이어지게 쓴다",
					"- 모르는 사실은 지어내지 않는다. 확인이 필요한 곳은 [확인 필요]로 적는다",
					"- 제목과 같은 언어로 쓴다",
					...(options.styleGuide ? ["", "문체 가이드:", `{{shared.${options.styleGuide}}}`] : []),
				),
			attach: [{ slot: "insert" }],
		}),

	/** 코드 블록에서 접어 둘 부분을 찾는 정규식 후보. */
	codeFold: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "코드 블록 정규식 생성",
			input: { code: aiInput.code({ label: "코드" }) },
			result: "candidates",
			apply: "append",
			askInstruction: true,
			checks: [{ kind: "regexRuns" }],
			prompt:
				options.prompt ??
				lines(
					"코드에서 읽는 사람이 접어 두어도 되는 부분을 찾는 JavaScript 정규식 후보 3개를 만든다.",
					"- 예: 긴 import 목록의 이름들, 긴 문자열, 반복되는 설정 값, 설명에 중요하지 않은 인자",
					"- 정규식 본문만 쓴다. 앞뒤 슬래시와 플래그는 쓰지 않는다",
					"- 한 줄 안에서 찾는다",
					"- 코드의 핵심 흐름은 접지 않는다",
				),
			attach: [{ slot: "codeRules", target: "fold" }],
		}),
};
