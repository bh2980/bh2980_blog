import { describe, expect, it } from "vitest";
import {
	type AiActionInput,
	type AiActionResult,
	aiAction,
	aiInput,
	overrideFrom,
	renderPrompt,
	resolveAction,
	unknownPlaceholders,
	validateAiConfig,
} from "../action";
import { legacyFeatureOverride } from "../actions";
import { type AiCandidate, KEBAB_PATTERN } from "../definition";
import { aiPresets } from "../presets";
import { AI_ACTIONS } from "../registry";

/** 두 타입이 같은가(타입 검사용). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

const collections = {
	post: {
		fields: {
			title: { kind: "text" },
			slug: { kind: "slug" },
			tagIds: { kind: "relation" },
			policy: { kind: "conditional", discriminant: { kind: "select" } },
		},
	},
	tag: { fields: { title: { kind: "text" } } },
} as const;

describe("AI 기능 정의", () => {
	it("정의에 고친 값을 얹는다. 검사는 정의의 종류·순서를 지키고 켜기·값만 바뀐다", () => {
		const slug = aiPresets.slug();
		const action = resolveAction("slug", slug, {
			prompt: "바꾼 지시문",
			send: ["title", "nope"],
			checks: [
				{ kind: "unique", enabled: false },
				{ kind: "regexRuns", enabled: true },
				{ kind: "maxLength", max: 40, enabled: true },
			],
		});
		expect(action).toMatchObject({ label: "주소 추천", prompt: "바꾼 지시문", send: ["title"], apply: "replace" });
		// 필수 입력은 끌 수 없다.
		expect(resolveAction("translate", aiPresets.translate(), { send: [] }).send).toEqual(["block", "from", "to"]);
		expect(action.checks).toEqual([
			{ kind: "pattern", pattern: KEBAB_PATTERN, enabled: true },
			{ kind: "maxLength", max: 40, enabled: true },
			{ kind: "unique", enabled: false },
		]);
	});

	it("저장할 고친 값은 기본값과 다른 것만 남긴다", () => {
		const summary = aiPresets.summary();
		const base = resolveAction("summary", summary);
		expect(overrideFrom(summary, { ...base })).toEqual({});
		expect(overrideFrom(summary, { ...base, enabled: false, modelName: "m" })).toEqual({
			enabled: false,
			modelName: "m",
		});
	});

	it("지시문에는 언어 입력만 {{이름}}으로 넣고, 쓰지 않은 언어 입력은 줄로 붙인다", () => {
		const input = {
			block: aiInput.mdx({ label: "원문" }),
			to: aiInput.locale({ label: "대상 언어" }),
			from: aiInput.locale({ label: "원문 언어" }),
		};
		expect(unknownPlaceholders("{{to}}로 {{block}}", input)).toEqual(["block"]);
		const names = (code: string) => ({ ko: "한국어", en: "English" })[code] ?? code;
		expect(
			renderPrompt(
				{ prompt: "{{to}}로 옮긴다.", input, askInstruction: true },
				{ to: "en", from: "ko" },
				names,
				" 짧게 ",
			),
		).toBe("English로 옮긴다.\n\n원문 언어: 한국어\n\n이번 요청(위 지시보다 우선):\n짧게");
		expect(renderPrompt({ prompt: "p", input, askInstruction: false }, {}, names, "무시")).toBe("p");
	});

	it("설정 확인: 선택지·붙을 곳·검사가 정의와 맞지 않으면 알린다", () => {
		const ok = (actions: Record<string, unknown>) => () =>
			validateAiConfig({ actions } as Parameters<typeof validateAiConfig>[0], collections);
		expect(ok({ tags: aiPresets.tags({ choices: "tag", collections: ["post"] }) })).not.toThrow();
		expect(ok({ tags: aiPresets.tags({ choices: "nope" }) })).toThrow(/unknown collection/);
		expect(ok({ slug: aiPresets.slug({ field: "missing" }) })).toThrow(/unknown field/);
		expect(ok({ slug: aiPresets.slug({ collections: ["tag"] }) })).toThrow(/no field "slug"/);
		expect(ok({ "bad-key": aiPresets.slug() })).toThrow(/name/);
		expect(ok({ x: { ...aiPresets.summary(), prompt: "{{title}}" } })).toThrow(/locale inputs/);
		expect(ok({ x: { ...aiPresets.summary(), engine: "decide" } })).toThrow(/choices/);
		expect(ok({ x: { ...aiPresets.summary(), checks: [{ kind: "exists" }] } })).toThrow(/choices/);
		expect(ok({ x: { ...aiPresets.codeFold(), attach: [{ slot: "field", field: "title" }] } })).not.toThrow();
		expect(ok({ x: { ...aiPresets.translate(), attach: [{ slot: "field", field: "title" }] } })).toThrow(/cannot fill/);
		expect(
			ok({
				x: {
					...aiPresets.category({ choices: "tag" }),
					choices: { from: "select", collection: "post", field: "policy" },
					attach: [],
				},
			}),
		).not.toThrow();
	});

	it("예시 설정의 모든 기능이 정의 규칙에 맞는다", () => {
		expect(Object.keys(AI_ACTIONS)).toEqual([
			"slug",
			"summary",
			"tags",
			"category",
			"seoTitle",
			"seoDescription",
			"imageAlt",
			"imageCaption",
			"mediaFilename",
			"translate",
			"codeFold",
		]);
	});

	it("예전 기능 표의 저장 값을 고친 값으로 옮긴다(예전 검사 모양·없는 입력·없는 기능 포함)", () => {
		expect(
			legacyFeatureOverride("summary", {
				enabled: false,
				prompt: "운영자가 고친 지시문",
				inputs: ["title", "tags", "body"],
				check: "maxLength",
				maxLength: 120,
				name: "무시되는 이름",
			}),
		).toEqual({
			enabled: false,
			prompt: "운영자가 고친 지시문",
			checks: [{ kind: "maxLength", max: 120, enabled: true }],
		});
		expect(legacyFeatureOverride("summary", { ...resolveAction("summary", aiPresets.summary()) })).toEqual({});
		expect(legacyFeatureOverride("mediaAlt", { prompt: "x" })).toBeNull();
		expect(legacyFeatureOverride("translate", { inputs: [], prompt: AI_ACTIONS.translate?.prompt })).toEqual({});
		expect(legacyFeatureOverride("slug", { checks: [{ kind: "pattern", pattern: "(" }] })).toEqual({});
	});

	it("타입: 지시문 자리 표시·붙을 곳·입력·결과를 정의에서 확인한다", () => {
		const translate = aiPresets.translate();
		const input: Equal<AiActionInput<typeof translate>, { block: string; from: string; to: string }> = true;
		const mdx: Equal<AiActionResult<typeof translate>, { kind: "mdx"; text: string }> = true;
		const tags = aiPresets.tags({ choices: "tag" });
		const candidates: Equal<AiActionResult<typeof tags>, { kind: "candidates"; items: AiCandidate[] }> = true;
		const summaryInput: Equal<
			AiActionInput<ReturnType<typeof aiPresets.summary>>,
			{ title?: string; summary?: string; body?: string; current?: string | readonly string[] }
		> = true;
		expect([input, mdx, candidates, summaryInput]).toEqual([true, true, true, true]);
		aiAction({
			label: "x",
			input: { to: aiInput.locale({ label: "언어" }) },
			result: "text",
			prompt: "{{to}}로 쓴다",
		});
		aiAction({
			label: "x",
			input: { title: aiInput.text({ label: "제목" }) },
			result: "text",
			// @ts-expect-error 지시문에는 언어 입력만 넣을 수 있다
			prompt: "{{title}}을 쓴다",
		});
		aiAction({
			label: "x",
			input: { instruction: aiInput.text({ label: "요청", required: true }) },
			result: "mdx",
			prompt: "초안을 쓴다",
			// @ts-expect-error 필드 옆 자리는 필수 입력 `instruction`을 채울 수 없다
			attach: [{ slot: "field", field: "body" }],
		});
	});
});
