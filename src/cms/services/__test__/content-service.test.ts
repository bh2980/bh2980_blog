import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PreparedSnapshot, Reference, ResolvedTargets, SaveDraftInput, ServiceInput, StorePort } from "../index";
import { createContentService, prepareSnapshot, ServiceError, validateForPublish } from "../index";

describe("ContentService M2-TW-1 Contract", () => {
	describe("1. Metadata Allowlists & Collection Rules", () => {
		it.each([
			["unknown collection", { collection: "unknown", slug: "test", metadata: {}, mdx: "" }, "unknown_collection"],
			[
				"post with wrong title type",
				{ collection: "post", slug: "valid", metadata: { title: 123 }, mdx: "" },
				"invalid_metadata_type",
			],
			[
				"post with wrong tagIds type",
				{ collection: "post", slug: "valid", metadata: { tagIds: "tag-1" }, mdx: "" },
				"invalid_metadata_type",
			],
			[
				"post with unsupported policy value",
				{ collection: "post", slug: "valid", metadata: { policy: "unsupported" }, mdx: "" },
				"invalid_metadata_value",
			],
			[
				"non-JSON value in title",
				{ collection: "post", slug: "valid", metadata: { title: () => {} }, mdx: "" },
				"invalid_metadata_type",
			],
			[
				"cross-collection canonical key (categoryId on memo)",
				{ collection: "memo", slug: "valid", metadata: { categoryId: "cat-1" }, mdx: "" },
				"invalid_metadata_key",
			],
			[
				"unknown metadata key on category",
				{ collection: "category", slug: "valid", metadata: { fakeKey: "fail" }, mdx: "" },
				"invalid_metadata_key",
			],
			[
				"post with system metadata createdAt",
				{ collection: "post", slug: "valid", metadata: { createdAt: "2023-01-01" }, mdx: "" },
				"invalid_metadata_key",
			],
			[
				"category with invented metadata index",
				{ collection: "category", slug: "valid", metadata: { index: 1 }, mdx: "" },
				"invalid_metadata_key",
			],
		] satisfies Array<[string, unknown, string]>)("rejects %s", async (_, input, expectedCode) => {
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: expectedCode });
		});

		it.each([
			[
				"post",
				{
					collection: "post",
					slug: "p",
					metadata: {
						title: "T",
						summary: "S",
						categoryId: "123e4567-e89b-12d3-a456-426614174000",
						tagIds: ["123e4567-e89b-12d3-a456-426614174001"],
						publishedAt: "2023-01-01T00:00:00.000Z",
						policy: "normal",
					},
					mdx: "",
				},
			],
			[
				"memo",
				{
					collection: "memo",
					slug: "m",
					metadata: {
						title: "T",
						tagIds: ["123e4567-e89b-12d3-a456-426614174001"],
						publishedAt: "2023-01-01T00:00:00.000Z",
					},
					mdx: "",
				},
			],
			["category", { collection: "category", slug: "c", metadata: { title: "T" }, mdx: "" }],
			["tag", { collection: "tag", slug: "t", metadata: { title: "T" }, mdx: "" }],
			[
				"collection",
				{
					collection: "collection",
					slug: "col",
					metadata: { title: "T", itemIds: ["123e4567-e89b-12d3-a456-426614174000"] },
					mdx: "",
				},
			],
		] satisfies Array<[string, ServiceInput]>)("permits canonical keys for %s", async (_, input) => {
			const result = await prepareSnapshot(input);
			expect(result.metadata).toEqual(input.metadata);
		});

		it("permits missing title/summary/category for draft preparation", async () => {
			const result = await prepareSnapshot({
				collection: "post",
				slug: "draft-post",
				metadata: {},
				mdx: "",
			});
			expect(result.metadata).toEqual({});
			expect(result.issues.some((i: { code: string }) => i.code === "missing_title")).toBe(false);
		});
	});

	describe("2. Slug Normalization", () => {
		it.each([
			["   ", null],
			["cafe\u0301", "café"],
		])("normalizes slug %j to %j", async (inputSlug, expectedSlug) => {
			const result = await prepareSnapshot({
				collection: "post",
				slug: inputSlug,
				metadata: {},
				mdx: "",
			});
			expect(result.slug).toBe(expectedSlug);
		});

		it.each([
			"test/path",
			"test?query",
			"test#hash",
			"test\u0000",
		])("rejects forbidden characters in slug: %j", async (inputSlug) => {
			await expect(
				prepareSnapshot({ collection: "post", slug: inputSlug, metadata: {}, mdx: "" }),
			).rejects.toMatchObject({ code: "invalid_slug_format" });
		});

		it("accepts exactly 200 Unicode code points and rejects 201", async () => {
			const slug200 = "😀".repeat(200);
			const slug201 = "😀".repeat(201);
			const result = await prepareSnapshot({ collection: "post", slug: slug200, metadata: {}, mdx: "" });
			expect(result.slug).toBe(slug200);
			await expect(prepareSnapshot({ collection: "post", slug: slug201, metadata: {}, mdx: "" })).rejects.toMatchObject(
				{ code: "slug_too_long" },
			);
		});

		it("accepts exactly 200 Unicode code points and rejects 201 for valid title key", async () => {
			const title200 = "😀".repeat(200);
			const title201 = "😀".repeat(201);
			const result = await prepareSnapshot({
				collection: "post",
				slug: "valid",
				metadata: { title: title200 },
				mdx: "",
			});
			expect(result.metadata.title).toBe(title200);
			await expect(
				prepareSnapshot({ collection: "post", slug: "valid", metadata: { title: title201 }, mdx: "" }),
			).rejects.toMatchObject({ code: "title_too_long" });
		});

		it("allows equal slug in two different collection inputs", async () => {
			const result1 = await prepareSnapshot({ collection: "post", slug: "shared-slug", metadata: {}, mdx: "" });
			const result2 = await prepareSnapshot({ collection: "memo", slug: "shared-slug", metadata: {}, mdx: "" });
			expect(result1.slug).toBe("shared-slug");
			expect(result2.slug).toBe("shared-slug");
		});
	});

	describe("3. Deterministic Hashing", () => {
		it("computes exact known SHA-256 vector with key-order equivalence and metadata/MDX/schema changes", async () => {
			const snap1 = await prepareSnapshot(
				{
					collection: "post",
					slug: "a",
					metadata: {
						title: "A",
						tagIds: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"],
					},
					mdx: "Hello",
				},
				{ schemaVersion: 1 },
			);
			const snap2 = await prepareSnapshot(
				{
					collection: "post",
					slug: "a",
					metadata: {
						tagIds: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"],
						title: "A",
					},
					mdx: "Hello",
				},
				{ schemaVersion: 1 },
			);

			const expectedTuple = [
				"cms-snapshot-v1",
				1,
				{ tagIds: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"], title: "A" },
				"Hello",
			];
			const expectedHash = createHash("sha256").update(JSON.stringify(expectedTuple)).digest("hex");
			expect(snap1.contentHash).toBe(expectedHash);
			expect(snap1.contentHash).toBe("ce4f87281290c44253cb7844dd84e45cecc65aacb0bf2dfa5768da7e26ef921e");
			expect(snap1.contentHash).toEqual(snap2.contentHash);

			const snapDiffMdx = await prepareSnapshot(
				{
					collection: "post",
					slug: "a",
					metadata: {
						title: "A",
						tagIds: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"],
					},
					mdx: "Hello World",
				},
				{ schemaVersion: 1 },
			);
			expect(snap1.contentHash).not.toEqual(snapDiffMdx.contentHash);

			const snapDiffMetadata = await prepareSnapshot(
				{
					collection: "post",
					slug: "a",
					metadata: {
						title: "B",
						tagIds: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"],
					},
					mdx: "Hello",
				},
				{ schemaVersion: 1 },
			);
			expect(snap1.contentHash).not.toEqual(snapDiffMetadata.contentHash);

			const snapDiffSchema = await prepareSnapshot(
				{
					collection: "post",
					slug: "a",
					metadata: {
						title: "A",
						tagIds: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"],
					},
					mdx: "Hello",
				},
				{ schemaVersion: 2 },
			);
			expect(snap1.contentHash).not.toEqual(snapDiffSchema.contentHash);
		});

		it("rejects caller provided contentHash", async () => {
			const input = {
				collection: "post",
				slug: "a",
				metadata: {},
				mdx: "Hello",
				contentHash: "fakehash",
			};
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: "invalid_input" });
		});
	});

	describe("4. Reference Extraction", () => {
		it("extracts ordered/deduplicated refs with occurrences from metadata relations", async () => {
			const snap = await prepareSnapshot({
				collection: "post",
				slug: "a",
				metadata: {
					categoryId: "123e4567-e89b-12d3-a456-426614174001",
					tagIds: [
						"123e4567-e89b-12d3-a456-426614174002",
						"123e4567-e89b-12d3-a456-426614174003",
						"123e4567-e89b-12d3-a456-426614174002",
					],
				},
				mdx: "",
			});

			expect(snap.references).toHaveLength(3);

			expect(snap.references[0]).toMatchObject({
				kind: "category",
				targetId: "123e4567-e89b-12d3-a456-426614174001",
				isStale: false,
			});
			expect(snap.references[0].occurrences).toHaveLength(1);
			expect(snap.references[0].occurrences[0]).toMatchObject({ type: "metadata", path: "categoryId" });

			expect(snap.references[1]).toMatchObject({
				kind: "tag",
				targetId: "123e4567-e89b-12d3-a456-426614174002",
				isStale: false,
			});
			expect(snap.references[1].occurrences).toHaveLength(2);
			expect(snap.references[1].occurrences[0]).toMatchObject({ type: "metadata", path: "tagIds", ordinal: 0 });
			expect(snap.references[1].occurrences[1]).toMatchObject({ type: "metadata", path: "tagIds", ordinal: 2 });

			expect(snap.references[2]).toMatchObject({
				kind: "tag",
				targetId: "123e4567-e89b-12d3-a456-426614174003",
				isStale: false,
			});
			expect(snap.references[2].occurrences).toHaveLength(1);
			expect(snap.references[2].occurrences[0]).toMatchObject({ type: "metadata", path: "tagIds", ordinal: 1 });
		});

		it("extracts ordered/deduplicated refs with occurrences from collection itemIds", async () => {
			const snap = await prepareSnapshot({
				collection: "collection",
				slug: "a",
				metadata: {
					itemIds: ["123e4567-e89b-12d3-a456-426614174001", "123e4567-e89b-12d3-a456-426614174001"],
				},
				mdx: "",
			});
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174001",
				isStale: false,
			});
			expect(snap.references[0].occurrences).toHaveLength(2);
			expect(snap.references[0].occurrences[0]).toMatchObject({ type: "metadata", path: "itemIds", ordinal: 0 });
			expect(snap.references[0].occurrences[1]).toMatchObject({ type: "metadata", path: "itemIds", ordinal: 1 });
		});

		it("extracts ordered/deduplicated refs with occurrences from ContentLink and Image", async () => {
			const mdx =
				'<ContentLink targetId="123e4567-e89b-12d3-a456-426614174000" />\n<Image mediaId="987e4567-e89b-12d3-a456-426614174000" />\n<ContentLink targetId="123e4567-e89b-12d3-a456-426614174000" />';
			const snap = await prepareSnapshot({ collection: "post", slug: "a", metadata: {}, mdx });
			expect(snap.references).toHaveLength(2);

			expect(snap.references[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: false,
			});
			expect(snap.references[0].occurrences).toHaveLength(2);
			expect(snap.references[0].occurrences[0]).toMatchObject({ type: "mdx", line: 1, column: 1 });

			expect(snap.references[1]).toMatchObject({
				kind: "media",
				targetId: "987e4567-e89b-12d3-a456-426614174000",
				isStale: false,
			});
			expect(snap.references[1].occurrences).toHaveLength(1);
			expect(snap.references[1].occurrences[0]).toMatchObject({ line: 2, column: 1 });
		});

		it.each([
			['<ContentLink targetId="" />', "empty_reference_id"],
			["<Image mediaId={dynamicId} />", "dynamic_reference_id"],
			['<ContentLink targetId="not-static" />', "invalid_reference_id"],
		])("creates structured issues for empty/dynamic/invalid IDs: %s", async (mdx, expectedIssue) => {
			const snap = await prepareSnapshot({ collection: "post", slug: "a", metadata: {}, mdx });
			expect(snap.issues).toContainEqual(expect.objectContaining({ code: expectedIssue }));
		});

		it("retains trusted previous refs marked stale on MDX syntax error and keeps exact MDX unchanged", async () => {
			const mdx = "</Invalid>";
			const previousReferences: Reference[] = [
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 1 }],
				},
			];
			const snap = await prepareSnapshot({ collection: "post", slug: "a", metadata: {}, mdx }, { previousReferences });

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "mdx_error" }));
			expect(snap.mdx).toBe(mdx);
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: true,
			});
		});

		it("retains trusted previous refs marked stale on semantic-analyze-error", async () => {
			const mdx = "<Image />";
			const previousReferences: Reference[] = [
				{
					kind: "media",
					targetId: "987e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 1 }],
				},
			];
			const snap = await prepareSnapshot({ collection: "post", slug: "a", metadata: {}, mdx }, { previousReferences });

			expect(snap.issues).toContainEqual(expect.objectContaining({ code: "missing_media_id" }));
			expect(snap.references).toHaveLength(1);
			expect(snap.references[0]).toMatchObject({
				kind: "media",
				targetId: "987e4567-e89b-12d3-a456-426614174000",
				isStale: true,
			});
		});
	});

	describe("5. Frontmatter handling", () => {
		it("preserves frontmatter bytes, draft is allowed, but produces frontmatter_present issue making it not ready", async () => {
			const mdx = "---\ntitle: test\n---\nHello";
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn().mockResolvedValue(undefined),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.createDraft({
				collection: "post",
				slug: "a",
				metadata: {},
				mdx,
			});

			expect(storePort.createEntryWithReferences).toHaveBeenCalledTimes(1);
			const callArg = vi.mocked(storePort.createEntryWithReferences).mock.calls[0][0];
			expect(callArg.snapshot.mdx).toBe(mdx);
			expect(callArg.snapshot.issues).toContainEqual(expect.objectContaining({ code: "frontmatter_present" }));

			const validation = validateForPublish(callArg.snapshot, { targets: [], media: [] });
			expect(validation.ready).toBe(false);
			expect(validation.issues).toContainEqual(expect.objectContaining({ code: "frontmatter_present" }));
		});
	});

	describe("6. Publish validation tables", () => {
		const validSnap: PreparedSnapshot = {
			collection: "post",
			slug: "valid-post",
			metadata: {
				title: "Title",
				categoryId: "123e4567-e89b-12d3-a456-426614174001",
				tagIds: ["123e4567-e89b-12d3-a456-426614174002"],
			},
			mdx: "Content",
			schemaVersion: 1,
			contentHash: "hash",
			references: [
				{
					kind: "category",
					targetId: "123e4567-e89b-12d3-a456-426614174001",
					isStale: false,
					occurrences: [{ type: "metadata", path: "categoryId" }],
				},
				{
					kind: "tag",
					targetId: "123e4567-e89b-12d3-a456-426614174002",
					isStale: false,
					occurrences: [{ type: "metadata", path: "tagIds", ordinal: 0 }],
				},
			],
			issues: [],
		};

		const validResolvedTargets: ResolvedTargets = {
			targets: [
				{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: "category" },
				{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: "tag" },
			],
			media: [],
		};

		it.each([
			[
				"missing title",
				{ ...validSnap, metadata: { categoryId: "123e4567-e89b-12d3-a456-426614174001" } },
				validResolvedTargets,
				"missing_title",
			],
			["null slug", { ...validSnap, slug: null }, validResolvedTargets, "null_slug"],
			["empty body", { ...validSnap, mdx: "" }, validResolvedTargets, "empty_body"],
			[
				"missing categoryId",
				{ ...validSnap, metadata: { title: "Title" }, references: [] },
				validResolvedTargets,
				"missing_category",
			],
			[
				"mdx issues",
				{ ...validSnap, issues: [{ code: "mdx_error", message: "Error" }] },
				validResolvedTargets,
				"mdx_error",
			],
			[
				"unresolved content target",
				{
					...validSnap,
					references: [
						{ kind: "entry", targetId: "123e4567-e89b-12d3-a456-426614174000", isStale: false, occurrences: [] },
					],
				},
				validResolvedTargets,
				"unresolved_reference",
			],
			[
				"unpublished content target",
				{
					...validSnap,
					references: [
						{ kind: "entry", targetId: "123e4567-e89b-12d3-a456-426614174000", isStale: false, occurrences: [] },
					],
				},
				{
					targets: [
						...validResolvedTargets.targets,
						{ id: "123e4567-e89b-12d3-a456-426614174000", isPublished: false, collection: "post" },
					],
					media: [],
				},
				"unpublished_reference",
			],
			[
				"unresolved media",
				{
					...validSnap,
					references: [
						...validSnap.references,
						{
							kind: "media",
							targetId: "987e4567-e89b-12d3-a456-426614174000",
							isStale: false,
							occurrences: [],
						},
					],
				},
				validResolvedTargets,
				"unresolved_media",
			],
			["unresolved category", validSnap, { targets: [], media: [] }, "unresolved_reference"],
			[
				"wrong-collection category",
				validSnap,
				{ targets: [{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: "tag" }], media: [] },
				"invalid_reference_collection",
			],
			[
				"unresolved tag",
				validSnap,
				{
					targets: [{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: "category" }],
					media: [],
				},
				"unresolved_reference",
			],
			[
				"wrong-collection tag",
				validSnap,
				{
					targets: [
						{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: "category" },
						{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: "post" },
					],
					media: [],
				},
				"invalid_reference_collection",
			],
		] satisfies Array<
			[string, PreparedSnapshot, ResolvedTargets, string]
		>)("not ready when %s", (_, snap, resolved, expectedIssueCode) => {
			const validation = validateForPublish(snap, resolved);
			expect(validation.ready).toBe(false);
			expect(validation.issues).toContainEqual(expect.objectContaining({ code: expectedIssueCode }));
		});

		it("is ready when valid and targets resolved", () => {
			const validation = validateForPublish(validSnap, validResolvedTargets);
			expect(validation.ready).toBe(true);
		});
	});

	describe("7. Collection itemIds", () => {
		it("preserves declared order and duplicates conservatively, validates target collection", async () => {
			const snap = await prepareSnapshot({
				collection: "collection",
				slug: "my-col",
				metadata: {
					itemIds: [
						"123e4567-e89b-12d3-a456-426614174002",
						"123e4567-e89b-12d3-a456-426614174001",
						"123e4567-e89b-12d3-a456-426614174002",
					],
				},
				mdx: "",
			});
			expect(Array.isArray(snap.metadata.itemIds)).toBe(true);
			if (Array.isArray(snap.metadata.itemIds)) {
				expect(snap.metadata.itemIds).toEqual([
					"123e4567-e89b-12d3-a456-426614174002",
					"123e4567-e89b-12d3-a456-426614174001",
					"123e4567-e89b-12d3-a456-426614174002",
				]);
			}

			const snapWithItems: PreparedSnapshot = {
				collection: "collection",
				slug: "valid-col",
				metadata: {
					title: "T",
					itemIds: ["123e4567-e89b-12d3-a456-426614174001", "123e4567-e89b-12d3-a456-426614174002"],
				},
				mdx: "",
				schemaVersion: 1,
				contentHash: "hash",
				references: [],
				issues: [],
			};

			const validation = validateForPublish(snapWithItems, {
				targets: [
					{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: "post" },
					{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: "memo" },
				],
				media: [],
			});
			expect(validation.ready).toBe(false);
			expect(validation.issues).toContainEqual(expect.objectContaining({ code: "invalid_item_collection" }));
		});

		it("is ready when all resolved IDs are published post targets, preserving order and duplicates", () => {
			const snapWithItems: PreparedSnapshot = {
				collection: "collection",
				slug: "valid-col",
				metadata: {
					title: "Title",
					itemIds: [
						"123e4567-e89b-12d3-a456-426614174001",
						"123e4567-e89b-12d3-a456-426614174002",
						"123e4567-e89b-12d3-a456-426614174001",
					],
				},
				mdx: "",
				schemaVersion: 1,
				contentHash: "hash",
				references: [
					{
						kind: "entry",
						targetId: "123e4567-e89b-12d3-a456-426614174001",
						isStale: false,
						occurrences: [
							{ type: "metadata", path: "itemIds", ordinal: 0 },
							{ type: "metadata", path: "itemIds", ordinal: 2 },
						],
					},
					{
						kind: "entry",
						targetId: "123e4567-e89b-12d3-a456-426614174002",
						isStale: false,
						occurrences: [{ type: "metadata", path: "itemIds", ordinal: 1 }],
					},
				],
				issues: [],
			};

			const validation = validateForPublish(snapWithItems, {
				targets: [
					{ id: "123e4567-e89b-12d3-a456-426614174001", isPublished: true, collection: "post" },
					{ id: "123e4567-e89b-12d3-a456-426614174002", isPublished: true, collection: "post" },
				],
				media: [],
			});
			expect(validation.ready).toBe(true);
			expect(validation.issues).toHaveLength(0);
		});
	});

	describe("8. Service Orchestration & Fake Port", () => {
		it("saveDraft propagates save port rejection exact error after one mutation attempt", async () => {
			const exactError = { code: "concurrent_modification", message: "Conflict" };
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue([]),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockRejectedValue(exactError),
			};
			const service = createContentService(storePort);

			await expect(
				service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
					collection: "post",
					slug: "a",
					metadata: { title: "Title" },
					mdx: "Hello",
					expectedVersion: 2,
				}),
			).rejects.toBe(exactError);

			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledTimes(1);
		});

		it("saveDraft invalid input preparation proves saveWorkingWithReferences is not called", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue([]),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			await expect(
				service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
					collection: "unknown",
					slug: "a",
					metadata: {},
					mdx: "",
				} as unknown as SaveDraftInput),
			).rejects.toBeDefined();

			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("createDraft uses exactly one atomic call, no previous refs/contentHash, exact port error propagated", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn().mockResolvedValue(undefined),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			await service.createDraft({
				collection: "post",
				slug: "a",
				metadata: { title: "Title" },
				mdx: "Hello",
			});

			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).toHaveBeenCalledTimes(1);
			expect(storePort.createEntryWithReferences).toHaveBeenCalledWith(
				expect.objectContaining({
					snapshot: expect.objectContaining({ slug: "a" }),
					references: expect.any(Array),
				}),
			);

			const callArgs = vi.mocked(storePort.createEntryWithReferences).mock.calls[0][0];
			expect(callArgs).not.toHaveProperty("previousReferences");
			expect(callArgs).not.toHaveProperty("contentHash");

			const exactError = { code: "slug_conflict", message: "Duplicate" };
			const conflictPort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn().mockRejectedValue(exactError),
				saveWorkingWithReferences: vi.fn(),
			};
			const serviceConflict = createContentService(conflictPort);

			await expect(
				serviceConflict.createDraft({
					collection: "post",
					slug: "a",
					metadata: {},
					mdx: "",
				}),
			).rejects.toBe(exactError);

			await expect(
				serviceConflict.createDraft({
					collection: "unknown",
					slug: "a",
					metadata: {},
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toBeDefined();
			expect(conflictPort.createEntryWithReferences).toHaveBeenCalledTimes(1);
		});

		it("saveDraft stale behavior: passes loaded references as stale when MDX has semantic errors", async () => {
			const previousRefs: Reference[] = [
				{
					kind: "entry",
					targetId: "123e4567-e89b-12d3-a456-426614174000",
					isStale: false,
					occurrences: [{ type: "mdx", line: 1, column: 1 }],
				},
			];
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue(previousRefs),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
				collection: "post",
				slug: "a",
				metadata: { title: "Title" },
				mdx: "</Invalid>",
				expectedVersion: 2,
			});

			expect(storePort.getWorkingReferences).toHaveBeenCalledTimes(1);
			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledTimes(1);
			const savedRefs = vi.mocked(storePort.saveWorkingWithReferences).mock.calls[0][0].references;
			expect(savedRefs).toHaveLength(1);
			expect(savedRefs[0]).toMatchObject({
				kind: "entry",
				targetId: "123e4567-e89b-12d3-a456-426614174000",
				isStale: true,
				occurrences: [{ type: "mdx", line: 1, column: 1 }],
			});
		});

		it("saveDraft loads previous refs only for save, makes one atomic call, forwards expectedVersion", async () => {
			const previousRefs: Reference[] = [
				{ kind: "entry", targetId: "123e4567-e89b-12d3-a456-426614174000", isStale: false, occurrences: [] },
			];
			const storePort: StorePort = {
				getWorkingReferences: vi.fn().mockResolvedValue(previousRefs),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn().mockResolvedValue(undefined),
			};
			const service = createContentService(storePort);

			await service.saveDraft("123e4567-e89b-12d3-a456-426614174000", {
				collection: "post",
				slug: "a",
				metadata: { title: "Title" },
				mdx: "Hello",
				expectedVersion: 2,
			});

			expect(storePort.getWorkingReferences).toHaveBeenCalledTimes(1);
			expect(storePort.getWorkingReferences).toHaveBeenCalledWith(
				expect.objectContaining({ entryId: "123e4567-e89b-12d3-a456-426614174000" }),
			);
			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledTimes(1);
			expect(storePort.saveWorkingWithReferences).toHaveBeenCalledWith(
				expect.objectContaining({
					entryId: "123e4567-e89b-12d3-a456-426614174000",
					expectedVersion: 2,
					snapshot: expect.objectContaining({ slug: "a" }),
					references: expect.any(Array),
				}),
			);
		});
	});

	describe("9. Exact Byte Limits & Structural Boundaries", () => {
		it("accepts exact boundary and rejects +1-byte for mdx_too_large", async () => {
			const mdxExact = "a".repeat(2097152);
			const mdxTooLarge = "a".repeat(2097153);
			await expect(
				prepareSnapshot({ collection: "post", slug: "valid", metadata: {}, mdx: mdxExact }),
			).resolves.toBeDefined();
			await expect(
				prepareSnapshot({
					collection: "post",
					slug: "valid",
					metadata: {},
					mdx: mdxTooLarge,
				}),
			).rejects.toMatchObject({ code: "mdx_too_large" });
		});

		it("accepts exact boundary and rejects +1-byte for metadata_too_large", async () => {
			// Overhead of {"summary":""} is 14 bytes. 262144 - 14 = 262130
			const boundaryString = "a".repeat(262130);
			await expect(
				prepareSnapshot({
					collection: "post",
					slug: "valid",
					metadata: { summary: boundaryString },
					mdx: "",
				}),
			).resolves.toBeDefined();
			const tooLargeString = "a".repeat(262131);
			await expect(
				prepareSnapshot({
					collection: "post",
					slug: "valid",
					metadata: { summary: tooLargeString },
					mdx: "",
				}),
			).rejects.toMatchObject({ code: "metadata_too_large" });
		});

		it.each([
			["missing slug", { collection: "post", metadata: {}, mdx: "" }, "invalid_input"],
			["extra key", { collection: "post", slug: "valid", metadata: {}, mdx: "", extra: 1 }, "invalid_input"],
			[
				"prototype-inherited required fields",
				Object.create(
					{ slug: "valid" },
					{
						collection: { value: "post", enumerable: true },
						metadata: { value: {}, enumerable: true },
						mdx: { value: "", enumerable: true },
					},
				),
				"invalid_input",
			],
			[
				"symbol extra",
				{ collection: "post", slug: "valid", metadata: {}, mdx: "", [Symbol("extra")]: 1 },
				"invalid_input",
			],
			[
				"non-enumerable extra",
				Object.defineProperty({ collection: "post", slug: "valid", metadata: {}, mdx: "" }, "hidden", {
					value: 1,
					enumerable: false,
				}),
				"invalid_input",
			],
		])("rejects non-exact service inputs: %s", async (_, input, expectedCode) => {
			await expect(prepareSnapshot(input as unknown as ServiceInput)).rejects.toMatchObject({ code: expectedCode });
		});

		it("prevents mutation of snapshot via caller input mutation and deep freezes snapshot", async () => {
			const tagIds = ["123e4567-e89b-12d3-a456-426614174001"];
			const snap = await prepareSnapshot({ collection: "post", slug: "valid", metadata: { tagIds }, mdx: "" });
			const originalHash = snap.contentHash;

			tagIds.push("123e4567-e89b-12d3-a456-426614174002");
			expect(Array.isArray(snap.metadata.tagIds)).toBe(true);
			if (Array.isArray(snap.metadata.tagIds)) {
				expect(snap.metadata.tagIds).toHaveLength(1);
			}

			expect(() => {
				(snap as unknown as { mdx: string }).mdx = "changed";
			}).toThrow();
			expect(() => {
				(snap.metadata as unknown as { title: string }).title = "changed";
			}).toThrow();
			expect(() => {
				(snap.references as unknown as { push: (a: unknown) => void }).push({});
			}).toThrow();

			// Regression assertion for pushing to metadata.tagIds
			expect(() => {
				(snap.metadata.tagIds as unknown as { push: (a: string) => void }).push("new-tag");
			}).toThrow();

			expect(snap.contentHash).toBe(originalHash);
			expect(snap.references).toHaveLength(1); // just tag
		});

		it("rejects metadata with symbols without executing getter", async () => {
			const meta = { title: "valid" };
			Object.defineProperty(meta, Symbol("hidden"), { value: "invalid", enumerable: true });

			await expect(
				prepareSnapshot({
					collection: "post",
					slug: "valid",
					metadata: meta,
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toMatchObject({ code: "invalid_input" });
		});

		it("rejects metadata with getters without executing getter", async () => {
			const spy = vi.fn();
			const meta = { title: "valid" };
			Object.defineProperty(meta, "summary", {
				get: spy,
				enumerable: true,
			});

			await expect(
				prepareSnapshot({
					collection: "post",
					slug: "valid",
					metadata: meta,
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toMatchObject({ code: "invalid_input" });

			expect(spy).not.toHaveBeenCalled();
		});

		it("rejects sparse arrays in metadata", async () => {
			const sparseArray = ["123e4567-e89b-12d3-a456-426614174001"];
			delete sparseArray[0];
			await expect(
				prepareSnapshot({
					collection: "post",
					slug: "valid",
					metadata: { tagIds: sparseArray },
					mdx: "",
				} as unknown as ServiceInput),
			).rejects.toMatchObject({ code: "invalid_metadata_type" });
		});
	});

	describe("10. Service Input Structural & Accessor Defenses", () => {
		it("createDraft(null) rejects with ServiceError code invalid_input, not native TypeError, and no port call", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const promise = service.createDraft(null as unknown as ServiceInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("createDraft custom-prototype input rejects invalid_input and no port call", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const customProtoInput = Object.create(
				{ inherited: true },
				{
					collection: { value: "post", enumerable: true },
					slug: { value: "valid", enumerable: true },
					metadata: { value: {}, enumerable: true },
					mdx: { value: "", enumerable: true },
				},
			);

			const promise = service.createDraft(customProtoInput as unknown as ServiceInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("createDraft top-level accessor/getter property rejects without executing getter and no port call", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const getterSpy = vi.fn(() => "post");
			const inputWithGetter = {
				get collection() {
					return getterSpy();
				},
				slug: "valid",
				metadata: {},
				mdx: "",
			};

			const promise = service.createDraft(inputWithGetter as unknown as ServiceInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(getterSpy).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
		});

		it("saveDraft null/custom-prototype input rejects invalid_input before getWorkingReferences or mutation", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const promiseNull = service.saveDraft("entry-id", null as unknown as SaveDraftInput);
			await expect(promiseNull).rejects.toThrowError(ServiceError);
			await expect(promiseNull).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();

			const customProtoInput = Object.create(
				{ inherited: true },
				{
					collection: { value: "post", enumerable: true },
					slug: { value: "valid", enumerable: true },
					metadata: { value: {}, enumerable: true },
					mdx: { value: "", enumerable: true },
					expectedVersion: { value: 1, enumerable: true },
				},
			);

			const promiseProto = service.saveDraft("entry-id", customProtoInput as unknown as SaveDraftInput);
			await expect(promiseProto).rejects.toThrowError(ServiceError);
			await expect(promiseProto).rejects.toMatchObject({ code: "invalid_input" });
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
		});

		it("saveDraft expectedVersion accessor getter rejects without executing getter or Store calls", async () => {
			const storePort: StorePort = {
				getWorkingReferences: vi.fn(),
				createEntryWithReferences: vi.fn(),
				saveWorkingWithReferences: vi.fn(),
			};
			const service = createContentService(storePort);

			const getterSpy = vi.fn(() => 1);
			const inputWithGetter = {
				collection: "post",
				slug: "valid",
				metadata: {},
				mdx: "",
				get expectedVersion() {
					return getterSpy();
				},
			};

			const promise = service.saveDraft("entry-id", inputWithGetter as unknown as SaveDraftInput);
			await expect(promise).rejects.toThrowError(ServiceError);
			await expect(promise).rejects.toMatchObject({ code: "invalid_input" });
			expect(getterSpy).not.toHaveBeenCalled();
			expect(storePort.getWorkingReferences).not.toHaveBeenCalled();
			expect(storePort.saveWorkingWithReferences).not.toHaveBeenCalled();
			expect(storePort.createEntryWithReferences).not.toHaveBeenCalled();
		});
	});
});
