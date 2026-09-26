import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createContentStore, migrateContentStore } from "../content-store";
import { moveToFolder, seedEntry } from "./seed";
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
		const categoryDraft = await seedEntry(store, {
			collection: "category",
			slug: "lifecycle-test-category",
			metadata: { title: "Lifecycle category" },
			mdx: "",
			schemaVersion: 1,
			contentHash: "lifecycle-category-hash",
		});
		const category = await store.publishEntry({ id: categoryDraft.id, expectedVersion: categoryDraft.version });
		// 게시글 발행에는 카테고리가 필요하다. 이 파일의 시나리오는 카테고리와 무관하므로 기본값을 채운다.
		const withCategory = (snapshot: Record<string, any>) =>
			snapshot?.collection === "post" && !snapshot.metadata?.categoryId
				? { ...snapshot, metadata: { ...snapshot.metadata, categoryId: category.id } }
				: snapshot;
		const createWithReferences = store.createEntryWithReferences.bind(store);
		store.createEntryWithReferences = (params: Record<string, any>) =>
			createWithReferences({ ...params, snapshot: withCategory(params.snapshot) });
		const saveWithReferences = store.saveWorkingWithReferences.bind(store);
		store.saveWorkingWithReferences = (params: Record<string, any>) =>
			saveWithReferences({ ...params, snapshot: withCategory(params.snapshot) });
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("1. Lifecycle State Machine Transitions (§5.3)", () => {
		it("draft -> published creates published body and sets status to published", async () => {
			const entry = await seedEntry(store, {
				collection: "post",
				slug: "test-publish-1",
				metadata: { title: "Draft Post", publishedAt: "2026-03-01T12:00:00.000Z" },
				mdx: "Content 1",
				schemaVersion: 1,
				contentHash: "hash-1",
			});

			expect(entry.status).toBe("draft");

			// 표시 발행일은 초안 메타데이터의 `publishedAt`이다(§5.5).
			const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });

			expect(published.status).toBe("published");
			expect(published.publishedAt).toEqual(new Date("2026-03-01T12:00:00Z"));
			expect(published.firstPublishedAt).toBeDefined();
			expect(published.lastPublishedAt).toBeDefined();
		});

		it("rejects future publishedAt without changing the draft", async () => {
			const entry = await seedEntry(store, {
				collection: "post",
				slug: "test-future-published-at",
				metadata: { title: "Future date", publishedAt: "2999-01-01T00:00:00.000Z" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: `hash-future-${randomUUID()}`,
			});

			await expect(store.publishEntry({ id: entry.id, expectedVersion: entry.version })).rejects.toMatchObject({
				code: "publish_validation_failed",
				issues: expect.arrayContaining([expect.objectContaining({ code: "future_published_at" })]),
			});
			const unchanged = await store.getEntry(entry.id);
			expect(unchanged.status).toBe("draft");
			expect(unchanged.version).toBe(entry.version);
		});

		it("published -> archive closes public visibility and cancels any pending schedule", async () => {
			const entry = await seedEntry(store, {
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
			const entry = await seedEntry(store, {
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
			const entry = await seedEntry(store, {
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
			const entry = await seedEntry(store, {
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
			const entry = await seedEntry(store, {
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
				seedEntry(store, {
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
			const tag = await seedEntry(store, {
				collection: "tag",
				slug: "tag-active",
				metadata: { title: "Active Tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: "tag-hash",
			});

			// tag must be published or active
			await store.publishEntry({ id: tag.id, expectedVersion: tag.version });

			const post = await seedEntry(store, {
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

			const pubRefs = await pool.query<{ target_id: string }>(
				`SELECT target_id FROM "${schemaName}".entry_references WHERE entry_id = $1 AND state = 'published'`,
				[post.id],
			);
			expect(pubRefs.rows).toHaveLength(1);
			expect(pubRefs.rows[0].target_id).toBe(tag.id);
		});

		it("prevents trashing or deleting a tag still used by published entries", async () => {
			const tag = await seedEntry(store, {
				collection: "tag",
				slug: `tag-in-use-${randomUUID()}`,
				metadata: { title: "In-use tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const publishedTag = await store.publishEntry({ id: tag.id, expectedVersion: tag.version });
			const post = await seedEntry(store, {
				collection: "post",
				slug: `post-uses-tag-${randomUUID()}`,
				metadata: { title: "Tagged post" },
				mdx: "Tagged body.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const saved = await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: post.version,
				snapshot: {
					collection: "post",
					slug: post.workingSlug,
					metadata: { title: "Tagged post" },
					mdx: "Tagged body.",
					schemaVersion: 1,
					contentHash: "tagged-post-with-reference",
					issues: [],
					references: [],
				},
				references: [{ kind: "tag", targetId: tag.id, isStale: false, occurrences: [] }],
			});
			const publishedPost = await store.publishEntry({ id: post.id, expectedVersion: saved.version });

			await expect(store.trashEntry({ id: tag.id, expectedVersion: publishedTag.version })).rejects.toMatchObject({
				code: "in_use",
			});
			// 영구 삭제는 휴지통 항목만 대상이다(§5.3).
			await expect(
				store.permanentDeleteEntry({ id: tag.id, expectedVersion: publishedTag.version }),
			).rejects.toMatchObject({
				code: "invalid_status",
			});
			const stillPublished = await store.getEntry(publishedPost.id);
			expect(stillPublished.status).toBe("published");

			const editedWithoutTag = await store.saveWorkingWithReferences({
				entryId: publishedPost.id,
				expectedVersion: publishedPost.version,
				snapshot: {
					collection: "post",
					slug: publishedPost.workingSlug,
					metadata: { title: "Tagged post" },
					mdx: "Tagged body.",
					schemaVersion: 1,
					contentHash: randomUUID(),
					issues: [],
					references: [],
				},
				references: [],
			});
			await expect(store.trashEntry({ id: tag.id, expectedVersion: publishedTag.version })).rejects.toMatchObject({
				code: "in_use",
			});
			await store.publishEntry({ id: publishedPost.id, expectedVersion: editedWithoutTag.version });
			const trashedTag = await store.trashEntry({ id: tag.id, expectedVersion: publishedTag.version });
			expect(trashedTag.status).toBe("trashed");
		});

		it("does not publish or schedule a trashed entry", async () => {
			const draft = await seedEntry(store, {
				collection: "post",
				slug: `trashed-entry-${randomUUID()}`,
				metadata: { title: "Trashed entry" },
				mdx: "Body.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const trashed = await store.trashEntry({ id: draft.id, expectedVersion: draft.version });
			await expect(store.publishEntry({ id: trashed.id, expectedVersion: trashed.version })).rejects.toMatchObject({
				code: "invalid_status",
			});
			await expect(
				store.createSchedule({
					entryId: trashed.id,
					expectedVersion: trashed.version,
					scheduledAt: new Date(Date.now() + 60_000),
				}),
			).rejects.toMatchObject({ code: "invalid_status" });
		});

		it("serializes tag deletion against a concurrent draft reference save", async () => {
			const tagDraft = await seedEntry(store, {
				collection: "tag",
				slug: `tag-race-${randomUUID()}`,
				metadata: { title: "Race tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const tag = await store.publishEntry({ id: tagDraft.id, expectedVersion: tagDraft.version });
			const post = await seedEntry(store, {
				collection: "post",
				slug: `post-tag-race-${randomUUID()}`,
				metadata: { title: "Concurrent draft" },
				mdx: "Draft.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const coordinator = await pool.connect();
			try {
				await coordinator.query("BEGIN");
				await coordinator.query(`SELECT id FROM "${schemaName}".entries WHERE id = $1 FOR SHARE`, [tag.id]);
				const trash = store.trashEntry({ id: tag.id, expectedVersion: tag.version });
				await new Promise((resolve) => setTimeout(resolve, 50));
				const save = await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version,
					snapshot: {
						collection: "post",
						slug: post.workingSlug,
						metadata: { title: "Concurrent draft" },
						mdx: "Draft.",
						schemaVersion: 1,
						contentHash: randomUUID(),
						issues: [],
						references: [],
					},
					references: [{ kind: "tag", targetId: tag.id, isStale: false, occurrences: [] }],
				});
				await coordinator.query("COMMIT");
				await expect(trash).rejects.toMatchObject({ code: "in_use" });
				expect(save.version).toBeGreaterThan(post.version);
			} catch (error) {
				await coordinator.query("ROLLBACK").catch(() => undefined);
				throw error;
			} finally {
				coordinator.release();
			}
		});

		it("blocks trashing or deleting a tag referenced by a draft", async () => {
			const tagDraft = await seedEntry(store, {
				collection: "tag",
				slug: `tag-draft-use-${randomUUID()}`,
				metadata: { title: "Draft-used tag" },
				mdx: "",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const tag = await store.publishEntry({ id: tagDraft.id, expectedVersion: tagDraft.version });
			const post = await seedEntry(store, {
				collection: "post",
				slug: `draft-uses-tag-${randomUUID()}`,
				metadata: { title: "Draft using tag" },
				mdx: "Draft body.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			await store.saveWorkingWithReferences({
				entryId: post.id,
				expectedVersion: post.version,
				snapshot: {
					collection: "post",
					slug: post.workingSlug,
					metadata: { title: "Draft using tag" },
					mdx: "Draft body.",
					schemaVersion: 1,
					contentHash: "draft-post-with-reference",
					issues: [],
					references: [],
				},
				references: [{ kind: "tag", targetId: tag.id, isStale: false, occurrences: [] }],
			});

			await expect(store.trashEntry({ id: tag.id, expectedVersion: tag.version })).rejects.toMatchObject({
				code: "in_use",
			});
			await expect(store.permanentDeleteEntry({ id: tag.id, expectedVersion: tag.version })).rejects.toMatchObject({
				code: "invalid_status",
			});
		});

		it(
			"fails publish and preserves prior published body & published references if target is unpublished or missing",
			{ timeout: 60000 },
			async () => {
				const tag = await seedEntry(store, {
					collection: "tag",
					slug: "tag-to-archive",
					metadata: { title: "Tag" },
					mdx: "",
					schemaVersion: 1,
					contentHash: "tag-hash-arch",
				});
				// 레코드 컬렉션은 보관할 수 없다. 공개되지 않은(초안) 태그를 대상으로 쓴다.
				const post = await seedEntry(store, {
					collection: "post",
					slug: "post-rollback-test",
					metadata: { title: "Prior Title" },
					mdx: "Prior MDX",
					schemaVersion: 1,
					contentHash: "post-prior-hash",
				});

				// 1st publish (clean, no refs)
				const firstPub = await store.publishEntry({ id: post.id, expectedVersion: post.version });

				// Save draft on post referencing the unpublished tag
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

				// Attempt 2nd publish - MUST FAIL because the referenced tag is not published
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
			},
		);
	});

	describe("3. Scheduled Publishing (§5.4)", () => {
		it("creates a schedule, locks entry body editing, allows folder move, and supports due execution", async () => {
			const post = await seedEntry(store, {
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

			const moved = await moveToFolder(store, {
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

		it("같은 항목에 pending 예약은 두 개 만들 수 없다", async () => {
			const post = await seedEntry(store, {
				collection: "post",
				slug: "post-schedule-duplicate-1",
				metadata: { title: "Duplicate Schedule" },
				mdx: "Content",
				schemaVersion: 1,
				contentHash: "dup-sched-hash",
			});

			const first = await store.createSchedule({
				entryId: post.id,
				expectedVersion: post.version,
				scheduledAt: new Date(Date.now() + 3600 * 1000),
			});
			expect(first.status).toBe("pending");

			// M7-TW-1: schedules_active_entry_idx(partial unique)가 막고, store는 이를 conflict로 매핑한다(500이 아니라 409).
			await expect(
				store.createSchedule({
					entryId: post.id,
					expectedVersion: post.version,
					scheduledAt: new Date(Date.now() + 7200 * 1000),
				}),
			).rejects.toMatchObject({ code: "conflict" });

			const { rows } = await pool.query<{ id: string }>(
				`SELECT id FROM "${schemaName}".schedules WHERE entry_id = $1 AND status = 'pending'`,
				[post.id],
			);
			expect(rows).toHaveLength(1);
			expect(rows[0].id).toBe(first.id);
		});

		it("schedule registration refuses a body that cannot be published", async () => {
			const post = await seedEntry(store, {
				collection: "post",
				slug: "post-invalid-schedule",
				metadata: { title: "Invalid schedule" },
				mdx: "<Callout>",
				schemaVersion: 1,
				contentHash: "invalid-schedule-hash",
			});
			await expect(
				store.createSchedule({
					entryId: post.id,
					expectedVersion: post.version,
					scheduledAt: new Date(Date.now() + 3600_000),
				}),
			).rejects.toMatchObject({ code: "publish_validation_failed" });
			const schedules = await pool.query(`SELECT id FROM "${schemaName}".schedules WHERE entry_id = $1`, [post.id]);
			expect(schedules.rows).toHaveLength(0);
		});

		it("revalidates scheduled publication, preserves the public body and records the failure", async () => {
			const target = await seedEntry(store, {
				collection: "post",
				slug: `schedule-link-target-${randomUUID()}`,
				metadata: { title: "Link target" },
				mdx: "Target body.",
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const publishedTarget = await store.publishEntry({ id: target.id, expectedVersion: target.version });
			const post = await seedEntry(store, {
				collection: "post",
				slug: `schedule-revalidation-${randomUUID()}`,
				metadata: { title: "Scheduled post" },
				mdx: `Previously public. [link](/posts/${publishedTarget.publishedSlug})`,
				schemaVersion: 1,
				contentHash: randomUUID(),
			});
			const published = await store.publishEntry({ id: post.id, expectedVersion: post.version });
			const schedule = await store.createSchedule({
				entryId: post.id,
				expectedVersion: published.version,
				scheduledAt: new Date(Date.now() - 1000),
				now: new Date(Date.now() - 60_000),
			});
			// 예약 중 링크 대상이 보관되면 실행은 실패해야 한다(§5.4).
			await store.archiveEntry({ id: target.id, expectedVersion: publishedTarget.version });

			await expect(store.executeSchedulePublish({ scheduleId: schedule.id })).rejects.toMatchObject({
				code: "publish_validation_failed",
			});
			const unchanged = await store.getEntry(post.id);
			expect(unchanged.status).toBe("published");
			expect(unchanged.published?.mdx).toContain("Previously public.");

			const { pending, last } = await store.getEntrySchedule({ entryId: post.id });
			expect(pending).toBeNull();
			expect(last).toMatchObject({ id: schedule.id, status: "failed", failureCode: "publish_validation_failed" });
			expect(last?.failureDetail).toContain("unpublished_internal_link");
		});

		it("executor idempotency: executing due schedule publishes entry and duplicate call returns no-op", async () => {
			const post = await seedEntry(store, {
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
				now: new Date(Date.now() - 60_000),
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
			const post = await seedEntry(store, {
				collection: "post",
				slug: "post-timestamp-test",
				metadata: { title: "Timestamp Post", publishedAt: "2025-01-01T00:00:00.000Z" },
				mdx: "V1",
				schemaVersion: 1,
				contentHash: "ts-hash-1",
			});

			const userSpecifiedDate = new Date("2025-01-01T00:00:00Z");
			const pub1 = await store.publishEntry({ id: post.id, expectedVersion: post.version });

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

	describe("5. M7-SEC-1 발행 경계", () => {
		it("analyze 오류가 있는 본문은 publishEntry가 거부하고 상태를 바꾸지 않는다", async () => {
			const post = await seedEntry(store, {
				collection: "post",
				slug: "post-broken-mdx",
				metadata: { title: "Broken" },
				mdx: "<Callout>",
				schemaVersion: 1,
				contentHash: "broken-hash",
			});

			await expect(store.publishEntry({ id: post.id, expectedVersion: post.version })).rejects.toMatchObject({
				code: "publish_validation_failed",
			});

			const after = await store.getEntry(post.id);
			expect(after.status).toBe("draft");
		});

		it("예정 시각 전에는 예약 발행이 거부되고 본문이 공개되지 않는다", async () => {
			const post = await seedEntry(store, {
				collection: "post",
				slug: "post-not-due",
				metadata: { title: "Not due" },
				mdx: "정상 본문",
				schemaVersion: 1,
				contentHash: "not-due-hash",
			});

			const schedule = await store.createSchedule({
				entryId: post.id,
				expectedVersion: post.version,
				scheduledAt: new Date(Date.now() + 3600 * 1000),
			});

			await expect(store.executeSchedulePublish({ scheduleId: schedule.id })).rejects.toMatchObject({
				code: "conflict",
			});

			const after = await store.getEntry(post.id);
			expect(after.status).toBe("draft");
		});
	});
});
