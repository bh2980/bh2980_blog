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

	it("checks seed template ids", () => {
		const template = { id: "00000000-0000-4000-8000-000000000001", name: "Note", mdx: "" };
		const base = { collections: { topic }, locales, defaultLocale: "en" } as const;
		expect(() => defineConfig({ ...base, seed: { templates: [template] } })).not.toThrow();
		expect(() => defineConfig({ ...base, seed: { templates: [{ ...template, id: "1" }] } })).toThrow(/UUID/);
		expect(() => defineConfig({ ...base, seed: { templates: [template, { ...template, name: "Other" }] } })).toThrow(
			/duplicated/,
		);
	});

	it("checks layout tab names and view field names", () => {
		const note = (extra: { view?: string; tab?: string }) =>
			defineCollection({
				label: "Note",
				workflow: "record",
				fields: {
					title: fields.text({ label: "Title" }),
					preview: fields.view({ view: extra.view ?? "search" }),
				},
				list: { columns: [] },
				layout: [{ fields: ["title", "preview"], ...(extra.tab !== undefined ? { tab: extra.tab } : {}) }],
			});
		expect(() =>
			defineConfig({ collections: { note: note({ tab: "검색" }) }, locales, defaultLocale: "en" }),
		).not.toThrow();
		expect(() => defineConfig({ collections: { note: note({ tab: " " }) }, locales, defaultLocale: "en" })).toThrow(
			/tab must be 1-20 characters/,
		);
		expect(() =>
			defineConfig({ collections: { note: note({ view: "Search" }) }, locales, defaultLocale: "en" }),
		).toThrow(/view must be a kebab-case name/);
	});

	it("requires a title text field in every collection", () => {
		const untitled = defineCollection({
			label: "Note",
			workflow: "record",
			fields: { name: fields.text({ label: "Name" }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { untitled }, locales, defaultLocale: "en" })).toThrow(
			/untitled needs a "title" text field/,
		);
		const wrongKind = defineCollection({
			label: "Note",
			workflow: "record",
			fields: { title: fields.select({ label: "Title", options: { a: "A" }, defaultValue: "a" }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { wrongKind }, locales, defaultLocale: "en" })).toThrow(/title/);
	});

	it("rejects a collection with more than one slug field", () => {
		const twoSlugs = defineCollection({
			label: "Page",
			workflow: "publish",
			fields: {
				title: fields.text({ label: "Title" }),
				slug: fields.slug({ label: "Slug", from: "title" }),
				handle: fields.slug({ label: "Handle", from: "title" }),
			},
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { twoSlugs }, locales, defaultLocale: "en" })).toThrow(
			/twoSlugs has more than one slug field \(slug, handle\)/,
		);
	});

	it("checks field roles: one field per role, and the field kind fits", () => {
		const article = (extra: Parameters<typeof defineCollection>[0]["fields"]) =>
			defineCollection({ label: "Article", workflow: "publish", fields: { title, ...extra }, list: { columns: [] } });
		const ok = article({
			excerpt: fields.text({ label: "Excerpt", role: "summary", fillFromBody: true }),
			metaTitle: fields.text({ label: "Meta title", role: "seoTitle" }),
			robots: fields.select({
				label: "Robots",
				role: "noindex",
				options: { index: "Index", noindex: "No index" },
				defaultValue: "index",
			}),
		});
		expect(() => defineConfig({ collections: { ok }, locales, defaultLocale: "en" })).not.toThrow();

		const twice = article({
			excerpt: fields.text({ label: "Excerpt", role: "summary" }),
			intro: fields.text({ label: "Intro", role: "summary" }),
		});
		expect(() => defineConfig({ collections: { twice }, locales, defaultLocale: "en" })).toThrow(
			/role "summary" on both excerpt and intro/,
		);

		const noOption = article({
			robots: fields.select({ label: "Robots", role: "noindex", options: { index: "Index" }, defaultValue: "index" }),
		});
		expect(() => defineConfig({ collections: { noOption }, locales, defaultLocale: "en" })).toThrow(/"noindex" option/);

		// 타입을 거치지 않은 설정(JS)도 알린다.
		const wrongKind = article({
			image: { ...fields.relation({ label: "Image", to: "article" }), role: "ogImage" } as never,
		});
		expect(() => defineConfig({ collections: { article: wrongKind }, locales, defaultLocale: "en" })).toThrow(
			/role "ogImage" needs a text field/,
		);
		const unknown = article({ teaser: { ...fields.text({ label: "Teaser" }), role: "teaser" } as never });
		expect(() => defineConfig({ collections: { unknown }, locales, defaultLocale: "en" })).toThrow(/unknown role/);
	});

	it("allows fillFromBody only in collections with a body", () => {
		const note = defineCollection({
			label: "Note",
			workflow: "record",
			fields: { title, summary: fields.text({ label: "Summary", fillFromBody: true }) },
			list: { columns: [] },
		});
		expect(() => defineConfig({ collections: { note }, locales, defaultLocale: "en" })).toThrow(/fillFromBody/);
	});

	it("checks that a slug is made from a text field", () => {
		const withFrom = (from: string) =>
			defineCollection({
				label: "Topic",
				workflow: "record",
				fields: { title, name: fields.text({ label: "Name" }), slug: fields.slug({ label: "Slug", from }) },
				list: { columns: [] },
			});
		expect(() =>
			defineConfig({ collections: { topic: withFrom("name") }, locales, defaultLocale: "en" }),
		).not.toThrow();
		expect(() => defineConfig({ collections: { topic: withFrom("missing") }, locales, defaultLocale: "en" })).toThrow(
			/made from "missing"/,
		);
	});
});
