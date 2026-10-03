import { type CollectionSchema, type StoredField, SUMMARY_ROLE, valueFieldsOf } from "@bh2980/cms";
import { type AiAttach, type AiSiteView, aiAction, aiInput } from "./action";
import { regexRuns, sameStructure, uniqueSlug } from "./validators";

/**
 * 기본 AI 기능(프리셋). `aiPlugin()`을 넣으면 사이트에 붙을 곳이 있는 기본 기능이 저절로 켜진다. 바꿀 것만
 * `aiPlugin({ actions })`에 같은 이름으로 적는다(`false`면 끈다).
 *
 * ```ts
 * aiPlugin({ actions: { summary: aiPresets.summary({ maxLength: 120 }), draft: false } })
 * ```
 *
 * 필드 기능은 필드 이름이 아니라 필드 종류·역할·관계 대상으로 붙을 필드를 찾는다. 본문을 읽는 기능이라 본문이 있는
 * 컬렉션에만 붙는다. 지시문은 관리자 AI 화면에서 고칠 수 있고, 프리셋 옵션 `prompt`로 처음 값을 바꿀 수도 있다.
 */

/** 필드 옆 자리가 주는 재료. 필드 기능은 이 입력을 모두 받을 수 있고, 무엇을 보낼지는 `send`로 고른다. */
const fieldInput = {
	title: aiInput.text({ label: "제목" }),
	summary: aiInput.text({ label: "요약" }),
	body: aiInput.mdx({ label: "본문" }),
	current: aiInput.value({ label: "현재 값" }),
};

type FieldOptions = {
	/** 붙일 필드 이름. 없으면 필드 종류·역할·관계 대상으로 찾는다. */
	readonly field?: string;
	/** 붙일 컬렉션. 없으면 본문이 있는 모든 컬렉션 중 붙을 필드가 있는 것. */
	readonly collections?: readonly string[];
	readonly prompt?: string;
};

/** 붙을 필드 하나. */
export interface AiFieldTarget {
	readonly collection: string;
	readonly name: string;
	readonly label: string;
	readonly max?: number;
}

/** 필드 기능이 볼 컬렉션: 옵션의 `collections`, 없으면 본문이 있는 컬렉션. */
const candidateCollections = (site: AiSiteView, options: FieldOptions): [string, CollectionSchema][] =>
	Object.entries(site.collections).filter(([name, schema]) =>
		options.collections ? options.collections.includes(name) : schema.body,
	);

/**
 * 컬렉션마다 붙을 필드를 찾는다. `field`를 주면 그 이름의 필드를, 아니면 `pick`이 고른 필드다. 컬렉션마다 하나다.
 */
export function fieldTargets(
	site: AiSiteView,
	options: FieldOptions,
	pick: (
		schema: CollectionSchema,
	) => { readonly name: string; readonly field: { readonly label?: string } } | undefined,
): AiFieldTarget[] {
	return candidateCollections(site, options).flatMap(([collection, schema]) => {
		const found = options.field
			? (valueFieldsOf(schema).find((stored) => stored.name === options.field) ??
				(schema.fields[options.field] ? { name: options.field, field: schema.fields[options.field] } : undefined))
			: pick(schema);
		if (!found) return [];
		const max = "max" in found.field && typeof found.field.max === "number" ? found.field.max : undefined;
		return [{ collection, name: found.name, label: found.field.label ?? found.name, ...(max ? { max } : {}) }];
	});
}

/** 붙을 곳. 필드 이름마다 하나이고 그 이름이 있는 컬렉션을 적는다. */
export function fieldAttachOf(targets: readonly AiFieldTarget[]): Extract<AiAttach, { slot: "field" }>[] {
	const byName = new Map<string, string[]>();
	for (const { name, collection } of targets) byName.set(name, [...(byName.get(name) ?? []), collection]);
	return [...byName].map(([field, collections]) => ({ slot: "field", field, collections }));
}

/** 붙을 필드들의 가장 작은 `max`. 없으면 `undefined`. */
export const smallestMax = (targets: readonly AiFieldTarget[]): number | undefined => {
	const maxes = targets.flatMap((target) => (target.max === undefined ? [] : [target.max]));
	return maxes.length > 0 ? Math.min(...maxes) : undefined;
};

/** 레코드(분류) 컬렉션을 가리키는 관계 필드. `many`로 여러 개·하나를 고른다. */
const recordRelation =
	(site: AiSiteView, many: boolean, to?: string) =>
	(schema: CollectionSchema): StoredField | undefined =>
		valueFieldsOf(schema).find(
			({ field }) =>
				field.kind === "relation" &&
				Boolean(field.many) === many &&
				(to ? field.to === to : site.collections[field.to]?.kind === "item"),
		);

const lines = (...text: string[]) => text.join("\n");

/** 받침이 있으면 `with`, 없으면 `without`(한글이 아니면 둘 다 적는다). */
const josa = (word: string, withFinal: string, withoutFinal: string) => {
	const code = word.charCodeAt(word.length - 1) - 0xac00;
	if (code < 0 || code > 11171) return `${word}${withFinal}(${withoutFinal})`;
	return `${word}${code % 28 ? withFinal : withoutFinal}`;
};

/** 주소·파일 이름처럼 소문자·숫자·하이픈만 쓰는 값의 형식. 주소·파일 이름 프리셋의 `형식` 검사에 채워 둔다. */
export const KEBAB_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

/** 앞뒤 문단이 없을 때 쓰는 언어. 실행기가 지시에 "콘텐츠 언어"(글의 언어, 없으면 사이트 기본 언어)를 붙인다. */
const LANGUAGE_RULE = "- 앞뒤 문단이 있으면 그 언어, 없으면 콘텐츠 언어";

/** 번역할 블록 속성(정의의 `translatable`과, 번역할 자식 속성 값을 가리키는 `childValue`). */
export function translatableAttributes(site: Pick<AiSiteView, "blocks">): string {
	const byName = new Map(site.blocks.map((block) => [block.name, block]));
	return site.blocks
		.flatMap((block) => {
			const names = Object.entries(block.attributes)
				.filter(([, attribute]) => {
					if (attribute.translatable) return true;
					const childValue = attribute.childValue;
					return Boolean(
						childValue &&
							(block.children?.blocks ?? []).some(
								(child) => byName.get(child)?.attributes[childValue]?.translatable === true,
							),
					);
				})
				.map(([name]) => name);
			return names.length > 0 ? [`${block.label}(${names.join("·")})`] : [];
		})
		.join(", ");
}

export const aiPresets = {
	/** 주소(slug) 하나를 만들어 바로 넣는다. 주소 필드(`fields.slug`)에 붙는다. 형식·길이·같은 컬렉션·언어 안의 중복을 검사한다. */
	slug: (options: FieldOptions = {}) => {
		return (site: AiSiteView) => {
			const targets = fieldTargets(site, options, (schema) => {
				const found = Object.entries(schema.fields).find(([, field]) => field.kind === "slug");
				return found ? { name: found[0], field: found[1] } : undefined;
			});
			if (targets.length === 0) return undefined;
			return aiAction({
				label: "주소 추천",
				input: fieldInput,
				// 지금 주소를 함께 보내 누를 때마다 다른 주소를 만들게 한다.
				send: ["title", "body", "current"],
				result: "candidates",
				instant: true,
				checks: [{ kind: "pattern", pattern: KEBAB_PATTERN }, { kind: "maxLength", max: 80 }, uniqueSlug],
				prompt:
					options.prompt ??
					lines(
						"글 제목과 본문을 보고 영어 URL 주소(slug) 하나를 만든다.",
						"- 지금 값이 있으면 그것과 다른 주소를 만든다",
						"- 소문자 영어, 숫자, 하이픈만 쓴다. 점·밑줄·공백은 쓰지 않는다",
						"- 2~5단어. 관사와 전치사는 되도록 뺀다",
						"- 기술 이름은 널리 쓰는 표기를 따른다 (nextjs, react-query, typescript)",
						"- 글의 핵심 주제가 드러나게 한다",
					),
				attach: fieldAttachOf(targets),
			});
		};
	},

	/** 요약 글. 요약 역할(`role: "summary"`) 필드에 붙는다. 글자 수는 필드 `max`, 없으면 160. */
	summary: (options: FieldOptions & { readonly maxLength?: number } = {}) => {
		return (site: AiSiteView) => {
			const targets = fieldTargets(site, options, (schema) =>
				valueFieldsOf(schema).find((stored) => stored.field.role === SUMMARY_ROLE),
			);
			if (targets.length === 0) return undefined;
			const max = options.maxLength ?? smallestMax(targets) ?? 160;
			return aiAction({
				label: "요약 만들기",
				input: fieldInput,
				send: ["title", "body"],
				result: "text",
				askInstruction: true,
				checks: [{ kind: "maxLength", max }],
				prompt:
					options.prompt ??
					lines(
						"글 목록과 공유 미리보기에 보일 요약을 쓴다.",
						`- 1~2문장, ${max}자 이내`,
						"- 본문과 같은 언어, '~다'체",
						"- 글에서 무엇을 알 수 있는지 드러낸다. '이 글에서는' 같은 말로 시작하지 않는다",
					),
				attach: fieldAttachOf(targets),
			});
		};
	},

	/**
	 * 레코드(분류) 컬렉션을 가리키는 여러 개 관계 필드(예: 태그)에 더할 항목을 판단 모델로 고른다. 선택지는 관계 대상
	 * 컬렉션(`choices`, 없으면 처음 찾은 필드의 대상)이다.
	 */
	tags: (
		options: FieldOptions & { readonly choices?: string; readonly threshold?: number; readonly maxCount?: number } = {},
	) => {
		return (site: AiSiteView) => {
			const first = options.choices ?? firstRelationTarget(site, options, true);
			if (!first) return undefined;
			const targets = fieldTargets(site, options, recordRelation(site, true, first));
			if (targets.length === 0) return undefined;
			return aiAction({
				label: `${targets[0]?.label ?? "태그"} 추천`,
				input: fieldInput,
				send: ["title", "summary", "body"],
				engine: "decide",
				choices: { from: "collection", collection: first },
				pick: "many",
				threshold: options.threshold ?? 0.6,
				maxCount: options.maxCount ?? 5,
				result: "candidates",
				apply: "append",
				checks: [{ kind: "exists" }],
				prompt:
					options.prompt ??
					`글이 이 ${targets[0]?.label ?? "항목"}의 주제를 주로 다루는가. 잠깐 언급만 하고 지나가면 해당하지 않는다.`,
				attach: fieldAttachOf(targets),
			});
		};
	},

	/**
	 * 레코드(분류) 컬렉션을 가리키는 하나 관계 필드(예: 카테고리)에 넣을 항목을 판단 모델로 고른다. 선택지는 관계 대상
	 * 컬렉션(`choices`, 없으면 처음 찾은 필드의 대상)이다.
	 */
	category: (
		options: FieldOptions & { readonly choices?: string; readonly threshold?: number; readonly maxCount?: number } = {},
	) => {
		return (site: AiSiteView) => {
			const first = options.choices ?? firstRelationTarget(site, options, false);
			if (!first) return undefined;
			const targets = fieldTargets(site, options, recordRelation(site, false, first));
			if (targets.length === 0) return undefined;
			const label = targets[0]?.label ?? "분류";
			return aiAction({
				label: `${label} 추천`,
				input: fieldInput,
				send: ["title", "summary", "body"],
				engine: "decide",
				choices: { from: "collection", collection: first },
				pick: "one",
				threshold: options.threshold ?? 0.3,
				maxCount: options.maxCount ?? 2,
				result: "candidates",
				checks: [{ kind: "exists" }],
				prompt: options.prompt ?? `이 글이 들어갈 ${josa(label, "을", "를")} 고른다.`,
				attach: fieldAttachOf(targets),
			});
		};
	},

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
					LANGUAGE_RULE,
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
					LANGUAGE_RULE,
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

	/**
	 * 번역본 편집기의 블록 번역. 원문과 뼈대가 같은 MDX만 받는다. 언어가 둘 이상인 사이트에서만 켜진다. 번역할 블록 속성은
	 * 사이트가 쓰는 블록 정의(`translatable`)에서 만든다.
	 */
	translate: (options: { readonly prompt?: string } = {}) => {
		return (site: AiSiteView) => {
			if (site.locales.length < 2) return undefined;
			const attributes = translatableAttributes(site);
			return aiAction({
				label: "번역",
				input: {
					block: aiInput.mdx({ label: "원문", required: true }),
					from: aiInput.locale({ label: "원문 언어", required: true }),
					to: aiInput.locale({ label: "대상 언어", required: true }),
				},
				result: "mdx",
				askInstruction: true,
				checks: [sameStructure("block")],
				prompt:
					options.prompt ??
					lines(
						"글의 한 부분(MDX)을 대상 언어로 번역한다.",
						"- 사람이 읽는 글만 번역한다. MDX 문법, JSX·directive 이름, 코드 블록과 인라인 코드, 수식, 링크 주소, 이미지 주소는 그대로 둔다",
						...(attributes ? [`- 사람이 읽는 블록 속성 값은 번역한다: ${attributes}`] : []),
						"- 문단·목록·표의 개수와 순서를 바꾸지 않는다. 합치거나 나누지 않는다",
						"- 기술 용어와 제품 이름은 그 언어권 개발자가 흔히 쓰는 표기를 따른다",
						"- 원문의 말투와 문체를 대상 언어에서 자연스럽게 옮긴다",
					),
				attach: [{ slot: "translation" }],
			});
		};
	},

	/**
	 * 문체 다듬기(M8-2). 본문에서 고른 글을 다듬어 바뀐 곳을 보여 주고, 누르면 고른 글을 바꾼다. 결과는 흘려받는다.
	 * `styleGuide`에 설정 공통 문구(`aiPlugin({ shared })`)의 키를 주면 그 문구(예: 문체 가이드)를 지시문에 넣는다. 없으면
	 * 공통 문구 `styleGuide`가 있을 때 그것을 넣는다. 본문이 있는 컬렉션이 있을 때만 켜진다.
	 */
	polish: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) => {
			if (!hasBody(site)) return undefined;
			const styleGuide = styleGuideOf(site, options.styleGuide);
			return aiAction({
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
						"글에서 고른 부분(MDX)의 문체를 다듬는다.",
						"- 뜻과 사실, 링크 주소, 코드, 수식, MDX 문법은 그대로 둔다",
						"- 어색하거나 긴 문장을 자연스럽고 읽기 쉽게 고친다. 없는 내용을 더하지 않는다",
						"- 원문과 같은 언어, 같은 말투로 쓴다",
						...(styleGuide ? ["", "문체 가이드:", `{{shared.${styleGuide}}}`] : []),
					),
				attach: [{ slot: "selection" }],
			});
		};
	},

	/**
	 * 초안 쓰기(M8-3). 슬래시 메뉴·빈 문서에서 요청을 받아 커서 자리에 넣을 본문 초안(MDX)을 쓴다. 결과는 흘려받는다.
	 * 문체 가이드는 `polish`와 같다. 본문이 있는 컬렉션이 있을 때만 켜진다.
	 */
	draft: (options: { readonly prompt?: string; readonly styleGuide?: string } = {}) => {
		return (site: AiSiteView) => {
			if (!hasBody(site)) return undefined;
			const styleGuide = styleGuideOf(site, options.styleGuide);
			return aiAction({
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
						"글의 제목과 지금까지 쓴 본문, 이번 요청을 보고 커서 자리에 넣을 본문 초안을 MDX로 쓴다.",
						"- 본문 제목은 ## 부터 쓴다(글 제목은 따로 있다)",
						"- 지금 본문과 겹치지 않게, 앞뒤 흐름에 이어지게 쓴다",
						"- 모르는 사실은 지어내지 않는다. 확인이 필요한 곳은 [확인 필요]로 적는다",
						"- 제목과 같은 언어로 쓴다",
						...(styleGuide ? ["", "문체 가이드:", `{{shared.${styleGuide}}}`] : []),
					),
				attach: [{ slot: "insert" }],
			});
		};
	},

	/** 코드 블록에서 접어 둘 부분을 찾는 정규식 후보. */
	codeFold: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "코드 블록 정규식 생성",
			input: { code: aiInput.code({ label: "코드" }) },
			result: "candidates",
			apply: "append",
			askInstruction: true,
			checks: [regexRuns("code")],
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

/** 처음 찾은 레코드 관계 필드의 대상 컬렉션(필드 기능이 볼 컬렉션 안에서, 선언 순서). */
function firstRelationTarget(site: AiSiteView, options: FieldOptions, many: boolean): string | undefined {
	for (const [, schema] of candidateCollections(site, options)) {
		const stored = options.field
			? valueFieldsOf(schema).find((item) => item.name === options.field)
			: recordRelation(site, many)(schema);
		if (stored?.field.kind === "relation") return stored.field.to;
	}
	return undefined;
}

const hasBody = (site: AiSiteView) => Object.values(site.collections).some((schema) => schema.body);

/** 지시문에 넣을 공통 문구 이름. 옵션이 없으면 `styleGuide` 문구가 있을 때 그것. */
const styleGuideOf = (site: AiSiteView, option: string | undefined) =>
	option ?? (site.sharedKeys.includes("styleGuide") ? "styleGuide" : undefined);

/**
 * 기본으로 켜는 기능(이름 → 만드는 함수). 순서가 관리자 AI 화면의 순서다(필드 옆 기능이 먼저). 사이트에 붙을 곳이 없으면
 * 켜지지 않는다.
 */
export const DEFAULT_AI_ACTIONS = {
	slug: aiPresets.slug(),
	summary: aiPresets.summary(),
	tags: aiPresets.tags(),
	category: aiPresets.category(),
	imageAlt: aiPresets.imageAlt(),
	imageCaption: aiPresets.imageCaption(),
	mediaFilename: aiPresets.mediaFilename(),
	translate: aiPresets.translate(),
	codeFold: aiPresets.codeFold(),
	polish: aiPresets.polish(),
	draft: aiPresets.draft(),
};
