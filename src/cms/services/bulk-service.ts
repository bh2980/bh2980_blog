import { COLLECTION_DEFINITIONS } from "../core/collections";
import { prepareSnapshot } from "../core/snapshot";
import type { Issue, ServiceInput, StorePort, WorkingCopy } from "./types";
import { ServiceError } from "./types";

export const BULK_OPS = [
	"tags.add",
	"tags.remove",
	"category.set",
	"folder.move",
	"archive",
	"unarchive",
	"trash",
	"publish",
] as const;
export type BulkOp = (typeof BULK_OPS)[number];

const LIFECYCLE_OPS: readonly BulkOp[] = ["archive", "unarchive", "trash", "publish"];

export type BulkItem = { readonly id: string; readonly expectedVersion: number };
export type BulkRequest = {
	readonly op: BulkOp;
	readonly items: readonly BulkItem[];
	readonly tagIds?: readonly string[];
	readonly categoryId?: string | null;
	readonly folderId?: string | null;
};
export type BulkItemResult =
	| { readonly id: string; readonly ok: true; readonly version: number }
	| { readonly id: string; readonly ok: false; readonly error: string; readonly issues?: readonly Issue[] };

const MAX_ITEMS = 100;

const toServiceInput = (working: WorkingCopy, metadata: { [key: string]: unknown }): ServiceInput =>
	({ collection: working.collection, slug: working.slug, metadata, mdx: working.mdx }) as ServiceInput;

export const createBulkService = <T = unknown>(storePort: StorePort<T>) => ({
	run: async (request: BulkRequest): Promise<{ results: BulkItemResult[] }> => {
		if (!request || typeof request !== "object" || !BULK_OPS.includes(request.op)) {
			throw new ServiceError("unknown_op");
		}
		if (!Array.isArray(request.items)) throw new ServiceError("invalid_input");
		if (request.items.length > MAX_ITEMS) throw new ServiceError("too_many_items");
		if ((request.op === "tags.add" || request.op === "tags.remove") && !Array.isArray(request.tagIds)) {
			throw new ServiceError("invalid_input");
		}
		if (request.op === "folder.move" && request.folderId === undefined) throw new ServiceError("invalid_input");

		const results: BulkItemResult[] = [];
		for (const item of request.items) {
			if (!item || typeof item.id !== "string" || !item.id) {
				results.push({ id: "", ok: false, error: "invalid_input" });
				continue;
			}
			if (
				typeof item.expectedVersion !== "number" ||
				!Number.isInteger(item.expectedVersion) ||
				item.expectedVersion <= 0
			) {
				results.push({ id: item.id, ok: false, error: "invalid_input" });
				continue;
			}
			try {
				if (LIFECYCLE_OPS.includes(request.op)) {
					// 사용자 결정 Q3-A: 예약된 글은 일괄 상태 변경을 실행하지 않고 항목별 `locked`로 표시한다.
					// 예약을 조용히 취소하지 않도록 편집 화면에서 먼저 예약을 해제하게 한다.
					if (await storePort.hasPendingSchedule({ entryId: item.id })) {
						results.push({ id: item.id, ok: false, error: "locked" });
						continue;
					}
					const lifecycleParams = { id: item.id, expectedVersion: item.expectedVersion };
					const acted =
						request.op === "archive"
							? await storePort.archiveEntry(lifecycleParams)
							: request.op === "unarchive"
								? await storePort.unarchiveEntry(lifecycleParams)
								: request.op === "trash"
									? await storePort.trashEntry(lifecycleParams)
									: await storePort.publishEntry(lifecycleParams);
					results.push({ id: item.id, ok: true, version: acted.version });
					continue;
				}
				const working = await storePort.getWorking({ entryId: item.id });
				const metadata: { [key: string]: unknown } = { ...working.metadata };
				let folderId: string | null | undefined;
				if (request.op === "tags.add" || request.op === "tags.remove") {
					if (!Object.hasOwn(COLLECTION_DEFINITIONS[working.collection].fields, "tagIds")) {
						throw new ServiceError("invalid_input");
					}
					// 태그가 하나도 없는 글은 `tagIds` 키 자체가 없다(편집기가 빈 배열을 지운다).
					const current = Array.isArray(metadata.tagIds)
						? metadata.tagIds.filter((t): t is string => typeof t === "string")
						: [];
					const next =
						request.op === "tags.add"
							? [...current, ...(request.tagIds ?? []).filter((t) => typeof t === "string" && !current.includes(t))]
							: current.filter((t) => !(request.tagIds ?? []).includes(t));
					if (next.length > 0) metadata.tagIds = next;
					else delete metadata.tagIds;
				} else if (request.op === "category.set") {
					if (working.collection !== "post") throw new ServiceError("invalid_input");
					if (request.categoryId === undefined) throw new ServiceError("invalid_input");
					if (request.categoryId === null) delete metadata.categoryId;
					else metadata.categoryId = request.categoryId;
				} else {
					folderId = request.folderId ?? null;
				}
				const previousReferences = await storePort.getWorkingReferences({ entryId: item.id });
				const snapshot = await prepareSnapshot(toServiceInput(working, metadata), { previousReferences });
				const saved = (await storePort.saveWorkingWithReferences({
					entryId: item.id,
					expectedVersion: item.expectedVersion,
					snapshot,
					references: snapshot.references,
					folderId,
				})) as { version: number };
				results.push({ id: item.id, ok: true, version: saved.version });
			} catch (e) {
				const { code, issues } = (e ?? {}) as { code?: unknown; issues?: readonly Issue[] };
				results.push({
					id: item.id,
					ok: false,
					error: typeof code === "string" ? code : "internal",
					...(Array.isArray(issues) && issues.length > 0 ? { issues } : {}),
				});
			}
		}
		return { results };
	},
});
