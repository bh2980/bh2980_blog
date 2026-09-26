import type { PoolClient } from "pg";
import { isRecordCollection } from "../../../core/collections";
import { type StoreContext, withTransaction } from "./context";
import { CmsError, mapEntryWriteError } from "./errors";
import type { Publishing } from "./publish";
import { loadEntry, lockEntryForUpdate } from "./rows";
import type { Entry, EntryStatus } from "./types";

type LifecycleParams = { id: string; expectedVersion: number };

/**
 * §5.3 상태 전환. 허용되지 않은 출발 상태는 `invalid_status`(409)로 거부한다 —
 * 예컨대 발행된 글에 `보관 해제`나 `복원`을 눌러 공개가 조용히 내려가는 일을 막는다.
 */
export function createLifecycleOps(ctx: StoreContext, publishing: Publishing) {
	const { pool, qSchema } = ctx;

	const transition = (
		params: LifecycleParams,
		allowedFrom: readonly EntryStatus[],
		apply: (client: PoolClient, locked: { version: number; collection: string; status: EntryStatus }) => Promise<void>,
	): Promise<Entry> =>
		withTransaction(
			pool,
			async (client) => {
				const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
				if (!allowedFrom.includes(locked.status)) {
					throw new CmsError(`Cannot change status from ${locked.status}`, "invalid_status", locked.version);
				}
				await apply(client, locked);
				return loadEntry(client, params.id, qSchema);
			},
			{ mapError: mapEntryWriteError },
		);

	const cancelPendingSchedules = (client: PoolClient, id: string) =>
		client.query(
			`UPDATE "${qSchema}".schedules SET status = 'cancelled', completed_at = NOW(), failure_code = 'entry_status_changed'
			 WHERE entry_id = $1 AND status = 'pending'`,
			[id],
		);

	return {
		/** 초안/발행 → 보관. 공개를 끝내고 예약을 취소한다. record 컬렉션은 보관이 없다. */
		archiveEntry: (params: LifecycleParams) =>
			transition(params, ["draft", "published"], async (client, locked) => {
				if (isRecordCollection(locked.collection)) {
					throw new CmsError("Record collections cannot be archived", "invalid_status", locked.version);
				}
				await client.query(`UPDATE "${qSchema}".entries SET status = 'archived', version = $1 WHERE id = $2`, [
					locked.version + 1,
					params.id,
				]);
				await cancelPendingSchedules(client, params.id);
			}),

		/** 보관 → 초안. 자동으로 다시 공개하지 않는다. */
		unarchiveEntry: (params: LifecycleParams) =>
			transition(params, ["archived"], async (client, locked) => {
				await client.query(`UPDATE "${qSchema}".entries SET status = 'draft', version = $1 WHERE id = $2`, [
					locked.version + 1,
					params.id,
				]);
			}),

		/**
		 * → 휴지통. 공개를 끝내고 예약을 취소한다.
		 * 사용 중인 태그·카테고리는 참조를 먼저 해제해야 한다(§6.1).
		 */
		trashEntry: (params: LifecycleParams) =>
			transition(params, ["draft", "published", "archived"], async (client, locked) => {
				if (locked.collection === "tag" || locked.collection === "category") {
					await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: true });
				}
				await client.query(
					`UPDATE "${qSchema}".entries SET status = 'trashed', trashed_at = NOW(), version = $1 WHERE id = $2`,
					[locked.version + 1, params.id],
				);
				await cancelPendingSchedules(client, params.id);
			}),

		/**
		 * 휴지통 → 복원. publish 컬렉션은 초안으로, record 컬렉션은 현재 값과 관계를 검증한 뒤
		 * 활성(공개) 레코드로 되돌린다(§5.3).
		 */
		restoreEntry: (params: LifecycleParams) =>
			transition(params, ["trashed"], async (client, locked) => {
				const version = locked.version + 1;
				await client.query(
					`UPDATE "${qSchema}".entries SET status = 'draft', trashed_at = NULL, version = $1 WHERE id = $2`,
					[version, params.id],
				);
				if (isRecordCollection(locked.collection)) {
					await publishing.publishWithinTransaction(client, params.id, { expectedVersion: version });
				}
			}),

		/**
		 * 휴지통 항목의 영구 삭제(§5.3, §6.2). 다른 콘텐츠가 참조하면 거부한다.
		 * 공개된 적 있는 주소는 재사용 방지 기록(`deleted`)만 남기고, 공개된 적 없는 예약 주소는 해제한다.
		 */
		permanentDeleteEntry: async (params: LifecycleParams): Promise<void> =>
			withTransaction(pool, async (client) => {
				const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
				if (locked.status !== "trashed") {
					throw new CmsError("Only trashed entries can be permanently deleted", "invalid_status", locked.version);
				}
				await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: false });
				await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [
					params.id,
				]);
				await client.query(
					`UPDATE "${qSchema}".content_addresses SET type = 'deleted', entry_id = NULL WHERE entry_id = $1`,
					[params.id],
				);
				await client.query(`DELETE FROM "${qSchema}".entries WHERE id = $1`, [params.id]);
			}),
	};
}
