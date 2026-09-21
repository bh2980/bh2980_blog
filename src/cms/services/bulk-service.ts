import { prepareSnapshot } from "./content-service";
import type { ServiceInput, StorePort, WorkingCopy } from "./types";
import { ServiceError } from "./types";

export const BULK_OPS = ["tags.add", "tags.remove", "category.set", "folder.move"] as const;
export type BulkOp = (typeof BULK_OPS)[number];

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
	| { readonly id: string; readonly ok: false; readonly error: string };

const MAX_ITEMS = 100;

const toServiceInput = (working: WorkingCopy, metadata: { [key: string]: unknown }): ServiceInput => {
	const base = { slug: working.slug, metadata: metadata as never, mdx: working.mdx };
	switch (working.collection) {
		case "post":
			return { collection: "post", ...base };
		case "memo":
			return { collection: "memo", ...base };
		case "category":
			return { collection: "category", ...base };
		case "tag":
			return { collection: "tag", ...base };
		case "collection":
			return { collection: "collection", ...base };
		default:
			throw new ServiceError("unknown_collection");
	}
};

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
				const working = await storePort.getWorking({ entryId: item.id });
				const metadata: { [key: string]: unknown } = { ...working.metadata };
				let folderId: string | null | undefined;
				if (request.op === "tags.add" || request.op === "tags.remove") {
					if (!Array.isArray(metadata.tagIds)) throw new ServiceError("invalid_input");
					const current = metadata.tagIds.filter((t): t is string => typeof t === "string");
					metadata.tagIds =
						request.op === "tags.add"
							? [...current, ...(request.tagIds ?? []).filter((t) => typeof t === "string" && !current.includes(t))]
							: current.filter((t) => !(request.tagIds ?? []).includes(t));
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
				const code = (e as { code?: unknown })?.code;
				results.push({ id: item.id, ok: false, error: typeof code === "string" ? code : "internal" });
			}
		}
		return { results };
	},
});
