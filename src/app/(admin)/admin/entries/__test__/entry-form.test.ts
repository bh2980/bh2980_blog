import { describe, expect, it } from "vitest";
import { type EntryData, formFromEntry, metadataFromForm, recordTranslationKey } from "../entry-form";

const SOURCE = "11111111-1111-4111-8111-111111111111";
const CATEGORY = "22222222-2222-4222-8222-222222222222";

const entry = (fields: Partial<EntryData>): EntryData => ({
	id: SOURCE,
	collection: "post",
	status: "draft",
	version: 1,
	folderId: null,
	workingSlug: "hello",
	publishedSlug: null,
	working: { metadata: {}, mdx: "" },
	...fields,
});

describe("번역본 폼(v2 B4)", () => {
	it("번역본은 언어별 값만 폼과 메타데이터로 다룬다", () => {
		const translation = entry({
			id: "33333333-3333-4333-8333-333333333333",
			translationGroupId: SOURCE,
			locale: "en",
			publishedAt: "2026-01-01T00:00:00.000Z",
			working: { metadata: { title: "Hello", summary: "Sum" }, mdx: "Body" },
		});
		const form = formFromEntry(translation);
		expect(Object.keys(form).sort()).toEqual([
			"canonicalUrl",
			"mdx",
			"seoDescription",
			"seoTitle",
			"slug",
			"summary",
			"title",
		]);
		expect(
			metadataFromForm(
				{ ...form, categoryId: CATEGORY, publishedAt: "2026-01-01T09:00" },
				"post",
				{},
				{ translation: true },
			),
		).toEqual({ metadata: { title: "Hello", summary: "Sum" } });
	});

	it("원문은 공통 값도 다룬다", () => {
		const form = formFromEntry(entry({ working: { metadata: { title: "안녕", categoryId: CATEGORY }, mdx: "" } }));
		expect(form.categoryId).toBe(CATEGORY);
		expect(metadataFromForm(form, "post")).toEqual({ metadata: { title: "안녕", categoryId: CATEGORY } });
	});
});

describe("record 언어별 이름(v2 B4)", () => {
	it("다른 언어 이름을 폼 키로 읽고 비운 언어는 저장하지 않는다", () => {
		const form = formFromEntry(
			entry({
				collection: "category",
				working: { metadata: { title: "에세이", translations: { en: { title: "Essay" } } }, mdx: "" },
			}),
		);
		expect(form[recordTranslationKey("title", "en")]).toBe("Essay");
		expect(form[recordTranslationKey("title", "ja")]).toBe("");
		expect(
			metadataFromForm({ ...form, [recordTranslationKey("title", "ja")]: " エッセイ " }, "category", {
				translations: { en: { title: "old" } },
			}),
		).toEqual({ metadata: { title: "에세이", translations: { en: { title: "Essay" }, ja: { title: "エッセイ" } } } });
		expect(
			metadataFromForm({ ...form, [recordTranslationKey("title", "en")]: "" }, "category", {
				translations: { en: { title: "Essay" } },
			}),
		).toEqual({ metadata: { title: "에세이" } });
	});
});
