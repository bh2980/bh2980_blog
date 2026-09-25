import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { BulkBar } from "../bulk-bar";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const selected = [{ id: "entry-1", expectedVersion: 3 }];
const folders: Folder[] = [
	{ id: "folder-1", collection: "post", parentId: null, name: "Folder One", position: 0, version: 1 },
];

function stubBulkApi() {
	const payloads: { op: string; tagIds?: string[]; categoryId?: string | null; folderId?: string | null }[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.startsWith("/api/cms/v1/entries?collection=")) {
				const items = url.includes("collection=tag") ? [{ id: "tag-1", title: "Tag One" }] : [];
				return { ok: true, json: async () => ({ items }) };
			}
			if (url === "/api/cms/v1/bulk") {
				payloads.push(JSON.parse(String(init?.body)));
				return {
					ok: true,
					json: async () => ({ results: [{ id: "entry-1", ok: true, version: 4 }] }),
				};
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
	return payloads;
}

function renderBulkBar() {
	const onDone = vi.fn();
	render(<BulkBar selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={onDone} />);
	return onDone;
}

describe("bulk action native selects", () => {
	it("preserves tag and root/category sentinel payloads", async () => {
		const payloads = stubBulkApi();
		renderBulkBar();
		fireEvent.click(await screen.findByRole("checkbox", { name: "Tag One" }));
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({ op: "tags.add", items: selected, tagIds: ["tag-1"] });

		fireEvent.change(screen.getByRole("combobox", { name: "일괄 작업 종류" }), {
			target: { value: "category.set" },
		});
		const category = await screen.findByRole("combobox", { name: "대상 카테고리" });
		fireEvent.change(category, { target: { value: "__none__" } });
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		await waitFor(() => expect(payloads).toHaveLength(2));
		expect(payloads[1]).toEqual({ op: "category.set", items: selected, categoryId: null });

		fireEvent.change(screen.getByRole("combobox", { name: "일괄 작업 종류" }), {
			target: { value: "folder.move" },
		});
		const folder = await screen.findByRole("combobox", { name: "이동할 폴더" });
		fireEvent.change(folder, { target: { value: "__root__" } });
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		await waitFor(() => expect(payloads).toHaveLength(3));
		expect(payloads[2]).toEqual({ op: "folder.move", items: selected, folderId: null });
	});

	it("keeps destructive actions behind their confirmation dialog", async () => {
		const payloads = stubBulkApi();
		renderBulkBar();
		fireEvent.change(screen.getByRole("combobox", { name: "일괄 작업 종류" }), {
			target: { value: "trash" },
		});
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		const dialog = await screen.findByRole("dialog", { name: "일괄 작업 확인" });
		expect(payloads).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "계속" }));
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({ op: "trash", items: selected });
		expect(dialog).toBeTruthy();
	});
});
