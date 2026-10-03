import { describe, expect, it, vi } from "vitest";

// 주소 필드 이름이 `slug`가 아닌 사이트.
vi.mock("@bh2980/cms/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@bh2980/cms/client")>();
	const article = {
		label: "Article",
		workflow: "publish",
		body: true,
		fields: {
			title: { kind: "text", label: "Title" },
			permalink: { kind: "slug", label: "Permalink", from: "title" },
		},
		list: { columns: ["title", "permalink", "status"] },
	};
	const note = { ...article, fields: { title: { kind: "text", label: "Title" } }, list: { columns: ["title"] } };
	const own: Record<string, unknown> = { article, note };
	return {
		...actual,
		isCollection: (name: string) => name in own || actual.isCollection(name),
		schemaOf: (name: string) => own[name] ?? actual.schemaOf(name as never),
		taxonomyFieldsOf: (name: string) => (name in own ? [] : actual.taxonomyFieldsOf(name as never)),
	};
});

const { columnsFor } = await import("../list-columns");

describe("list columns", () => {
	it("finds the slug column by field kind, not by name", () => {
		const { available, defaults } = columnsFor("article");
		expect(available).toContain("slug");
		expect(defaults).toEqual(["title", "slug", "status"]);
	});

	it("has no slug column without a slug field, and always has a title column", () => {
		const { available } = columnsFor("note");
		expect(available).not.toContain("slug");
		expect(available).toContain("title");
	});
});
