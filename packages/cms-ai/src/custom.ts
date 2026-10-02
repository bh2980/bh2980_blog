import { COLLECTIONS, schemaOf, storedField } from "@bh2980/cms/client";
import { z } from "zod";
import { type AiActionDefinition, type AiInputs, aiActionOverrideSchema, aiInput } from "./action";
import type { AiResult } from "./definition";

/**
 * 화면 기능(D12·M8-5). 관리자 AI 화면에서 만든 기능이다. 코드 기능과 같은 실행기를 쓰고, 범용 자리(필드 옆·선택 영역
 * 메뉴·삽입 메뉴·본문 이미지·미디어)에 붙는다. 입력은 고른 자리가 주는 재료다. DB(`ai_custom_actions`)에 둔다.
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
	z.object({ slot: z.literal("image"), target: z.enum(["alt", "caption"]) }),
	z.object({ slot: z.literal("media"), target: z.enum(["filename", "defaultAlt", "defaultCaption"]) }),
]);
export type CustomSurface = z.output<typeof customSurfaceSchema>;

/** 자리마다 고를 수 있는 결과 모양. 선택 영역·삽입은 본문 조각(MDX)을 바꾸거나 넣는다. */
export const CUSTOM_RESULTS: Readonly<Record<CustomSurface["slot"], readonly AiResult[]>> = {
	field: ["candidates", "text", "note"],
	selection: ["mdx"],
	insert: ["mdx"],
	image: ["candidates", "text"],
	media: ["candidates", "text"],
};

export const customBaseSchema = z
	.object({
		label: z.string().trim().min(1).max(40),
		surface: customSurfaceSchema,
		result: z.enum(["candidates", "text", "mdx", "note"]),
	})
	.refine((base) => CUSTOM_RESULTS[base.surface.slot].includes(base.result), {
		message: "이 자리에서 쓸 수 없는 결과 모양입니다.",
		path: ["result"],
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
	const writes = base.surface.slot === "selection" || base.surface.slot === "insert";
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

/** 필드 자리가 가리키는 필드가 컬렉션 정의에 있는가. 없으면 그 이유. */
export function surfaceProblem(surface: CustomSurface): string | null {
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
