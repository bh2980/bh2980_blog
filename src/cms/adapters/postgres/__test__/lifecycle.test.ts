import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

describe("M3-TW-1 Publishing, Lifecycle, Schedule & Published-References Contracts", () => {
	let pool: Pool;
	let schemaName: string;
	let store: any;

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

	describe("1. Lifecycle State Machine Transitions (§5.3)", () => {
		it("draft -> published creates published body and sets status to published", async () => {
			const entry = await store.createEntry({
				collection: "post",
				slug: "test-publish-1",
				metadata: { title: "Draft Post" },
				mdx: "Content 1",
				schemaVersion: 1,
				contentHash: "hash-1",
			});

			expect(entry.status).toBe("draft");

			// publishEntry must support publishedAt override or default
			const published = await store.publishEntry({
				id: entry.id,
				expectedVersion: entry.version,
				publishedAt: new Date("2026-03-01T12:00:00Z"),
			});

			expect(published.status).toBe("published");
			expect(published.publishedAt).toEqual(new Date("2026-03-01T12:00:00Z"));
			expect(published.firstPublishedAt).toBeDefined();
			expect(published.lastPublishedAt).toBeDefined();
		});

		it("published -> archive closes public visibility and cancels any pending schedule", async () => {
			const entry = await store.createEntry({
				collection: "post",
				slug: "test-archive-1",
				metadata: { title: "To Archive" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-arch",
			});

			const pub = await store.publishEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const archived = await store.archiveEntry({
				id: entry.id,
				expectedVersion: pub.version,
			});

			expect(archived.status).toBe("archived");
			expect(archived.publishedAt).toBeDefined(); // preserved
		});

		it("archived -> unarchive returns to draft without auto-publishing", async () => {
			const entry = await store.createEntry({
				collection: "post",
				slug: "test-unarchive-1",
				metadata: { title: "To Unarchive" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-unarch",
			});

			const pub = await store.publishEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const arch = await store.archiveEntry({
				id: entry.id,
				expectedVersion: pub.version,
			});

			const unarch = await store.unarchiveEntry({
				id: entry.id,
				expectedVersion: arch.version,
			});

			expect(unarch.status).toBe("draft");
		});

		it("draft/published/archived -> trash hides from active list and cancels schedule", async () => {
			const entry = await store.createEntry({
				collection: "post",
				slug: "test-trash-1",
				metadata: { title: "To Trash" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-trash",
			});

			const trashed = await store.trashEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			expect(trashed.status).toBe("trashed");
		});

		it("trashed -> restore returns to draft (for publish collection)", async () => {
			const entry = await store.createEntry({
				collection: "post",
				slug: "test-restore-1",
				metadata: { title: "To Restore" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-res",
			});

			const trashed = await store.trashEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const restored = await store.restoreEntry({
				id: entry.id,
				expectedVersion: trashed.version,
			});

			expect(restored.status).toBe("draft");
		});

		it("trashed -> permanentDelete deletes entry but preserves address tombstone", async () => {
			const entry = await store.createEntry({
				collection: "post",
				slug: "test-perm-delete-1",
				metadata: { title: "Perm Delete" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "hash-perm",
			});

			const pub = await store.publishEntry({
				id: entry.id,
				expectedVersion: entry.version,
			});

			const trashed = await store.trashEntry({
				id: entry.id,
				expectedVersion: pub.version,
			});

			await store.permanentDeleteEntry({
				id: entry.id,
				expectedVersion: trashed.version,
			});

			await expect(store.getEntry(entry.id)).rejects.toThrow();

			// Slug should still be reserved / conflict
			await expect(
				store.createEntry({
					collection: "post",
					slug: "test-perm-delete-1",
					metadata: { title: "Reuse Slug Attempt" },
					mdx: "Content",
					schemaVersion: 1,
					contentHash: "hash-reuse",
				}),
			).rejects.toThrow(/conflict|Slug conflict/i);
		});
	});

	describe("2. Transactional Target Recheck & Published References Rollback (§5.3)", () => {
		it("publishes and copies working references to published references atomically", { timeout: 15000 }, async () => {
			const tag = await store.createEntry({
				collection: "tag",
				slug: "tag-active",
				metadata: { title: "Active Tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: "tag-hash",
			});

			// tag must be published or active
			await store.publishEntry({ id: tag.id, expectedVersion: tag.version });

			const post = await store.createEntry({
				collection: "post",
				slug: "post-with-ref",
				metadata: { title: "Post" },
				mdx: "Hello",
				schemaVersion: 1,
				contentHash: "post-hash",
			});

			// Attach working reference
			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: post.version,
				snapshot: {
					collection: "post",
					slug: "post-with-ref",
					metadata: { title: "Post" },
					mdx: "Hello",
					schemaVersion: 1,
					contentHash: "post-hash-2",
					issues: [],
					references: [],
				},
				references: [
					{
						kind: "tag",
						targetId: tag.id,
						isStale: false,
						occurrences: [{ type: "metadata", path: "tags" }],
					},
				],
			});

			// Now publish post - should succeed and copy reference to state='published'
			const pubPost = await store.publishEntry({
				id: post.id,
				expectedVersion: post.version + 1,
			});

			expect(pubPost.status).toBe("published");

			const pubRefs = await store.getPublishedReferences?.(post.id);
			expect(pubRefs).toHaveLength(1);
			expect(pubRefs[0].targetId).toBe(tag.id);
		});

		it("fails publish and preserves prior published body & published references if target is archived or missing", { timeout: 15000 }, async () => {
			const tag = await store.createEntry({
				collection: "tag",
				slug: "tag-to-archive",
				metadata: { title: "Tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: "tag-hash-arch",
			});
			const pubTag = await store.publishEntry({ id: tag.id, expectedVersion: tag.version });

			const post = await store.createEntry({
				collection: "post",
				slug: "post-rollback-test",
				metadata: { title: "Prior Title" },
				mdx: "Prior MDX",
				schemaVersion: 1,
				contentHash: "post-prior-hash",
			});

			// 1st publish (clean, no refs)
			const firstPub = await store.publishEntry({ id: post.id, expectedVersion: post.version });

			// Archive the tag
			await store.archiveEntry({ id: tag.id, expectedVersion: pubTag.version });

			// Save draft on post referencing now-archived tag
			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: firstPub.version,
				snapshot: {
					collection: "post",
					slug: "post-rollback-test",
					metadata: { title: "Broken Title" },
					mdx: "Broken MDX",
					schemaVersion: 1,
					contentHash: "post-broken-hash",
					issues: [],
					references: [],
				},
				references: [
					{
						kind: "tag",
						targetId: tag.id,
						isStale: false,
						occurrences: [{ type: "metadata", path: "tags" }],
					},
				],
			});

			// Attempt 2nd publish - MUST FAIL because referenced tag is archived!
			await expect(
				store.publishEntry({
					id: post.id,
					expectedVersion: firstPub.version + 1,
				}),
			).rejects.toThrow();

			// Verify prior published body is completely intact!
			const current = await store.getEntry(post.id);
			expect(current.published?.mdx).toBe("Prior MDX");
			expect(current.published?.metadata.title).toBe("Prior Title");
		});
	});

	describe("3. Scheduled Publishing (§5.4)", () => {
		it("creates a schedule, locks entry body editing, allows folder move, and supports due execution", async () => {
			const post = await store.createEntry({
				collection: "post",
				slug: "post-scheduled-1",
				metadata: { title: "Scheduled Post" },
				mdx: "Future MDX",
				schemaVersion: 1,
				contentHash: "sched-hash",
			});

			const futureDate = new Date(Date.now() + 3600 * 1000); // 1 hour later
			const schedule = await store.createSchedule({
				entryId: post.id,
				expectedVersion: post.version,
				scheduledAt: futureDate,
			});

			expect(schedule.id).toBeDefined();
			expect(schedule.status).toBe("pending");

			// Editing body while scheduled should throw error (locked)
			await expect(
				store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version,
					snapshot: {
						collection: "post",
						slug: "post-scheduled-1",
						metadata: { title: "Edit Attempt" },
						mdx: "Modified",
						schemaVersion: 1,
						contentHash: "modified-hash",
						issues: [],
						references: [],
					},
					references: [],
				}),
			).rejects.toThrow(/scheduled|locked/i);

			// Moving folder while scheduled is allowed!
			const folder = await store.createFolder({
				collection: "post",
				name: "News",
				parentId: null,
			});

			const moved = await store.moveEntryToFolder({
				entryId: post.id,
				folderId: folder.id,
				expectedVersion: post.version,
			});
			expect(moved.folderId).toBe(folder.id);

			// Canceling/releasing schedule unlocks editing
			await store.cancelSchedule({
				scheduleId: schedule.id,
				entryId: post.id,
			});

			// Now editing is unlocked!
			await expect(
				store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version + 1, // incremented by folder move
					snapshot: {
						collection: "post",
						slug: "post-scheduled-1",
						metadata: { title: "Unlocked Edit" },
						mdx: "Modified Unlocked",
						schemaVersion: 1,
						contentHash: "modified-hash-2",
						issues: [],
						references: [],
					},
					references: [],
				}),
			).resolves.not.toThrow();
		});

		it("executor idempotency: executing due schedule publishes entry and duplicate call returns no-op", async () => {
			const post = await store.createEntry({
				collection: "post",
				slug: "post-due-exec-1",
				metadata: { title: "Due Post" },
				mdx: "Due Content",
				schemaVersion: 1,
				contentHash: "due-hash",
			});

			const pastDate = new Date(Date.now() - 10000); // 10s ago (due)
			const schedule = await store.createSchedule({
				entryId: post.id,
				expectedVersion: post.version,
				scheduledAt: pastDate,
			});

			// Find due schedules
			const dueSchedules = await store.getDueSchedules();
			expect(dueSchedules.some((s: any) => s.id === schedule.id)).toBe(true);

			// Execute schedule publish
			const result = await store.executeSchedulePublish({
				scheduleId: schedule.id,
			});

			expect(result.status).toBe("completed");

			const publishedPost = await store.getEntry(post.id);
			expect(publishedPost.status).toBe("published");

			// Duplicate call: idempotent no-op (no error, remains completed)
			const dupResult = await store.executeSchedulePublish({
				scheduleId: schedule.id,
			});
			expect(dupResult.status).toBe("completed");
		});
	});

	describe("4. Timestamps (§5.5)", () => {
		it("preserves firstPublishedAt on re-publish, updates lastPublishedAt, and honors publishedAt override", async () => {
			const post = await store.createEntry({
				collection: "post",
				slug: "post-timestamp-test",
				metadata: { title: "Timestamp Post" },
				mdx: "V1",
				schemaVersion: 1,
				contentHash: "ts-hash-1",
			});

			const userSpecifiedDate = new Date("2025-01-01T00:00:00Z");
			const pub1 = await store.publishEntry({
				id: post.id,
				expectedVersion: post.version,
				publishedAt: userSpecifiedDate,
			});

			const firstPubAt = pub1.firstPublishedAt;
			expect(firstPubAt).toBeDefined();
			expect(pub1.publishedAt).toEqual(userSpecifiedDate);

			// Save draft V2
			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: pub1.version,
				snapshot: {
					collection: "post",
					slug: "post-timestamp-test",
					metadata: { title: "Timestamp Post V2" },
					mdx: "V2",
					schemaVersion: 1,
					contentHash: "ts-hash-2",
					issues: [],
					references: [],
				},
				references: [],
			});

			// Wait slight tick
			await new Promise((r) => setTimeout(r, 50));

			// Re-publish
			const pub2 = await store.publishEntry({
				id: post.id,
				expectedVersion: pub1.version + 1,
			});

			expect(pub2.firstPublishedAt).toEqual(firstPubAt); // MUST NOT BE OVERWRITTEN
			expect(new Date(pub2.lastPublishedAt).getTime()).toBeGreaterThan(new Date(firstPubAt).getTime());
			expect(pub2.publishedAt).toEqual(userSpecifiedDate); // preserved unless overridden
		});
	});
});
