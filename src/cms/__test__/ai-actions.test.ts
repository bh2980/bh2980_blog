import { type AiConfig, resolveAiActions } from "@monti-cms/ai";
import type { CmsPlugin } from "@monti-cms/core";
import { BLOCKS, getPluginOptions } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import cmsConfig from "@/cms.config";

/**
 * 이 블로그의 AI 기능(M10-2). 설정에 기능을 적지 않아도 예전과 같은 기능이 같은 이름으로 켜진다. 이름은 관리자 AI 화면에서
 * 고친 값(DB `ai_action_overrides`)의 키라서 바뀌면 안 된다.
 */
describe("블로그 AI 기능", () => {
	const plugins: readonly CmsPlugin[] = cmsConfig.plugins ?? [];
	const ai = getPluginOptions<AiConfig>("ai") as AiConfig;
	const actions = resolveAiActions(
		ai,
		{ collections: cmsConfig.collections, blocks: BLOCKS, locales: cmsConfig.locales },
		plugins,
	);

	it("예전 설정과 같은 기능 이름·순서다", () => {
		expect(Object.keys(actions)).toEqual([
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
			"polish",
			"draft",
			"diagramDraft",
			"diagramEdit",
			"chartDraft",
			"chartEdit",
		]);
	});

	it("필드 기능은 예전과 같은 필드·컬렉션에 붙는다", () => {
		const fieldsOf = (key: string) => actions[key]?.attach?.filter((attach) => attach.slot === "field");
		expect(fieldsOf("slug")).toEqual([{ slot: "field", field: "slug", collections: ["post", "memo"] }]);
		expect(fieldsOf("summary")).toEqual([{ slot: "field", field: "summary", collections: ["post"] }]);
		expect(fieldsOf("tags")).toEqual([{ slot: "field", field: "tagIds", collections: ["post", "memo"] }]);
		expect(fieldsOf("category")).toEqual([{ slot: "field", field: "categoryId", collections: ["post"] }]);
		expect(actions.tags?.choices).toEqual({ from: "collection", collection: "tag" });
		expect(actions.category?.choices).toEqual({ from: "collection", collection: "category" });
		expect(fieldsOf("seoTitle")).toEqual([{ slot: "field", field: "seoTitle", collections: ["post", "memo"] }]);
	});

	it("문체 가이드 공통 문구가 문체 다듬기·초안 쓰기 지시문에 들어간다", () => {
		expect(actions.polish?.prompt).toContain("{{shared.styleGuide}}");
		expect(actions.draft?.prompt).toContain("{{shared.styleGuide}}");
	});
});
