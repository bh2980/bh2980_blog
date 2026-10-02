import type { MetadataFor } from "@bh2980/cms/client";
import {
	COLLECTION_DEFINITIONS,
	COLLECTIONS,
	metadataReferences,
	missingRequiredIssues,
	relationsOf,
	SYSTEM_LIST_COLUMNS,
	storedFields,
} from "@bh2980/cms/client";
import { prepareSnapshot, validateForPublish } from "@bh2980/cms/runtime";
import { metadataFromForm } from "@bh2980/cms-admin/screens/entries/entry-form";
import { describe, expect, expectTypeOf, it } from "vitest";
import cmsConfig from "@/cms.config";

const SCHEMAS = cmsConfig.collections;
type PostMetadata = MetadataFor<"post">;

const CATEGORY = "11111111-1111-4111-8111-111111111111";
const TAG_A = "22222222-2222-4222-8222-222222222222";
const TAG_B = "33333333-3333-4333-8333-333333333333";
const POST = "44444444-4444-4444-8444-444444444444";

describe("컬렉션 정의(v2 B1)", () => {
	it("JSON 왕복해도 같다 — 함수·컴포넌트가 없다", () => {
		expect(JSON.parse(JSON.stringify(SCHEMAS))).toEqual(SCHEMAS);
	});

	it("모든 컬렉션에 정의가 있고 선택 기본값은 옵션 중 하나다", () => {
		expect(Object.keys(SCHEMAS).sort()).toEqual([...COLLECTIONS].sort());
		for (const collection of COLLECTIONS) {
			for (const { field } of storedFields(collection)) {
				if (field.kind === "select") expect(Object.keys(field.options)).toContain(field.defaultValue);
			}
		}
	});

	it("배치·목록 컬럼은 실제 필드만 가리킨다", () => {
		const system: readonly string[] = SYSTEM_LIST_COLUMNS;
		for (const schema of Object.values(SCHEMAS)) {
			for (const group of schema.layout ?? []) {
				for (const name of group.fields) expect(Object.keys(schema.fields)).toContain(name);
			}
			for (const column of schema.list.columns) {
				expect([...Object.keys(schema.fields), ...system]).toContain(column);
			}
		}
	});

	it("반대 방향 관계는 상대 컬렉션의 여러 개 관계가 이 컬렉션을 가리키고, 저장 필드가 아니다(v2 B2)", () => {
		for (const [name, schema] of Object.entries(SCHEMAS)) {
			for (const [fieldName, field] of Object.entries(schema.fields)) {
				if (field.kind !== "backlink") continue;
				const via = storedFields(field.from).find((stored) => stored.name === field.via)?.field;
				expect(via, `${name}.${fieldName}`).toMatchObject({ kind: "relation", many: true, to: name });
				expect(storedFields(name as keyof typeof SCHEMAS).some((stored) => stored.name === fieldName)).toBe(false);
			}
		}
		expect(SCHEMAS.post.fields.series).toMatchObject({ kind: "backlink", from: "collection", via: "itemIds" });
		expect(SCHEMAS.memo.fields.series).toMatchObject({ kind: "backlink", from: "collection", via: "memoIds" });
		// 각 목록은 모음집의 `담는 글` 선택에 딸려 있다.
		expect(storedFields("collection").find((stored) => stored.name === "itemIds")?.when).toEqual({
			field: "itemKind",
			value: "post",
		});
		expect(storedFields("collection").find((stored) => stored.name === "memoIds")?.when).toEqual({
			field: "itemKind",
			value: "memo",
		});
	});

	it("v1 모양의 정의를 그대로 만든다", () => {
		expect(COLLECTION_DEFINITIONS.post.fields).toEqual({
			title: "string",
			summary: "string",
			categoryId: "string",
			tagIds: "string[]",
			policy: "string",
			replacementPostId: "string",
			seoTitle: "string",
			seoDescription: "string",
			canonicalUrl: "string",
			ogImageId: "string",
			seoRobots: "string",
		});
		expect(COLLECTION_DEFINITIONS.memo.fields).toEqual({
			title: "string",
			tagIds: "string[]",
			seoTitle: "string",
			seoDescription: "string",
			canonicalUrl: "string",
			ogImageId: "string",
			seoRobots: "string",
		});
		expect(COLLECTION_DEFINITIONS.category.fields).toEqual({ title: "string" });
		// 모음집은 게시글 또는 메모 한 종류를 담는다. 게시글 목록은 예전 키(`itemIds`)를 그대로 쓴다.
		expect(COLLECTION_DEFINITIONS.collection.fields).toEqual({
			title: "string",
			summary: "string",
			itemKind: "string",
			itemIds: "string[]",
			memoIds: "string[]",
		});
		expect(COLLECTION_DEFINITIONS.collection.workflow).toBe("record");
		expect(relationsOf("post").map(({ field, kind, to }) => [field, kind, to])).toEqual([
			["categoryId", "entry", "category"],
			["tagIds", "entry", "tag"],
			["replacementPostId", "entry", "post"],
		]);
	});

	it("메타데이터 타입을 정의에서 만든다", () => {
		expectTypeOf<PostMetadata["policy"]>().toEqualTypeOf<"normal" | "evergreen" | "deprecated" | undefined>();
		expectTypeOf<PostMetadata["tagIds"]>().toEqualTypeOf<readonly string[] | undefined>();
		expectTypeOf<PostMetadata["replacementPostId"]>().toEqualTypeOf<string | undefined>();
		expectTypeOf<PostMetadata>().not.toHaveProperty("slug");
		// record 컬렉션만 언어별 이름(`translations`)을 가진다.
		expectTypeOf<MetadataFor<"tag">>().toHaveProperty("translations");
		expectTypeOf<PostMetadata>().not.toHaveProperty("translations");
	});
});

describe("정의에서 만든 서버 규칙", () => {
	const post = (metadata: Record<string, unknown>, slug: string | null = "hello") =>
		prepareSnapshot({ collection: "post", slug, metadata, mdx: "본문" } as never);

	it("정의에 없는 키·형식이 틀린 값·옵션 밖의 선택 값을 거부한다", async () => {
		await expect(post({ title: "t", unknown: "x" })).rejects.toMatchObject({ code: "invalid_metadata_key" });
		await expect(post({ title: "t", tagIds: "not-array" })).rejects.toMatchObject({ code: "invalid_metadata_type" });
		await expect(post({ title: "t", policy: "weird" })).rejects.toMatchObject({ code: "invalid_metadata_value" });
		await expect(post({ title: "t", categoryId: "not-uuid" })).rejects.toMatchObject({
			code: "invalid_metadata_value",
		});
		// 발행일은 입력값이 아니다(처음 발행할 때 DB가 기록한다).
		await expect(post({ title: "t", publishedAt: "2020-01-01T00:00:00.000Z" })).rejects.toMatchObject({
			code: "invalid_metadata_key",
		});
		await expect(post({ title: "가".repeat(201) })).rejects.toMatchObject({ code: "title_too_long" });
	});

	it("관계 참조를 선언 순서대로 모으고 목록은 순서·중복을 보존한다", () => {
		expect(
			metadataReferences("post", { categoryId: CATEGORY, tagIds: [TAG_A, TAG_B, TAG_A], replacementPostId: POST }),
		).toEqual([
			{ kind: "entry", targetId: CATEGORY, path: "categoryId" },
			{ kind: "entry", targetId: TAG_A, path: "tagIds", ordinal: 0 },
			{ kind: "entry", targetId: TAG_B, path: "tagIds", ordinal: 1 },
			{ kind: "entry", targetId: TAG_A, path: "tagIds", ordinal: 2 },
			{ kind: "entry", targetId: POST, path: "replacementPostId" },
		]);
	});

	it("발행 필수값은 v1 문제 코드를 쓴다", () => {
		expect(missingRequiredIssues("post", { slug: null, metadata: { title: "" } })).toEqual([
			{ code: "null_slug", path: "slug" },
			{ code: "missing_title", path: "title" },
			{ code: "missing_category", path: "categoryId" },
		]);
		expect(missingRequiredIssues("memo", { slug: "a", metadata: { title: "t" } })).toEqual([]);
	});

	it("모음집 항목만 공개되지 않은 글을 허용한다", async () => {
		const series = await prepareSnapshot({
			collection: "collection",
			slug: "series",
			metadata: { title: "모음", itemIds: [POST] },
			mdx: "",
		});
		const draftPost = { targets: [{ id: POST, isPublished: false, collection: "post" }], media: [] };
		expect(validateForPublish(series, draftPost).ready).toBe(true);

		const deprecated = await post({ title: "t", categoryId: CATEGORY, policy: "deprecated", replacementPostId: POST });
		const result = validateForPublish(deprecated, {
			targets: [...draftPost.targets, { id: CATEGORY, isPublished: true, collection: "category" }],
			media: [],
		});
		expect(result.issues).toContainEqual(
			expect.objectContaining({ code: "unpublished_reference", path: "replacementPostId" }),
		);
	});
});

describe("정의에서 만든 폼 변환", () => {
	it("비운 선택 필드는 지우고, 기본 정책은 새로 쓰지 않고, 조건이 맞지 않는 딸린 값은 버린다", () => {
		const built = metadataFromForm(
			{
				title: "제목 ",
				slug: "a",
				mdx: "",
				summary: "  ",
				categoryId: CATEGORY,
				tagIds: [],
				policy: "normal",
				replacementPostId: POST,
				seoTitle: " 검색 ",
			},
			"post",
			{ summary: "old" },
		);
		expect(built).toEqual({ metadata: { title: "제목 ", categoryId: CATEGORY, seoTitle: "검색" } });
	});

	it("이미 저장된 정책은 기본값이어도 갱신한다", () => {
		const built = metadataFromForm({ title: "t", slug: "", mdx: "", policy: "normal" }, "post", {
			policy: "deprecated",
			replacementPostId: POST,
		});
		expect(built).toEqual({ metadata: { title: "t", policy: "normal" } });
	});
});
