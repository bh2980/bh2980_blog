import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("ContentStore (M1-TW-2)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool);
		store = createContentStore(pool);
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("creates a new entry with correct fields", async () => {
		const entry = await store.createEntry({
			collection: "post",
			slug: "test-entry",
			metadata: { title: "Test Entry" },
			mdx: "test",
			schemaVersion: 1,
			contentHash: "hash-1",
		});

		expect(entry.id).toBeDefined();
		expect(typeof entry.version).toBe("number");
		expect(entry.updatedAt).toBeInstanceOf(Date);
		expect(entry.lastPublishedAt).toBeUndefined();
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
		expect(saved.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());

		const reloaded = await store.getEntry(entry.id);
		expect(reloaded.version).toBe(entry.version);
		expect(reloaded.updatedAt.getTime()).toEqual(entry.updatedAt.getTime());
		expect(reloaded.working.contentHash).toBe(entry.working.contentHash);
		expect(reloaded.working.metadata).toEqual(entry.working.metadata);
		expect(reloaded.working.mdx).toBe(entry.working.mdx);
		expect(reloaded.working.schemaVersion).toBe(entry.working.schemaVersion);
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
		expect(typeof (caughtError as { serverVersion?: unknown }).serverVersion).toBe("number");
		expect((caughtError as { serverVersion?: unknown }).serverVersion).toBe(updated.version);
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
			slug: "republish-hash",
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash",
		});

		const firstPublish = await store.publishEntry(entry.id, { expectedVersion: entry.version });

		const secondSave = await store.saveWorking(entry.id, {
			expectedVersion: firstPublish.version,
			metadata: { title: "Hash Test" },
			mdx: "hash test",
			schemaVersion: 1,
			contentHash: "same-hash",
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
});
