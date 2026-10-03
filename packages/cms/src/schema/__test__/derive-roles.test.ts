import { describe, expect, it, vi } from "vitest";
import type { SchemaCollection } from "../derive";

// 블로그와 필드 이름이 다른 사이트. 라이브러리가 이름이 아니라 역할·`from`으로 필드를 찾는지 본다.
vi.mock("../../config/resolved", async () => {
	const { defineCollection, defineConfig, fields } = await import("../..");
	const article = defineCollection({
		label: "Article",
		workflow: "publish",
		fields: {
			title: fields.text({ label: "Title", required: "publish" }),
			headline: fields.text({ label: "Headline" }),
			slug: fields.slug({ label: "Slug", from: "headline", required: "publish" }),
			excerpt: fields.text({ label: "Excerpt", role: "summary", fillFromBody: true }),
			topicId: fields.relation({ label: "Topic", to: "topic", required: "publish" }),
			robots: fields.select({
				label: "Robots",
				role: "noindex",
				options: { index: "Index", noindex: "No index" },
				defaultValue: "index",
			}),
		},
		layout: [{ tab: "Search", fields: ["robots"] }],
		list: { columns: ["title", "slug"] },
	});
	const topic = defineCollection({
		label: "Topic",
		workflow: "record",
		fields: { title: fields.text({ label: "Name" }), slug: fields.slug({ label: "Slug" }) },
		list: { columns: [] },
	});
	const config = defineConfig({
		collections: { article, topic },
		locales: [{ code: "en", name: "English" }],
		defaultLocale: "en",
	});
	return { cmsConfig: config };
});

const { fillFromBodyFields, missingRequiredIssues, roleField, roleValue, slugFromValues } = await import("../derive");
// 이 파일의 컬렉션은 위에서 바꾼 설정에만 있다(타입은 패키지 테스트 설정을 본다).
const article = "article" as SchemaCollection;
const topic = "topic" as SchemaCollection;

describe("field roles", () => {
	it("finds fields by role, not by name", () => {
		expect(roleField(article, "summary")?.name).toBe("excerpt");
		expect(roleField(article, "noindex")?.field.kind).toBe("select");
		expect(roleField(article, "seoTitle")).toBeUndefined();
		expect(roleValue(article, "summary", { excerpt: "Short", summary: "Not this" })).toBe("Short");
		expect(roleValue(topic, "summary", { summary: "x" })).toBe("");
	});

	it("lists fields filled from the body", () => {
		expect(fillFromBodyFields(article).map((stored) => stored.name)).toEqual(["excerpt"]);
		expect(fillFromBodyFields(topic)).toEqual([]);
	});
});

describe("slug from", () => {
	it("makes the slug from the field named by `from`", () => {
		expect(slugFromValues(article, { title: "Ignored", headline: "Hello World" })).toBe("hello-world");
	});

	it("does not make a slug without `from`", () => {
		expect(slugFromValues(topic, { title: "Hello" })).toBe("");
	});
});

describe("missing required fields", () => {
	it("uses missing_field with the field label for every field, title included", () => {
		expect(missingRequiredIssues(article, { slug: null, metadata: { title: "" } })).toEqual([
			{ code: "null_slug", path: "slug" },
			{ code: "missing_field", path: "title", message: "Title" },
			{ code: "missing_field", path: "topicId", message: "Topic" },
		]);
	});
});
