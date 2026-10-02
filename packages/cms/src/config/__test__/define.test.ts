import { describe, expect, it } from "vitest";
import { defineCollection, defineConfig, fields } from "../..";

const title = fields.text({ label: "Title" });
const slug = fields.slug({ label: "Slug", from: "title" });
const topic = defineCollection({ label: "Topic", workflow: "record", fields: { title, slug }, list: { columns: [] } });
const locales = [{ code: "en", name: "English" }];

describe("defineConfig", () => {
	it("returns the config as is", () => {
		const config = { collections: { topic }, locales, defaultLocale: "en" } as const;
		expect(defineConfig(config)).toBe(config);
	});

	it("rejects a default locale outside the list and duplicate locales", () => {
		expect(() => defineConfig({ collections: { topic }, locales, defaultLocale: "ko" as "en" })).toThrow(
			/defaultLocale/,
		);
		expect(() =>
			defineConfig({ collections: { topic }, locales: [...locales, ...locales], defaultLocale: "en" }),
		).toThrow(/duplicate/);
	});

	it("rejects relations and backlinks to unknown or mismatched collections", () => {
		const article = defineCollection({
			label: "Article",
			workflow: "publish",
			fields: { title, topicId: fields.relation({ label: "Topic", to: "missing" }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { article }, locales, defaultLocale: "en" })).toThrow(
			/unknown collection/,
		);

		const series = defineCollection({
			label: "Series",
			workflow: "record",
			fields: { title, articleId: fields.relation({ label: "Article", to: "article" }) },
			list: { columns: [] },
		});
		const linked = defineCollection({
			label: "Article",
			workflow: "publish",
			fields: { title, series: fields.backlink({ label: "Series", from: "series", via: "articleId" }) },
			list: { columns: [] },
		});
		// `via`가 여러 개 관계가 아니면 반대 방향 관계를 만들 수 없다.
		expect(() => defineConfig({ collections: { article: linked, series }, locales, defaultLocale: "en" })).toThrow(
			/many relation/,
		);
	});

	it("checks the public path pattern and site URL", () => {
		const withPath = (path: string) => ({ ...topic, path }) as typeof topic & { path: `/${string}:slug${string}` };
		expect(() =>
			defineConfig({ collections: { topic: withPath("/topics/:slug") }, locales, defaultLocale: "en" }),
		).not.toThrow();
		for (const path of ["topics/:slug", "/topics", "/:slug/:slug", "/:lang/:slug", "/t/:slug?x"]) {
			expect(() => defineConfig({ collections: { topic: withPath(path) }, locales, defaultLocale: "en" })).toThrow(
				/path/,
			);
		}
		const noSlug = defineCollection({
			label: "Note",
			workflow: "publish",
			path: "/notes/:slug",
			fields: { title },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { noSlug }, locales, defaultLocale: "en" })).toThrow(/slug field/);
		expect(() =>
			defineConfig({ collections: { topic }, locales, defaultLocale: "en", site: { url: "example.com" } }),
		).toThrow(/site.url/);
	});
});
