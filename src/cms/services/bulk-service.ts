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
	"permanentDelete",
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
/** 영구 삭제를 막은 참조(사용처). 휴지통 화면이 사유(`사용 중: ○○`)로 보여 준다. */
export type BulkUsage = {
	readonly entryId: string;
	readonly title: string | null;
	readonly collection: string;
	readonly state: string;
};
export type BulkItemResult =
	| { readonly id: string; readonly ok: true; readonly version: number }
	| {
			readonly id: string;
			readonly ok: false;
			readonly error: string;
			readonly issues?: readonly Issue[];
			readonly usages?: readonly BulkUsage[];
	  };

const MAX_ITEMS = 100;

/** 일괄 작업이 저장소에 요구하는 계약. 영구 삭제는 일괄 작업에서만 쓰므로 공통 `StorePort`에 넣지 않는다. */
export interface BulkStorePort<T = unknown> extends StorePort<T> {
	/** 휴지통 항목만 영구 삭제한다. 다른 콘텐츠가 참조하면 `in_use`(details.usages)로 거부한다. */
	permanentDeleteEntry(params: { id: string; expectedVersion: number }): Promise<void>;
}

const toServiceInput = (working: WorkingCopy, metadata: { [key: string]: unknown }): ServiceInput =>
	({ collection: working.collection, slug: working.slug, metadata, mdx: working.mdx }) as ServiceInput;

export const createBulkService = <T = unknown>(storePort: BulkStorePort<T>) => ({
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
				if (request.op === "permanentDelete") {
					// 휴지통으로 옮길 때 예약이 취소되므로 예약 잠금은 확인하지 않는다. 휴지통 여부·참조는 저장소가 검사한다.
					try {
						await storePort.permanentDeleteEntry({ id: item.id, expectedVersion: item.expectedVersion });
					} catch (error) {
						// 같은 요청에서 먼저 지운 원문이 번역본을 함께 지웠다(v3). 이미 없는 항목은 지운 것으로 본다.
						if ((error as { code?: unknown })?.code !== "not_found") throw error;
					}
					// 삭제된 항목에는 새 버전이 없다. 요청한 버전을 그대로 돌려준다.
					results.push({ id: item.id, ok: true, version: item.expectedVersion });
					continue;
				}
				if (LIFECYCLE_OPS.includes(request.op)) {
					// 사용자 결정 Q3-A: 예약된 글은 일괄 상태 변경을 실행하지 않고 항목별 `locked`로 표시한다.
					// 예약을 조용히 취소하지 않도록 편집 화면에서 먼저 예약을 해제하게 한다.
					const groupWide = request.op === "archive" || request.op === "trash";
					if (await storePort.hasPendingSchedule({ entryId: item.id, includeTranslations: groupWide })) {
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
				const { code, issues, details } = (e ?? {}) as {
					code?: unknown;
					issues?: readonly Issue[];
					details?: { usages?: readonly BulkUsage[] };
				};
				const usages = details?.usages;
				results.push({
					id: item.id,
					ok: false,
					error: typeof code === "string" ? code : "internal",
					...(Array.isArray(issues) && issues.length > 0 ? { issues } : {}),
					...(Array.isArray(usages) && usages.length > 0 ? { usages } : {}),
				});
			}
		}
		return { results };
	},
});
