import { ADDED_BLOCKS, COLLECTIONS, schemaOf, storedField } from "@bh2980/cms/client";
import { z } from "zod";
import { type AiActionDefinition, type AiChoices, type AiInputs, aiActionOverrideSchema, aiInput } from "./action";
import type { AiEngine, AiResult } from "./definition";

/**
 * 화면 기능(D12·M8-5). 관리자 AI 화면에서 만든 기능이다. 코드 기능과 같은 실행기를 쓰고, 범용 자리(필드 옆·선택 영역
 * 메뉴·삽입 메뉴·본문 블록·본문 이미지·미디어)에 붙는다. 입력은 고른 자리가 주는 재료다. DB(`ai_custom_actions`)에 둔다.
 *
 * 저장 모양: `{ base: { label, surface, result }, override: 고친 값(지시문·보낼 입력·연결 등) }`.
 */

export const CUSTOM_KEY_PREFIX = "custom_";

/** 붙을 곳. 필드는 컬렉션 정의의 필드 이름이다. */
export const customSurfaceSchema = z.discriminatedUnion("slot", [
	z.object({
		slot: z.literal("field"),
		field: z.string().min(1).max(60),
		collections: z.array(z.string().max(40)).max(20).optional(),
	}),
	z.object({ slot: z.literal("selection") }),
	z.object({ slot: z.literal("insert") }),
	z.object({
		slot: z.literal("block"),
		block: z
			.string()
			.regex(/^[a-z][a-z0-9-]*$/)
			.max(60),
	}),
	z.object({ slot: z.literal("image"), target: z.enum(["alt", "caption"]) }),
	z.object({ slot: z.literal("media"), target: z.enum(["filename", "defaultAlt", "defaultCaption"]) }),
]);
export type CustomSurface = z.output<typeof customSurfaceSchema>;

/** 필드 자리가 가리키는 필드(처음 찾은 컬렉션의 것). 관계·선택 필드는 저장 필드에서 찾는다. */
export function surfaceField(surface: CustomSurface) {
	if (surface.slot !== "field") return undefined;
	const collections = surface.collections?.length ? surface.collections : COLLECTIONS;
	for (const collection of collections) {
		if (!(COLLECTIONS as readonly string[]).includes(collection)) continue;
		const name = collection as (typeof COLLECTIONS)[number];
		// 저장 필드(조건부 필드의 선택 값 포함)를 먼저 보고, 주소처럼 따로 저장하는 필드는 스키마에서 찾는다.
		const field = storedField(name, surface.field)?.field ?? schemaOf(name).fields[surface.field];
		if (field) return { collection, field };
	}
	return undefined;
}

/**
 * 고를 값이 정해진 필드의 선택지. 관계 필드(태그·카테고리·모음집)는 가리키는 컬렉션의 공개된 항목, 선택 필드는 그 선택지다.
 * 선택지가 있는 필드는 후보만 내고, 실제로 있는 값인지 검사한다.
 */
export function surfaceChoices(surface: CustomSurface): { choices: AiChoices; many: boolean } | undefined {
	const found = surfaceField(surface);
	if (!found || surface.slot !== "field") return undefined;
	const { collection, field } = found;
	if (field.kind === "relation") return { choices: { from: "collection", collection: field.to }, many: !!field.many };
	if (field.kind === "select") return { choices: { from: "select", collection, field: surface.field }, many: false };
	return undefined;
}

/** 자리마다 고를 수 있는 결과 모양. 선택 영역·삽입·블록은 본문 조각(MDX)을 바꾸거나 넣는다. */
export const CUSTOM_RESULTS: Readonly<Record<CustomSurface["slot"], readonly AiResult[]>> = {
	field: ["candidates", "text", "note"],
	selection: ["mdx"],
	insert: ["mdx"],
	block: ["mdx"],
	image: ["candidates", "text"],
	media: ["candidates", "text"],
};

/** 자리에서 고를 수 있는 결과 모양. 선택지가 있는 필드는 후보만이다. */
export const customResults = (surface: CustomSurface): readonly AiResult[] =>
	surfaceChoices(surface) ? ["candidates"] : CUSTOM_RESULTS[surface.slot];

/** 자리에서 고를 수 있는 방식. 판단 방식(System One)은 선택지가 있는 필드에서만 쓴다. */
export const customEngines = (surface: CustomSurface): readonly AiEngine[] =>
	surfaceChoices(surface) ? ["decide", "generate"] : ["generate"];

export const customBaseSchema = z
	.object({
		label: z.string().trim().min(1).max(40),
		surface: customSurfaceSchema,
		result: z.enum(["candidates", "text", "mdx", "note"]),
		/** 방식. 없으면 생성 방식이다(예전에 만든 기능). */
		engine: z.enum(["generate", "decide"]).optional(),
	})
	.refine((base) => customResults(base.surface).includes(base.result), {
		message: "이 자리에서 쓸 수 없는 결과 모양입니다.",
		path: ["result"],
	})
	.refine((base) => customEngines(base.surface).includes(base.engine ?? "generate"), {
		message: "판단 방식은 고를 값이 정해진 필드(관계·선택 필드)에서만 쓸 수 있습니다.",
		path: ["engine"],
	});
export type CustomBase = z.output<typeof customBaseSchema>;

export const customValueSchema = z.object({ base: customBaseSchema, override: aiActionOverrideSchema });
export type CustomValue = z.output<typeof customValueSchema>;

/** 자리가 주는 재료(입력). 필수 입력은 그 자리에서 꼭 있는 것뿐이다. */
const SURFACE_INPUTS: Readonly<Record<CustomSurface["slot"], AiInputs>> = {
	field: {
		title: aiInput.text({ label: "제목" }),
		summary: aiInput.text({ label: "요약" }),
		body: aiInput.mdx({ label: "본문" }),
		current: aiInput.value({ label: "현재 값" }),
	},
	selection: {
		selection: aiInput.mdx({ label: "고칠 글", required: true }),
		title: aiInput.text({ label: "제목" }),
	},
	insert: { title: aiInput.text({ label: "제목" }), body: aiInput.mdx({ label: "지금 본문" }) },
	block: { block: aiInput.mdx({ label: "블록 원문", required: true }), title: aiInput.text({ label: "제목" }) },
	image: {
		image: aiInput.image({ label: "이미지", required: true }),
		around: aiInput.text({ label: "앞뒤 문단" }),
		current: aiInput.value({ label: "현재 값" }),
	},
	media: {
		image: aiInput.image({ label: "이미지", required: true }),
		filename: aiInput.text({ label: "파일 이름" }),
		current: aiInput.value({ label: "현재 값" }),
	},
};

/** 처음 지시문. 관리자 화면에서 바로 고친다. */
export const CUSTOM_DEFAULT_PROMPT = "할 일을 적으세요.";

/** 저장한 기본 정보로 만든 기능 정의. 지시문·보낼 입력 등은 고친 값(`override`)이 정한다. */
export function customDefinition(base: CustomBase): AiActionDefinition {
	const picked = surfaceChoices(base.surface);
	if (picked) {
		// 관계·선택 필드: 선택지 안에서 고른다. 여러 개 받는 필드(태그)는 더하고, 하나만 받는 필드는 바꾼다.
		return {
			label: base.label,
			input: SURFACE_INPUTS.field,
			send: ["title", "summary", "body"],
			prompt: CUSTOM_DEFAULT_PROMPT,
			engine: base.engine ?? "generate",
			choices: picked.choices,
			pick: picked.many ? "many" : "one",
			threshold: picked.many ? 0.6 : 0.3,
			maxCount: picked.many ? 5 : 2,
			result: "candidates",
			...(picked.many ? { apply: "append" as const } : {}),
			checks: [{ kind: "exists" }],
			attach: [base.surface],
		};
	}
	const writes = base.surface.slot === "selection" || base.surface.slot === "insert" || base.surface.slot === "block";
	return {
		label: base.label,
		input: SURFACE_INPUTS[base.surface.slot],
		prompt: CUSTOM_DEFAULT_PROMPT,
		result: base.result,
		...(base.result === "note" ? { apply: "none" as const } : {}),
		stream: writes,
		attach: [base.surface],
	};
}

/** 화면 기능을 붙일 수 있는 블록: 블록 확장·사이트 설정이 더한 블록 중 편집기 노드로 편집하는 것(자식 전용 블록 제외). */
export const CUSTOM_BLOCKS = ADDED_BLOCKS.filter((block) => block.editor.view === "node" && !block.parent);

/** 자리가 가리키는 필드·블록이 사이트 설정에 있는가. 없으면 그 이유. */
export function surfaceProblem(surface: CustomSurface): string | null {
	if (surface.slot === "block") {
		return CUSTOM_BLOCKS.some((block) => block.name === surface.block) ? null : `없는 블록입니다: ${surface.block}`;
	}
	if (surface.slot !== "field") return null;
	const collections = surface.collections?.length ? surface.collections : COLLECTIONS;
	for (const collection of collections) {
		if (!(COLLECTIONS as readonly string[]).includes(collection)) return `없는 컬렉션입니다: ${collection}`;
	}
	const has = (collection: string) => {
		const name = collection as (typeof COLLECTIONS)[number];
		return Boolean(schemaOf(name).fields[surface.field] ?? storedField(name, surface.field));
	};
	return collections.some(has) ? null : `없는 필드입니다: ${surface.field}`;
}

/** 새 화면 기능의 이름(key). 코드 기능 이름과 겹치지 않게 앞에 `custom_`을 붙인다. */
export const newCustomKey = () => `${CUSTOM_KEY_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
export const isCustomKey = (key: string) => key.startsWith(CUSTOM_KEY_PREFIX);
