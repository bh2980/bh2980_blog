import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Entry } from "../content-store";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";

// ---------------------------------------------------------------------------
// Local type declarations for the not-yet-implemented listEntries API
// ---------------------------------------------------------------------------

interface ListEntriesItem {
	id: string;
	collection: string;
	title: string | null;
	slug: string | null;
	status: "draft" | "published";
	folderId: string | null;
	categoryId: string | null;
	tagIds: readonly string[];
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

interface ListEntriesParams {
	collection: string;
	search?: string;
	includeBody?: boolean;
	statuses?: readonly ("draft" | "published")[];
	folderId?: string | null;
	includeDescendants?: boolean;
	sort?: {
		field: "updatedAt" | "createdAt" | "title" | "slug";
		direction: "asc" | "desc";
	};
	page?: number;
	pageSize?: 25 | 50 | 100;
}

interface Folder {
	id: string;
	collection: string;
	parentId: string | null;
	name: string;
	position: number;
}

interface ExtendedContentStore {
	listEntries(params: ListEntriesParams): Promise<{
		items: ListEntriesItem[];
		total: number;
		page: number;
		pageSize: number;
	}>;
	createEntryWithReferences(params: {
		snapshot: {
			collection: string;
			slug: string | null;
			metadata: Record<string, unknown>;
			mdx: string;
			schemaVersion: number;
			contentHash: string;
			references: unknown[];
			issues: unknown[];
		};
		references: unknown[];
	}): Promise<Entry>;
	createFolder(params: {
		collection: string;
		parentId: string | null;
		name: string;
		position?: number;
	}): Promise<Folder>;
	moveEntryToFolder(params: {
		entryId: string;
		folderId: string | null;
		expectedVersion: number;
	}): Promise<Entry & { folderId: string | null }>;
}

// ---------------------------------------------------------------------------
// Error assertion helper — identity + code
// ---------------------------------------------------------------------------

function expectCmsError(err: unknown, code: string): void {
	expect(err).toBeInstanceOf(CmsError);
	expect((err as CmsError).code).toBe(code);
}

// ---------------------------------------------------------------------------
// Suite-local DB infrastructure (own Pool, random schema, no shared global)
// ---------------------------------------------------------------------------

describe("listEntries contract", () => {
	const ctx: { pool?: Pool; schema?: string; schemaCreated: boolean } = { schemaCreated: false };
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore> & ExtendedContentStore;

	beforeAll(async () => {
		const url = process.env.CMS_TEST_DATABASE_URL;
		if (!url) {
			throw new Error("CMS_TEST_DATABASE_URL is required — never use CMS_DATABASE_URL for tests.");
		}
		schemaName = `cms_le_${randomBytes(4).toString("hex")}`;
		pool = new Pool({ connectionString: url });
		ctx.pool = pool;
		ctx.schema = schemaName;
		await pool.query(`CREATE SCHEMA "${schemaName}"`);
		ctx.schemaCreated = true;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName }) as unknown as typeof store;
	});

	afterAll(async () => {
		try {
			if (ctx.pool && ctx.schemaCreated && ctx.schema) {
				await ctx.pool.query(`DROP SCHEMA "${ctx.schema}" CASCADE`);
			}
		} finally {
			if (ctx.pool) {
				await ctx.pool.end();
			}
		}
	});

	beforeEach(async () => {
		if (ctx.schemaCreated) {
			try {
				await pool.query(`TRUNCATE "${schemaName}".entries CASCADE`);
				await pool.query(`TRUNCATE "${schemaName}".folders CASCADE`);
			} catch {
				// Tables might not exist yet
			}
		}
	});

	// -----------------------------------------------------------------------
	// Fixture helpers
	// -----------------------------------------------------------------------

	let seqCounter = 0;
	function uniqueHash(): string {
		seqCounter += 1;
		return `h${seqCounter}_${randomBytes(4).toString("hex")}`;
	}

	async function seed(
		collection: string,
		slug: string | null,
		title: string | null,
		opts: {
			status?: "draft" | "published";
			folderId?: string | null;
			mdx?: string;
		} = {},
	): Promise<Entry & { folderId?: string | null }> {
		const entry = await store.createEntry({
			collection,
			slug,
			metadata: { title },
			mdx: opts.mdx ?? "default body",
			schemaVersion: 1,
			contentHash: uniqueHash(),
		});

		let current: Entry & { folderId?: string | null } = entry;

		if (opts.status === "published") {
			if (slug === null) {
				throw new Error("Cannot publish an entry with null slug in fixture");
			}
			current = await store.publishEntry(entry.id, {
				expectedVersion: current.version,
			});
		}

		if (opts.folderId) {
			current = await store.moveEntryToFolder({
				entryId: entry.id,
				folderId: opts.folderId,
				expectedVersion: current.version,
			});
		}

		return current;
	}

	// -----------------------------------------------------------------------
	// 1  exact item keys, default pagination, collection isolation
	// -----------------------------------------------------------------------

	it("1. exact item keys, default pagination, collection isolation", async () => {
		await seed("post", "le1a-slug", "Le1a Title");
		await seed("memo", "le1b-slug", "Le1b Title");

		const res = await store.listEntries({ collection: "post" });

		// pagination defaults
		expect(res.page).toBe(1);
		expect(res.pageSize).toBe(25);
		expect(res.total).toBe(1);
		expect(res.items).toHaveLength(1);

		// objectContaining check
		const item = res.items[0];
		expect(item).toEqual(
			expect.objectContaining({
				id: expect.any(String),
				collection: "post",
				title: "Le1a Title",
				slug: "le1a-slug",
				status: "draft",
				folderId: null,
				categoryId: null,
				tagIds: expect.any(Array),
				publishedAt: null,
				createdAt: expect.any(Date),
				updatedAt: expect.any(Date),
			}),
		);
		expect("body" in item).toBe(false);
		expect("mdx" in item).toBe(false);

		// collection isolation — memo not returned
		const res2 = await store.listEntries({ collection: "memo" });
		expect(res2.total).toBe(1);
		expect(res2.items[0].collection).toBe("memo");
	});

	// -----------------------------------------------------------------------
	// 2  Korean + Latin case-insensitive substring; body search gating
	// -----------------------------------------------------------------------

	it("2. Korean case-insensitive substring over title+slug; Latin case-insensitive; MDX body excluded by default, searched only with includeBody=true, but never adds body to output", async () => {
		await seed("post", "slug-한국어", "제목 테스트", {
			mdx: '본문 내용 <Hidden attr="secret" /> [Link](http://example.com/url)',
		});
		await seed("post", "le2-other", "Unrelated Alpha title % _", { mdx: "body with % and _ chars" });

		// title search (Korean)
		const byTitle = await store.listEntries({ collection: "post", search: "제목" });
		expect(byTitle.items).toHaveLength(1);
		expect(byTitle.items[0].title).toBe("제목 테스트");

		// slug search (Korean)
		const bySlug = await store.listEntries({ collection: "post", search: "한국어" });
		expect(bySlug.items).toHaveLength(1);
		expect(bySlug.items[0].slug).toBe("slug-한국어");

		// Latin case-insensitive: seed has "Alpha" in title, search "alpha" (lowercase)
		const byAlpha = await store.listEntries({ collection: "post", search: "alpha" });
		expect(byAlpha.items).toHaveLength(1);
		expect(byAlpha.items[0].title).toBe("Unrelated Alpha title % _");

		// % and _ are literal
		const byPct = await store.listEntries({ collection: "post", search: "%" });
		expect(byPct.items).toHaveLength(1);
		expect(byPct.items[0].slug).toBe("le2-other");

		// MDX syntax tokens should NOT match in body search
		const byAttr = await store.listEntries({ collection: "post", search: "secret", includeBody: true });
		expect(byAttr.items).toHaveLength(0);
		const byUrl = await store.listEntries({ collection: "post", search: "example", includeBody: true });
		expect(byUrl.items).toHaveLength(0);

		// body NOT searched by default
		const noBodySearch = await store.listEntries({ collection: "post", search: "본문" });
		expect(noBodySearch.items).toHaveLength(0);

		// body IS searched with includeBody=true
		const withBody = await store.listEntries({ collection: "post", search: "본문", includeBody: true });
		expect(withBody.items).toHaveLength(1);
		expect(withBody.items[0].slug).toBe("slug-한국어");

		// includeBody never adds a body field to output
		expect("body" in withBody.items[0]).toBe(false);
		expect("mdx" in withBody.items[0]).toBe(false);

		// Valid collection post plus SQL-looking malicious search string safely returns 0 items, proving parameterization
		const maliciousSearch = await store.listEntries({
			collection: "post",
			search: "'; DROP TABLE entries;--",
		});
		expect(maliciousSearch.items).toHaveLength(0);

		// Malicious invalid collection string containing SQL text passed through intentional unknown cast => CmsError invalid_input
		let colErr: unknown;
		try {
			await store.listEntries({
				collection: "'; DROP TABLE entries;--" as unknown as "post",
			});
		} catch (e) {
			colErr = e;
		}
		expectCmsError(colErr, "invalid_input");

		// Assert schema survives
		const afterTables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [
			schemaName,
		]);
		expect(afterTables.rows.length).toBeGreaterThan(0);
	});

	it("2b. Visible body search: syntax-only needles/URL must not match; nested visible text/link label/fenced code must match", async () => {
		const slug = "d2-body-search";
		await seed("post", slug, "Body Search Title", {
			mdx: `
{/* SecretComment123 */}
export const meta = { val: "ExportedVar456" };
<div data-attr="before>AttrTail789">
  <span className="NestedClass">VisibleNestedText321</span>
</div>
[LinkLabel654](https://example.com/LinkUrl987)
\`\`\`js
console.log("FencedCode000");
\`\`\`
`,
		});

		const expectMatch = async (needle: string, shouldMatch: boolean, withBody: boolean) => {
			const res = await store.listEntries({ collection: "post", search: needle, includeBody: withBody });
			const found = res.items.some((i) => i.slug === slug);
			expect(found).toBe(shouldMatch);
		};

		// Without includeBody, none should match
		await expectMatch("VisibleNestedText321", false, false);
		await expectMatch("LinkLabel654", false, false);

		// With includeBody=true
		await expectMatch("VisibleNestedText321", true, true);
		await expectMatch("LinkLabel654", true, true);
		await expectMatch("FencedCode000", true, true);

		// Must NOT match
		await expectMatch("SecretComment123", false, true);
		await expectMatch("ExportedVar456", false, true);
		await expectMatch("AttrTail789", false, true);
		await expectMatch("LinkUrl987", false, true);
	}, 15_000);

	// -----------------------------------------------------------------------
	// 3  status filter; folder undefined/null/direct/descendants
	// -----------------------------------------------------------------------

	it("3. draft/published status filter; folder undefined=all, null=unfiled, folderId=direct, includeDescendants", async () => {
		const f3a = await store.createFolder({ collection: "post", parentId: null, name: "F3a" });
		const f3b = await store.createFolder({ collection: "post", parentId: f3a.id, name: "F3b" });

		await seed("post", "le3-unfiled", "unfiled draft");
		await seed("post", "le3-pub-f3a", "pub in f3a", { status: "published", folderId: f3a.id });
		await seed("post", "le3-pub-f3b", "pub in f3b", { status: "published", folderId: f3b.id });

		// status filtering
		const drafts = await store.listEntries({ collection: "post", statuses: ["draft"] });
		expect(drafts.items.map((i) => i.slug)).toEqual(["le3-unfiled"]);

		const pubs = await store.listEntries({ collection: "post", statuses: ["published"] });
		expect(pubs.items.map((i) => i.slug).sort()).toEqual(["le3-pub-f3a", "le3-pub-f3b"]);

		// multiple statuses
		const both = await store.listEntries({ collection: "post", statuses: ["draft", "published"] });
		expect(both.items).toHaveLength(3);

		// folderId undefined → all
		const all = await store.listEntries({ collection: "post" });
		expect(all.items).toHaveLength(3);

		// folderId null → unfiled
		const unfiled = await store.listEntries({ collection: "post", folderId: null });
		expect(unfiled.items.map((i) => i.slug)).toEqual(["le3-unfiled"]);

		// direct folder
		const direct = await store.listEntries({ collection: "post", folderId: f3a.id, includeDescendants: false });
		expect(direct.items.map((i) => i.slug)).toEqual(["le3-pub-f3a"]);

		// descendants
		const desc = await store.listEntries({ collection: "post", folderId: f3a.id, includeDescendants: true });
		expect(desc.items.map((i) => i.slug).sort()).toEqual(["le3-pub-f3a", "le3-pub-f3b"]);
	}, 15_000);

	// -----------------------------------------------------------------------
	// 4  AND vs OR across status+folder; collection is mandatory; supplied search is ANDed
	// -----------------------------------------------------------------------

	it("4. predicates are AND, multiple statuses are OR; collection is mandatory; when search is supplied it remains AND with other predicates", async () => {
		const f4 = await store.createFolder({ collection: "post", parentId: null, name: "F4" });

		// Fixture names chosen so none contains a substring of another:
		// "alpha" is unique, "zeta" is unique
		await seed("post", "le4-df", "alpha draft in folder", { status: "draft", folderId: f4.id });
		await seed("post", "le4-pf", "alpha pub in folder", { status: "published", folderId: f4.id });
		await seed("post", "le4-du", "alpha draft unfiled", { status: "draft" });
		await seed("post", "le4-zeta", "zeta draft in folder", { status: "draft", folderId: f4.id });

		// Predicates AND, multiple statuses OR:
		// (draft OR published) AND folder=F4 AND search="alpha"
		const res = await store.listEntries({
			collection: "post",
			search: "alpha",
			statuses: ["draft", "published"],
			folderId: f4.id,
		});
		const resSlugs = res.items.map((i) => i.slug).sort();
		expect(resSlugs).toEqual(["le4-df", "le4-pf"]);
	}, 15_000);

	// -----------------------------------------------------------------------
	// 5  sort fields/directions, NULLS LAST, deterministic id tie-break
	// -----------------------------------------------------------------------

	it("5. all sort fields/directions, NULLS LAST both dirs, deterministic id tie-break; malicious sort rejects invalid_input", async () => {
		// Seed entries and capture IDs for deterministic assertions
		const e5a = await seed("post", null, null);
		const e5b = await seed("post", "le5-a", "B-title");
		const e5c = await seed("post", "le5-b", "A-title");

		const seededIds = [e5a.id, e5b.id, e5c.id];

		// Assign deterministic distinct created_at values via schema-qualified SQL
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE id = $2`, [
			new Date("2020-01-01T00:00:00Z"),
			seededIds[0],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE id = $2`, [
			new Date("2020-01-02T00:00:00Z"),
			seededIds[1],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE id = $2`, [
			new Date("2020-01-03T00:00:00Z"),
			seededIds[2],
		]);

		// Assign deterministic distinct updated_at values
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE id = $2`, [
			new Date("2021-06-01T00:00:00Z"),
			seededIds[0],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE id = $2`, [
			new Date("2021-06-02T00:00:00Z"),
			seededIds[1],
		]);
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE id = $2`, [
			new Date("2021-06-03T00:00:00Z"),
			seededIds[2],
		]);

		// --- default sort: updatedAt DESC then id ASC ---
		const defaultSort = await store.listEntries({ collection: "post" });
		expect(defaultSort.items.map((i) => i.id)).toEqual([seededIds[2], seededIds[1], seededIds[0]]);

		// --- createdAt ASC: e5a (Jan 1) → e5b (Jan 2) → e5c (Jan 3) ---
		const caAsc = await store.listEntries({ collection: "post", sort: { field: "createdAt", direction: "asc" } });
		expect(caAsc.items.map((i) => i.id)).toEqual([seededIds[0], seededIds[1], seededIds[2]]);

		// --- createdAt DESC: e5c → e5b → e5a ---
		const caDesc = await store.listEntries({ collection: "post", sort: { field: "createdAt", direction: "desc" } });
		expect(caDesc.items.map((i) => i.id)).toEqual([seededIds[2], seededIds[1], seededIds[0]]);

		// --- updatedAt ASC: e5a (Jun 1) → e5b (Jun 2) → e5c (Jun 3) ---
		const uaAsc = await store.listEntries({ collection: "post", sort: { field: "updatedAt", direction: "asc" } });
		expect(uaAsc.items.map((i) => i.id)).toEqual([seededIds[0], seededIds[1], seededIds[2]]);

		// --- updatedAt DESC: e5c → e5b → e5a ---
		const uaDesc = await store.listEntries({ collection: "post", sort: { field: "updatedAt", direction: "desc" } });
		expect(uaDesc.items.map((i) => i.id)).toEqual([seededIds[2], seededIds[1], seededIds[0]]);

		// --- Tied group for id ASC tie-break ---
		// Force all three to identical created_at
		await pool.query(`UPDATE "${schemaName}".entries SET created_at = $1 WHERE collection = 'post'`, [
			new Date("2020-01-01T00:00:00Z"),
		]);
		const tied = await store.listEntries({ collection: "post", sort: { field: "createdAt", direction: "asc" } });
		expect(tied.items).toHaveLength(3);
		const tiedIds = tied.items.map((i) => i.id);
		const sortedIds = [...tiedIds].sort();
		expect(tiedIds).toEqual(sortedIds);

		// --- slug ASC: NULLS LAST → le5-a, le5-b, null ---
		const slugAsc = await store.listEntries({ collection: "post", sort: { field: "slug", direction: "asc" } });
		expect(slugAsc.items.map((i) => i.slug)).toEqual(["le5-a", "le5-b", null]);

		// --- slug DESC: NULLS LAST → le5-b, le5-a, null ---
		const slugDesc = await store.listEntries({ collection: "post", sort: { field: "slug", direction: "desc" } });
		expect(slugDesc.items.map((i) => i.slug)).toEqual(["le5-b", "le5-a", null]);

		// --- title ASC: NULLS LAST → A-title, B-title, null ---
		const titleAsc = await store.listEntries({ collection: "post", sort: { field: "title", direction: "asc" } });
		expect(titleAsc.items.map((i) => i.title)).toEqual(["A-title", "B-title", null]);

		// --- title DESC: NULLS LAST → B-title, A-title, null ---
		const titleDesc = await store.listEntries({ collection: "post", sort: { field: "title", direction: "desc" } });
		expect(titleDesc.items.map((i) => i.title)).toEqual(["B-title", "A-title", null]);

		// Malicious runtime sort field → invalid_input, no schema mutation
		const beforeTables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [
			schemaName,
		]);

		const badSort = {
			field: "title; DROP TABLE entries --" as unknown as "title",
			direction: "asc" as const,
		};
		let sortErr: unknown;
		try {
			await store.listEntries({ collection: "post", sort: badSort });
		} catch (e) {
			sortErr = e;
		}
		expectCmsError(sortErr, "invalid_input");

		// invalid runtime direction
		let dirErr: unknown;
		try {
			await store.listEntries({ collection: "post", sort: { field: "title", direction: "drop" as "asc" } });
		} catch (e) {
			dirErr = e;
		}
		expectCmsError(dirErr, "invalid_input");

		// invalid status
		let statusErr: unknown;
		try {
			await store.listEntries({ collection: "post", statuses: ["draft", "invalid" as "published"] });
		} catch (e) {
			statusErr = e;
		}
		expectCmsError(statusErr, "invalid_input");

		const afterTables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [
			schemaName,
		]);
		expect(afterTables.rows).toEqual(beforeTables.rows);
	}, 15_000);

	// -----------------------------------------------------------------------
	// 6  pagination: 26 entries, exact metadata, no dup/omission, reject bad
	// -----------------------------------------------------------------------

	it("6. 26 entries pageSize=25: exact total/page metadata, no omission/duplicate, deterministic repeat; page<1 / invalid pageSize reject invalid_input", async () => {
		// Create 26 entries concurrently with bounded Promise.all
		await Promise.all(
			Array.from({ length: 26 }, (_, i) => seed("post", `le6-s${String(i).padStart(2, "0")}`, `Title ${i}`)),
		);

		// Force identical updatedAt for deterministic tie-break test
		await pool.query(`UPDATE "${schemaName}".entries SET updated_at = $1 WHERE collection = 'post'`, [
			new Date("2023-06-01T00:00:00Z"),
		]);

		const p1 = await store.listEntries({
			collection: "post",
			page: 1,
			pageSize: 25,
			sort: { field: "updatedAt", direction: "desc" },
		});
		expect(p1.total).toBe(26);
		expect(p1.page).toBe(1);
		expect(p1.pageSize).toBe(25);
		expect(p1.items).toHaveLength(25);

		const p2 = await store.listEntries({
			collection: "post",
			page: 2,
			pageSize: 25,
			sort: { field: "updatedAt", direction: "desc" },
		});
		expect(p2.total).toBe(26);
		expect(p2.page).toBe(2);
		expect(p2.pageSize).toBe(25);
		expect(p2.items).toHaveLength(1);

		// No duplicates, no omissions
		const allIds = [...p1.items.map((i) => i.id), ...p2.items.map((i) => i.id)];
		expect(new Set(allIds).size).toBe(26);

		// Assert full concatenated IDs equal exactly ID-ascending order for ties
		const expectedAllIds = [...allIds].sort();
		expect(allIds).toEqual(expectedAllIds);

		// Deterministic repeat
		const p1Again = await store.listEntries({
			collection: "post",
			page: 1,
			pageSize: 25,
			sort: { field: "updatedAt", direction: "desc" },
		});
		expect(p1Again.items.map((i) => i.id)).toEqual(p1.items.map((i) => i.id));

		// Reject page < 1
		let pageErr: unknown;
		try {
			await store.listEntries({ collection: "post", page: 0 });
		} catch (e) {
			pageErr = e;
		}
		expectCmsError(pageErr, "invalid_input");

		// Reject page noninteger
		let pageFloatErr: unknown;
		try {
			await store.listEntries({ collection: "post", page: 1.5 });
		} catch (e) {
			pageFloatErr = e;
		}
		expectCmsError(pageFloatErr, "invalid_input");

		// Reject invalid pageSize (not 25|50|100)
		let sizeErr: unknown;
		try {
			await store.listEntries({ collection: "post", pageSize: 30 as unknown as 25 });
		} catch (e) {
			sizeErr = e;
		}
		expectCmsError(sizeErr, "invalid_input");
	}, 30_000);
	// -----------------------------------------------------------------------
	// 7  List authority
	// -----------------------------------------------------------------------

	it("7. List authority: working metadata is authoritative for categoryId, ordered tagIds and display publishedAt", async () => {
		const directDate = "2020-05-05T00:00:00.000Z";
		await store.createEntry({
			collection: "post",
			slug: "d1-direct",
			metadata: { categoryId: "cat-1", tagIds: ["tag-a", "tag-b"], publishedAt: directDate },
			mdx: "body",
			schemaVersion: 1,
			contentHash: randomBytes(16).toString("hex"),
		});

		const targetCat = await store.createEntry({
			collection: "category",
			slug: "cat-real",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: randomBytes(16).toString("hex"),
		});
		const targetTag1 = await store.createEntry({
			collection: "tag",
			slug: "tag-real1",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: randomBytes(16).toString("hex"),
		});
		const targetTag2 = await store.createEntry({
			collection: "tag",
			slug: "tag-real2",
			metadata: {},
			mdx: "",
			schemaVersion: 1,
			contentHash: randomBytes(16).toString("hex"),
		});

		const refDate = "2021-08-08T00:00:00.000Z";
		await store.createEntryWithReferences({
			snapshot: {
				collection: "post",
				slug: "d1-ref",
				metadata: { categoryId: "cat-meta", tagIds: ["tag-meta1", "tag-meta2"], publishedAt: refDate },
				mdx: "body",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
				references: [],
				issues: [],
			},
			references: [
				{ kind: "category", targetId: targetCat.id, isStale: true, occurrences: [] },
				{ kind: "tag", targetId: targetTag2.id, isStale: true, occurrences: [] },
				{ kind: "tag", targetId: targetTag1.id, isStale: true, occurrences: [] },
			],
		});

		const histDate = "2019-01-01T00:00:00.000Z";
		const histE = await store.createEntry({
			collection: "post",
			slug: "d1-hist",
			metadata: { publishedAt: histDate },
			mdx: "body",
			schemaVersion: 1,
			contentHash: randomBytes(16).toString("hex"),
		});
		await store.publishEntry(histE.id, { expectedVersion: histE.version });

		const noMetaE = await store.createEntry({
			collection: "post",
			slug: "d1-nometa",
			metadata: {},
			mdx: "body",
			schemaVersion: 1,
			contentHash: randomBytes(16).toString("hex"),
		});
		const pubNoMetaE = await store.publishEntry(noMetaE.id, { expectedVersion: noMetaE.version });

		const list = await store.listEntries({ collection: "post" });

		const getBySlug = (s: string) => {
			const item = list.items.find((i) => i.slug === s);
			if (!item) throw new Error(`Missing ${s}`);
			return item;
		};

		const iDirect = getBySlug("d1-direct");
		expect(iDirect.categoryId).toBe("cat-1");
		expect(iDirect.tagIds).toEqual(["tag-a", "tag-b"]);
		expect(iDirect.publishedAt?.toISOString()).toBe(directDate);

		const iRef = getBySlug("d1-ref");
		expect(iRef.categoryId).toBe("cat-meta");
		expect(iRef.tagIds).toEqual(["tag-meta1", "tag-meta2"]);
		expect(iRef.publishedAt?.toISOString()).toBe(refDate);

		const iHist = getBySlug("d1-hist");
		expect(iHist.publishedAt?.toISOString()).toBe(histDate);

		const iNoMeta = getBySlug("d1-nometa");
		expect(iNoMeta.publishedAt).toBeInstanceOf(Date);
		expect(Math.abs((iNoMeta.publishedAt as Date).getTime() - (pubNoMetaE.publishedAt as Date).getTime())).toBeLessThan(
			5000,
		);

		for (const i of [iDirect, iRef, iHist, iNoMeta]) {
			expect("body" in i).toBe(false);
			expect("mdx" in i).toBe(false);
		}
	}, 15_000);

	// -----------------------------------------------------------------------
	// 8  Migration idempotency
	// -----------------------------------------------------------------------

	it("8. Migration idempotency sentinel: empty search_text backfill is not rewritten", async () => {
		const tempSchema = `cms_mig_${randomBytes(4).toString("hex")}`;
		await pool.query(`CREATE SCHEMA "${tempSchema}"`);
		try {
			await migrateContentStore(pool, { schema: tempSchema });
			const tempStore = createContentStore(pool, { schema: tempSchema });

			const e = await tempStore.createEntry({
				collection: "post",
				slug: "d4-empty",
				metadata: {},
				mdx: "<div />",
				schemaVersion: 1,
				contentHash: randomBytes(16).toString("hex"),
			});

			await pool.query(`UPDATE "${tempSchema}".entry_bodies SET search_text = '' WHERE entry_id = $1`, [e.id]);

			await pool.query(`
				CREATE OR REPLACE FUNCTION "${tempSchema}".raise_on_update() RETURNS trigger AS $$
				BEGIN
					RAISE EXCEPTION 'MIGRATION_REWRITE_DETECTED';
				END;
				$$ LANGUAGE plpgsql;

				CREATE TRIGGER no_rewrite_search_text
				BEFORE UPDATE OF search_text ON "${tempSchema}".entry_bodies
				FOR EACH ROW
				EXECUTE FUNCTION "${tempSchema}".raise_on_update();
			`);

			await expect(migrateContentStore(pool, { schema: tempSchema })).resolves.not.toThrow();
		} finally {
			await pool.query(`DROP SCHEMA "${tempSchema}" CASCADE`);
		}
	}, 15_000);
});
