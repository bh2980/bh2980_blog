import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Entry, EntryMetadata } from "../content-store";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("ContentStore (M1-DA-1 test-first)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("creates a new entry with correct timestamp fields", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "test-timestamps",
			metadata: { title: "Timestamps" },
			mdx: "test",
			schemaVersion: 1,
			contentHash: "hash-ts",
		});

		expect(entry.id).toBeDefined();
		expect(typeof entry.version).toBe("number");

		expect(entry.createdAt).toBeInstanceOf(Date);
		expect(entry.updatedAt).toBeInstanceOf(Date);
		expect(entry.working.updatedAt).toBeInstanceOf(Date);

		expect(entry.firstPublishedAt ?? null).toBeNull();
		expect(entry.publishedAt ?? null).toBeNull();
		expect(entry.lastPublishedAt ?? null).toBeNull();
	});

	it("allows two drafts in the same collection with slug null and manages workingSlug/publishedSlug", async () => {
		const draft1 = await store.createEntry({
			collection: "slugs",
			slug: null,
			metadata: {},
			mdx: "draft 1",
			schemaVersion: 1,
			contentHash: "hash-slug-1",
		});
		const draft2 = await store.createEntry({
			collection: "slugs",
			slug: null,
			metadata: {},
			mdx: "draft 2",
			schemaVersion: 1,
			contentHash: "hash-slug-2",
		});

		expect(draft1.id).not.toBe(draft2.id);
		expect(draft1.workingSlug ?? null).toBeNull();
		expect(draft1.publishedSlug ?? null).toBeNull();

		const saved1 = await store.saveWorking(draft1.id, {
			expectedVersion: draft1.version,
			slug: "draft-1-slug",
			metadata: {},
			mdx: "draft 1 updated",
			schemaVersion: 1,
			contentHash: "hash-slug-1-updated",
		});

		expect(saved1.workingSlug).toBe("draft-1-slug");
		expect(saved1.publishedSlug ?? null).toBeNull();

		const published = await store.publishEntry(saved1.id, { expectedVersion: saved1.version });
		expect(published.publishedSlug).toBe("draft-1-slug");

		const savedAgain = await store.saveWorking(published.id, {
			expectedVersion: published.version,
			slug: "draft-1-slug-new",
			metadata: {},
			mdx: "draft 1 updated again",
			schemaVersion: 1,
			contentHash: "hash-slug-1-updated-again",
		});

		expect(savedAgain.workingSlug).toBe("draft-1-slug-new");
		expect(savedAgain.publishedSlug).toBe("draft-1-slug");
	});

	it("timestamps: publish behavior and immutability", async () => {
		const entry = await store.createEntry({
			collection: "time",
			slug: "time-test",
			metadata: {},
			mdx: "time test",
			schemaVersion: 1,
			contentHash: "hash-time",
		});

		const initialWorkingUpdatedAt = entry.working.updatedAt?.getTime();

		await new Promise((r) => setTimeout(r, 10));

		const published = await store.publishEntry(entry.id, { expectedVersion: entry.version });

		expect(published.working.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);
		expect(published.published?.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);

		expect(published.publishedAt).toBeInstanceOf(Date);
		expect(published.firstPublishedAt).toBeInstanceOf(Date);
		expect(published.lastPublishedAt).toBeInstanceOf(Date);

		const firstPub = published.firstPublishedAt?.getTime();
		const pubAt = published.publishedAt?.getTime();

		await new Promise((r) => setTimeout(r, 10));

		const saved = await store.saveWorking(published.id, {
			expectedVersion: published.version,
			metadata: {},
			mdx: "time test updated",
			schemaVersion: 1,
			contentHash: "hash-time-2",
		});

		expect(saved.firstPublishedAt?.getTime()).toBe(firstPub);
		expect(saved.publishedAt?.getTime()).toBe(pubAt);
		expect(saved.lastPublishedAt?.getTime()).toBe(published.lastPublishedAt?.getTime());
		expect(saved.published?.updatedAt?.getTime()).toBe(initialWorkingUpdatedAt);

		expect(saved.working.updatedAt?.getTime()).toBeGreaterThan(initialWorkingUpdatedAt);
	});

	it("identical save leaves version, hash, and updatedAt unchanged", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "identical",
			metadata: { title: "Draft" },
			mdx: "draft content",
			schemaVersion: 1,
			contentHash: "hash-identical",
		});

		const saved = await store.saveWorking(entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Draft" },
			mdx: "draft content",
			schemaVersion: 1,
			contentHash: "hash-identical",
		});

		expect(saved.version).toBe(entry.version);
		expect(saved.working.contentHash).toBe(entry.working.contentHash);
		expect(saved.working.updatedAt?.getTime()).toEqual(entry.working.updatedAt?.getTime());
		expect(saved.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.version).toBe(entry.version);
		expect(reloaded.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());
		expect(reloaded.working.contentHash).toBe(entry.working.contentHash);
		expect(reloaded.working.metadata).toEqual(entry.working.metadata);
		expect(reloaded.working.mdx).toBe(entry.working.mdx);
		expect(reloaded.working.schemaVersion).toBe(entry.working.schemaVersion);
	});

	it("same-hash correctness: changed metadata/MDX/schemaVersion with reused hash is published", async () => {
		const entry = await store.createEntry({
			collection: "memo",
			slug: "republish-hash",
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash",
		});

		const firstPublish = await store.publishEntry(entry.id, { expectedVersion: entry.version });

		const secondSave = await store.saveWorking(entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Hash Test Changed" },
			mdx: "hash test changed",
			schemaVersion: 2,
			contentHash: "same-hash",
		});

		const secondPublish = await store.publishEntry(entry.id, { expectedVersion: secondSave.version });
		expect(secondPublish.published?.metadata).toEqual({ title: "Hash Test Changed" });
		expect(secondPublish.published?.mdx).toBe("hash test changed");
		expect(secondPublish.published?.schemaVersion).toBe(2);
		expect(secondPublish.published?.contentHash).toBe("same-hash");

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.published?.metadata).toEqual({ title: "Hash Test Changed" });
		expect(reloaded.published?.mdx).toBe("hash test changed");
		expect(reloaded.published?.schemaVersion).toBe(2);
		expect(reloaded.published?.contentHash).toBe("same-hash");
	});

	it("metadata JSON boundary: invalid value rejected with invalid_input", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "json-boundary",
			metadata: { title: "JSON Boundary" },
			mdx: "json",
			schemaVersion: 1,
			contentHash: "hash-json",
		});

		const badMetadata = {
			title: "Bad",
			nested: { invalid: Number.NaN },
		} as unknown as EntryMetadata;

		let caught: unknown;
		try {
			await store.saveWorking(entry.id, {
				expectedVersion: entry.version,
				metadata: badMetadata,
				mdx: "json updated",
				schemaVersion: 1,
				contentHash: "hash-json-2",
			});
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(CmsError);
		expect(caught).toMatchObject({ code: "invalid_input" });

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.version).toBe(entry.version);
		expect(reloaded.working.metadata).toEqual({ title: "JSON Boundary" });
	});

	it("true simultaneous-writer test: resolves one conflict", async () => {
		const entry = await store.createEntry({
			collection: "simul",
			slug: "simul-test",
			metadata: { title: "Simultaneous" },
			mdx: "simul",
			schemaVersion: 1,
			contentHash: "hash-simul",
		});

		const p1 = store.saveWorking(entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Win 1" },
			mdx: "win 1",
			schemaVersion: 1,
			contentHash: "hash-simul-1",
		});
		const p2 = store.saveWorking(entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Win 2" },
			mdx: "win 2",
			schemaVersion: 1,
			contentHash: "hash-simul-2",
		});

		const results = await Promise.allSettled([p1, p2]);

		const isFulfilled = (result: PromiseSettledResult<Entry>): result is PromiseFulfilledResult<Entry> =>
			result.status === "fulfilled";
		const isRejected = (result: PromiseSettledResult<Entry>): result is PromiseRejectedResult =>
			result.status === "rejected";

		const fulfilled = results.filter(isFulfilled);
		const rejected = results.filter(isRejected);

		expect(fulfilled.length).toBe(1);
		expect(rejected.length).toBe(1);

		const winner = fulfilled[0].value;
		const error = rejected[0].reason;

		expect(error).toBeInstanceOf(CmsError);
		expect(error).toMatchObject({
			code: "conflict",
			serverVersion: winner.version,
		});

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.version).toBe(winner.version);
		expect(reloaded.working.contentHash).toBe(winner.working.contentHash);
	});

	it("stale expectedVersion throws CmsError with code conflict and serverVersion", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "stale-test",
			metadata: { title: "Initial" },
			mdx: "initial",
			schemaVersion: 1,
			contentHash: "hash-1",
		});

		const updated = await store.saveWorking(entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Update 1" },
			mdx: "update 1",
			schemaVersion: 1,
			contentHash: "hash-2",
		});

		const stalePromise = store.saveWorking(entry.id, {
			expectedVersion: entry.version,
			metadata: { title: "Update 2" },
			mdx: "update 2",
			schemaVersion: 1,
			contentHash: "hash-3",
		});

		expect(typeof updated.version).toBe("number");

		let caughtError: unknown;
		try {
			await stalePromise;
		} catch (error) {
			caughtError = error;
		}

		expect(caughtError).toBeInstanceOf(CmsError);
		expect(caughtError).toMatchObject({
			code: "conflict",
			serverVersion: updated.version,
		});
	});

	it("keeps working and published snapshots separate", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "separation-test",
			metadata: { title: "Initial Draft" },
			mdx: "initial draft",
			schemaVersion: 1,
			contentHash: "hash-draft",
		});

		const published = await store.publishEntry(entry.id, { expectedVersion: entry.version });
		expect(published.lastPublishedAt).toBeDefined();

		await store.saveWorking(entry.id, {
			expectedVersion: published.version,
			metadata: { title: "Updated Draft" },
			mdx: "updated draft",
			schemaVersion: 2,
			contentHash: "hash-updated",
		});

		const reloaded = await store.getEntry(entry.id);

		expect(reloaded.working.metadata).toEqual({ title: "Updated Draft" });
		expect(reloaded.working.mdx).toBe("updated draft");
		expect(reloaded.working.contentHash).toBe("hash-updated");
		expect(reloaded.working.schemaVersion).toBe(2);

		expect(reloaded.published).toEqual(published.published);
		expect(reloaded.lastPublishedAt?.getTime()).toEqual(published.lastPublishedAt?.getTime());
	});

	it("republishing the same content hash does not replace the published snapshot", async () => {
		const entry = await store.createEntry({
			collection: "memo",
			slug: "republish-hash-identical",
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash-ident",
		});

		const firstPublish = await store.publishEntry(entry.id, { expectedVersion: entry.version });

		const secondSave = await store.saveWorking(entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash-ident",
		});

		await store.publishEntry(entry.id, { expectedVersion: secondSave.version });

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.published).toEqual(firstPublish.published);
		expect(reloaded.lastPublishedAt?.getTime()).toEqual(firstPublish.lastPublishedAt?.getTime());
	});

	it("a transaction failure during publish leaves the prior published snapshot intact", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "rollback-test",
			metadata: { title: "First Publish" },
			mdx: "first publish",
			schemaVersion: 1,
			contentHash: "hash-rollback-1",
		});

		const firstPublish = await store.publishEntry(entry.id, { expectedVersion: entry.version });

		const update = await store.saveWorking(entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Second Publish" },
			mdx: "second publish",
			schemaVersion: 1,
			contentHash: "hash-rollback-2",
		});

		const capturedState = await store.getEntry(entry.id);

		let hookReached = false;
		const failingStore = createContentStore(pool, {
			schema: schemaName,
			beforePublishCommit: async () => {
				hookReached = true;
				throw new Error("Simulated publish failure");
			},
		});

		await expect(failingStore.publishEntry(entry.id, { expectedVersion: update.version })).rejects.toThrow();

		expect(hookReached).toBe(true);

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded).toEqual(capturedState);
	});

	it("published entry can explicitly clear its working slug and old public slug remains reserved", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "clear-slug-test",
			metadata: {},
			mdx: "test",
			schemaVersion: 1,
			contentHash: "hash-c1",
		});

		const published = await store.publishEntry(entry.id, { expectedVersion: entry.version });

		const saved = await store.saveWorking(entry.id, {
			expectedVersion: published.version,
			slug: null,
			metadata: {},
			mdx: "test null",
			schemaVersion: 1,
			contentHash: "hash-c2",
		});

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.workingSlug ?? null).toBeNull();
		expect(reloaded.publishedSlug).toBe("clear-slug-test");

		const publishedNull = await store.publishEntry(entry.id, { expectedVersion: saved.version });
		expect(publishedNull.publishedSlug ?? null).toBeNull();

		await expect(
			store.createEntry({
				collection: "post",
				slug: "clear-slug-test",
				metadata: {},
				mdx: "collision",
				schemaVersion: 1,
				contentHash: "hash-c3",
			}),
		).rejects.toThrow();
	});

	it("metadata accepts valid own JSON keys named constructor and __proto__", async () => {
		const metadata = JSON.parse('{"constructor":"val1","__proto__":"val2"}');

		const entry = await store.createEntry({
			collection: "post",
			slug: "proto-test",
			metadata,
			mdx: "test",
			schemaVersion: 1,
			contentHash: "hash-proto",
		});

		const reloaded = await store.getEntry(entry.id);

		expect(Object.hasOwn(reloaded.working.metadata, "constructor")).toBe(true);
		expect(Object.hasOwn(reloaded.working.metadata, "__proto__")).toBe(true);

		expect(Object.getOwnPropertyDescriptor(reloaded.working.metadata, "constructor")?.value).toBe("val1");
		expect(Object.getOwnPropertyDescriptor(reloaded.working.metadata, "__proto__")?.value).toBe("val2");
	});
});
