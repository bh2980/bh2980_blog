import { randomUUID } from "node:crypto";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	moveToFolder,
	seedEntry,
} from "@bh2980/cms/testing";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createScheduleStore, migrateSchedules, scheduleEntryHooks } from "../store";

type Store = ReturnType<typeof createContentStore>;

/** 예약 저장소와 본체 저장소(예약 갈고리를 단)를 실제 PostgreSQL 격리 스키마로 돈다. */
describe("발행 예약 저장소(§5.4)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: Store;
	let schedules: ReturnType<typeof createScheduleStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		await migrateSchedules({ pool, schema: schemaName });
		// 두 번 불러도 같다.
		await migrateSchedules({ pool, schema: schemaName });
		store = createContentStore(pool, {
			schema: schemaName,
			entryHooks: async () => [{ name: "schedule", ...scheduleEntryHooks }],
		});
		schedules = createScheduleStore({ pool, schema: schemaName }, store);

		const categoryDraft = await seedEntry(store, {
			collection: "category",
			slug: "schedule-test-category",
			metadata: { title: "Schedule category" },
			mdx: "",
			schemaVersion: 1,
			contentHash: "schedule-category-hash",
		});
		const category = await store.publishEntry({ id: categoryDraft.id, expectedVersion: categoryDraft.version });
		// 게시글 발행에는 카테고리가 필요하다. 예약과 무관하므로 기본값을 채운다.
		const withCategory = <T extends { snapshot: { collection: string; metadata: Record<string, unknown> } }>(
			params: T,
		): T =>
			params.snapshot.collection === "post" && !params.snapshot.metadata.categoryId
				? {
						...params,
						snapshot: { ...params.snapshot, metadata: { ...params.snapshot.metadata, categoryId: category.id } },
					}
				: params;
		const create = store.createEntryWithReferences.bind(store);
		store.createEntryWithReferences = (params) => create(withCategory(params as never));
		const save = store.saveWorkingWithReferences.bind(store);
		store.saveWorkingWithReferences = (params) => save(withCategory(params as never));
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const post = (slug: string, mdx = "본문") =>
		seedEntry(store, {
			collection: "post",
			slug,
			metadata: { title: slug },
			mdx,
			schemaVersion: 1,
			contentHash: `hash-${slug}`,
		});
	const snapshot = (slug: string, mdx: string) =>
		({
			collection: "post",
			slug,
			metadata: { title: slug },
			mdx,
			schemaVersion: 1,
			contentHash: `hash-${slug}-${mdx}`,
			issues: [],
			references: [],
			imageSources: [],
		}) as never;
	const inAnHour = () => new Date(Date.now() + 3600_000);

	it("예약하면 본문 편집이 잠기고(폴더 이동은 된다) 해제하면 풀린다", async () => {
		const entry = await post("scheduled-1");
		const created = await schedules.createSchedule({
			entryId: entry.id,
			expectedVersion: entry.version,
			scheduledAt: inAnHour(),
		});
		expect(created.status).toBe("pending");
		expect(await store.lockedBy({ entryId: entry.id })).toBe("schedule");

		await expect(
			store.saveWorkingWithReferences({
				entryId: entry.id,
				expectedVersion: entry.version,
				snapshot: snapshot("scheduled-1", "바뀐 본문"),
				references: [],
			}),
		).rejects.toMatchObject({ code: "locked" });

		const folder = await store.createFolder({ collection: "post", name: "News", parentId: null });
		const moved = await moveToFolder(store, { entryId: entry.id, folderId: folder.id, expectedVersion: entry.version });
		expect(moved.folderId).toBe(folder.id);

		expect(await schedules.cancelSchedule({ scheduleId: created.id, entryId: entry.id })).toBe(true);
		expect(await store.lockedBy({ entryId: entry.id })).toBeNull();
		await expect(
			store.saveWorkingWithReferences({
				entryId: entry.id,
				expectedVersion: moved.version,
				snapshot: snapshot("scheduled-1", "풀린 뒤 본문"),
				references: [],
			}),
		).resolves.toBeTruthy();
	});

	it("같은 글에 대기 예약은 두 개 만들 수 없다", async () => {
		const entry = await post("schedule-duplicate");
		const first = await schedules.createSchedule({
			entryId: entry.id,
			expectedVersion: entry.version,
			scheduledAt: inAnHour(),
		});
		await expect(
			schedules.createSchedule({
				entryId: entry.id,
				expectedVersion: entry.version,
				scheduledAt: new Date(Date.now() + 7200_000),
			}),
		).rejects.toMatchObject({ code: "conflict" });
		const { rows } = await pool.query<{ id: string }>(
			`SELECT id FROM "${schemaName}".schedules WHERE entry_id = $1 AND status = 'pending'`,
			[entry.id],
		);
		expect(rows.map((row) => row.id)).toEqual([first.id]);
	});

	it("지난 시각·발행할 수 없는 본문·휴지통 글은 예약하지 않는다", async () => {
		const entry = await post("schedule-past");
		await expect(
			schedules.createSchedule({
				entryId: entry.id,
				expectedVersion: entry.version,
				scheduledAt: new Date(Date.now() - 1000),
			}),
		).rejects.toMatchObject({ code: "invalid_input" });

		const broken = await post("schedule-broken", "<Callout>");
		await expect(
			schedules.createSchedule({ entryId: broken.id, expectedVersion: broken.version, scheduledAt: inAnHour() }),
		).rejects.toMatchObject({ code: "publish_validation_failed" });

		const trashed = await store.trashEntry({ id: entry.id, expectedVersion: entry.version });
		await expect(
			schedules.createSchedule({ entryId: trashed.id, expectedVersion: trashed.version, scheduledAt: inAnHour() }),
		).rejects.toMatchObject({ code: "invalid_status" });
	});

	it("직접 발행·보관은 대기 예약을 취소해 잠금을 푼다", async () => {
		const published = await post("schedule-superseded");
		await schedules.createSchedule({
			entryId: published.id,
			expectedVersion: published.version,
			scheduledAt: inAnHour(),
		});
		await store.publishEntry({ id: published.id, expectedVersion: published.version });
		expect(await store.lockedBy({ entryId: published.id })).toBeNull();
		expect((await schedules.getEntrySchedule({ entryId: published.id })).last).toMatchObject({
			status: "cancelled",
			failureCode: "superseded",
		});

		const archived = await post("schedule-archived");
		await schedules.createSchedule({
			entryId: archived.id,
			expectedVersion: archived.version,
			scheduledAt: inAnHour(),
		});
		await store.archiveEntry({ id: archived.id, expectedVersion: archived.version });
		expect((await schedules.getEntrySchedule({ entryId: archived.id })).last).toMatchObject({
			status: "cancelled",
			failureCode: "entry_status_changed",
		});
	});

	it("예정 시각 전에는 실행을 거부하고 본문을 공개하지 않는다", async () => {
		const entry = await post("schedule-not-due");
		const created = await schedules.createSchedule({
			entryId: entry.id,
			expectedVersion: entry.version,
			scheduledAt: inAnHour(),
		});
		await expect(schedules.executeSchedulePublish({ scheduleId: created.id })).rejects.toMatchObject({
			code: "conflict",
		});
		expect((await store.getEntry(entry.id)).status).toBe("draft");
	});

	it("도래한 예약을 실행하면 발행하고, 같은 예약을 다시 불러도 다시 발행하지 않는다", async () => {
		const entry = await post("schedule-due");
		const created = await schedules.createSchedule({
			entryId: entry.id,
			expectedVersion: entry.version,
			scheduledAt: new Date(Date.now() - 10_000),
			now: new Date(Date.now() - 60_000),
		});
		expect((await schedules.getDueSchedules()).some((due) => due.id === created.id)).toBe(true);

		expect(await schedules.executeSchedulePublish({ scheduleId: created.id })).toEqual({ status: "completed" });
		const published = await store.getEntry(entry.id);
		expect(published.status).toBe("published");
		// 실행한 예약은 발행 알림으로 취소되지 않고 끝난 것으로 남는다.
		expect((await schedules.getEntrySchedule({ entryId: entry.id })).last).toMatchObject({
			id: created.id,
			status: "completed",
		});

		expect(await schedules.executeSchedulePublish({ scheduleId: created.id })).toEqual({ status: "completed" });
		expect((await store.getEntry(entry.id)).version).toBe(published.version);
	});

	it("실행 때 발행 검사를 다시 하고, 실패하면 공개본을 두고 실패를 기록한다", async () => {
		const target = await post(`schedule-link-target-${randomUUID()}`);
		const publishedTarget = await store.publishEntry({ id: target.id, expectedVersion: target.version });
		const entry = await post(
			`schedule-revalidation-${randomUUID()}`,
			`Previously public. [link](/posts/${publishedTarget.publishedSlug})`,
		);
		const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });
		const created = await schedules.createSchedule({
			entryId: entry.id,
			expectedVersion: published.version,
			scheduledAt: new Date(Date.now() - 1000),
			now: new Date(Date.now() - 60_000),
		});
		// 예약 중 링크 대상이 보관되면 실행은 실패해야 한다.
		await store.archiveEntry({ id: target.id, expectedVersion: publishedTarget.version });

		await expect(schedules.executeSchedulePublish({ scheduleId: created.id })).rejects.toMatchObject({
			code: "publish_validation_failed",
		});
		const unchanged = await store.getEntry(entry.id);
		expect(unchanged.status).toBe("published");
		expect(unchanged.published?.mdx).toContain("Previously public.");

		const { pending, last } = await schedules.getEntrySchedule({ entryId: entry.id });
		expect(pending).toBeNull();
		expect(last).toMatchObject({ id: created.id, status: "failed", failureCode: "publish_validation_failed" });
		expect(last?.failureDetail).toContain("unpublished_internal_link");
	});
});
