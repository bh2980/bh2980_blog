import { describe, expect, it } from "vitest";
import type { Reference } from "../index";
import { ServiceError } from "../index";
import { createBulkService } from "../bulk-service";

/**
 * TW-1b (부분): 예약 글 처리(Q3) 결정과 무관한 케이스만 단언한다.
 * 예약 글이 섞인 publish 케이스는 아래 describe.skip에 보류한다.
 */

type EntryState = { version: number; status: "draft" | "published" | "archived" | "trashed"; brokenRef?: boolean };

const newFakeLifecycleStore = (seed: Record<string, EntryState>, scheduled: readonly string[] = []) => {
	const entries = new Map<string, EntryState>(Object.entries(seed));
	const scheduledIds = new Set(scheduled);
	const bump = (entryId: string, expectedVersion: number, status: EntryState["status"]) => {
		const found = entries.get(entryId);
		if (!found) throw new ServiceError("not_found");
		if (expectedVersion !== found.version) throw new ServiceError("conflict");
		if (status === "published" && found.brokenRef) throw new ServiceError("invalid_reference");
		const next = { ...found, version: found.version + 1, status };
		entries.set(entryId, next);
		return { version: next.version };
	};
	return {
		entries,
		async getWorkingReferences() {
			return [] as Reference[];
		},
		async hasPendingSchedule(params: { entryId: string }) {
			return scheduledIds.has(params.entryId);
		},
		unschedule(entryId: string) {
			scheduledIds.delete(entryId);
		},
		async getWorking() {
			throw new ServiceError("invalid_input");
		},
		async createEntryWithReferences() {
			throw new ServiceError("invalid_input");
		},
		async saveWorkingWithReferences() {
			throw new ServiceError("invalid_input");
		},
		async archiveEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "archived");
		},
		async unarchiveEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "draft");
		},
		async trashEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "trashed");
		},
		async publishEntry(params: { id: string; expectedVersion: number }) {
			return bump(params.id, params.expectedVersion, "published");
		},
	};
};

describe("M4-TW-1b Bulk lifecycle ops contract", () => {
	it("rejects unknown op for the whole request", async () => {
		const bulk = createBulkService(newFakeLifecycleStore({}));
		await expect(bulk.run({ op: "bogus", items: [] } as any)).rejects.toThrowError(
			expect.objectContaining({ code: "unknown_op" }),
		);
	});

	it("rejects more than 100 items", async () => {
		const bulk = createBulkService(newFakeLifecycleStore({}));
		const items = Array.from({ length: 101 }, (_, i) => ({ id: `e-${i}`, expectedVersion: 1 }));
		await expect(bulk.run({ op: "archive", items })).rejects.toThrowError(
			expect.objectContaining({ code: "too_many_items" }),
		);
	});

	it("archive bumps version per item", async () => {
		const store = newFakeLifecycleStore({ e1: { version: 2, status: "draft" } });
		const bulk = createBulkService(store);
		const out = await bulk.run({ op: "archive", items: [{ id: "e1", expectedVersion: 2 }] });
		expect(out).toEqual({ results: [{ id: "e1", ok: true, version: 3 }] });
		expect(store.entries.get("e1")?.status).toBe("archived");
	});

	it("unarchive and trash dispatch to their own primitives", async () => {
		const store = newFakeLifecycleStore({
			e1: { version: 1, status: "archived" },
			e2: { version: 4, status: "draft" },
		});
		const bulk = createBulkService(store);
		await expect(
			bulk.run({ op: "unarchive", items: [{ id: "e1", expectedVersion: 1 }] }),
		).resolves.toEqual({ results: [{ id: "e1", ok: true, version: 2 }] });
		await expect(bulk.run({ op: "trash", items: [{ id: "e2", expectedVersion: 4 }] })).resolves.toEqual({
			results: [{ id: "e2", ok: true, version: 5 }],
		});
		expect(store.entries.get("e1")?.status).toBe("draft");
		expect(store.entries.get("e2")?.status).toBe("trashed");
	});

	it("conflict and missing entries are per-item errors", async () => {
		const store = newFakeLifecycleStore({ e1: { version: 2, status: "draft" } });
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "archive",
			items: [
				{ id: "e1", expectedVersion: 2 },
				{ id: "e1", expectedVersion: 2 },
				{ id: "ghost", expectedVersion: 1 },
			],
		});
		expect(out).toEqual({
			results: [
				{ id: "e1", ok: true, version: 3 },
				{ id: "e1", ok: false, error: "conflict" },
				{ id: "ghost", ok: false, error: "not_found" },
			],
		});
	});

	it("publish passes validation failures through per item", async () => {
		const store = newFakeLifecycleStore({
			e1: { version: 2, status: "draft" },
			e2: { version: 2, status: "draft", brokenRef: true },
		});
		const bulk = createBulkService(store);
		const out = await bulk.run({
			op: "publish",
			items: [
				{ id: "e1", expectedVersion: 2 },
				{ id: "e2", expectedVersion: 2 },
			],
		});
		expect(out).toEqual({
			results: [
				{ id: "e1", ok: true, version: 3 },
				{ id: "e2", ok: false, error: "invalid_reference" },
			],
		});
	});

	describe("scheduled entries in bulk (Q3 결정: (A) 항목별 실패)", () => {
		it("scheduled entries fail per-item as locked without executing; others proceed", async () => {
			const store = newFakeLifecycleStore(
				{ e1: { version: 2, status: "draft" }, e2: { version: 2, status: "draft" } },
				["e2"],
			);
			const bulk = createBulkService(store);
			const out = await bulk.run({
				op: "publish",
				items: [
					{ id: "e1", expectedVersion: 2 },
					{ id: "e2", expectedVersion: 2 },
				],
			});
			expect(out).toEqual({
				results: [
					{ id: "e1", ok: true, version: 3 },
					{ id: "e2", ok: false, error: "locked" },
				],
			});
			// e2 untouched: version bumped only for e1
			expect(store.entries.get("e2")?.status).toBe("draft");
			expect(store.entries.get("e2")?.version).toBe(2);
		});

		it("scheduled entry in bulk archive is locked (schedule preserved, not cancelled)", async () => {
			const store = newFakeLifecycleStore({ e1: { version: 1, status: "draft" } }, ["e1"]);
			const bulk = createBulkService(store);
			const out = await bulk.run({ op: "archive", items: [{ id: "e1", expectedVersion: 1 }] });
			expect(out).toEqual({ results: [{ id: "e1", ok: false, error: "locked" }] });
			expect(store.entries.get("e1")?.status).toBe("draft");
		});

		it("rerun after unschedule succeeds", async () => {
			const store = newFakeLifecycleStore({ e1: { version: 1, status: "draft" } }, ["e1"]);
			const bulk = createBulkService(store);
			await bulk.run({ op: "archive", items: [{ id: "e1", expectedVersion: 1 }] });
			store.unschedule("e1");
			const out = await bulk.run({ op: "archive", items: [{ id: "e1", expectedVersion: 1 }] });
			expect(out).toEqual({ results: [{ id: "e1", ok: true, version: 2 }] });
		});
	});
});
