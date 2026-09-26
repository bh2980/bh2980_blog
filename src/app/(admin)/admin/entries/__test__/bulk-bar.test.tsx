import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Folder } from "@/cms/adapters/postgres/content-store";
import { BulkBar } from "../bulk-bar";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const selected = [{ id: "entry-1", expectedVersion: 3, title: "첫 글" }];
const folders: Folder[] = [
	{ id: "folder-1", collection: "post", parentId: null, name: "Folder One", position: 0, version: 1 },
];

function stubBulkApi(results: unknown[] = [{ id: "entry-1", ok: true, version: 4 }]) {
	const payloads: Record<string, unknown>[] = [];
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.startsWith("/api/cms/v1/entries?")) {
				const items = url.includes("collection=tag") ? [{ id: "tag-1", title: "Tag One", slug: "tag-one" }] : [];
				return { ok: true, status: 200, json: async () => ({ items, total: items.length }) };
			}
			if (url === "/api/cms/v1/bulk") {
				payloads.push(JSON.parse(String(init?.body)));
				return { ok: true, status: 200, json: async () => ({ results }) };
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
	return payloads;
}

describe("bulk actions (§3.4)", () => {
	it("sends tag, category clear and unfiled folder payloads", async () => {
		const payloads = stubBulkApi();
		render(
			<BulkBar collection="post" selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={vi.fn()} />,
		);
		fireEvent.click(await screen.findByRole("checkbox", { name: "Tag One" }));
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({ op: "tags.add", items: [{ id: "entry-1", expectedVersion: 3 }], tagIds: ["tag-1"] });

		fireEvent.change(screen.getByRole("combobox", { name: "일괄 작업 종류" }), { target: { value: "category.set" } });
		fireEvent.change(await screen.findByRole("combobox", { name: "대상 카테고리" }), { target: { value: "__none__" } });
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		await waitFor(() => expect(payloads).toHaveLength(2));
		expect(payloads[1]).toMatchObject({ op: "category.set", categoryId: null });

		fireEvent.change(screen.getByRole("combobox", { name: "일괄 작업 종류" }), { target: { value: "folder.move" } });
		fireEvent.change(await screen.findByRole("combobox", { name: "이동할 폴더" }), {
			target: { value: "__unfiled__" },
		});
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		await waitFor(() => expect(payloads).toHaveLength(3));
		expect(payloads[2]).toMatchObject({ op: "folder.move", folderId: null });
	});

	it("keeps destructive actions behind a confirmation dialog", async () => {
		const payloads = stubBulkApi();
		render(
			<BulkBar collection="post" selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={vi.fn()} />,
		);
		fireEvent.change(screen.getByRole("combobox", { name: "일괄 작업 종류" }), { target: { value: "trash" } });
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		await screen.findByRole("alertdialog", { name: /휴지통 이동/ });
		expect(payloads).toHaveLength(0);
		fireEvent.click(screen.getByRole("button", { name: "계속" }));
		await waitFor(() => expect(payloads).toHaveLength(1));
		expect(payloads[0]).toEqual({ op: "trash", items: [{ id: "entry-1", expectedVersion: 3 }] });
	});

	it("names failed items with their reason and validation issues", async () => {
		stubBulkApi([
			{
				id: "entry-1",
				ok: false,
				error: "publish_validation_failed",
				issues: [{ code: "missing_category", path: "categoryId" }],
			},
		]);
		const onDone = vi.fn();
		render(
			<BulkBar collection="post" selected={selected} folders={folders} onClearSelection={vi.fn()} onDone={onDone} />,
		);
		fireEvent.change(screen.getByRole("combobox", { name: "일괄 작업 종류" }), { target: { value: "publish" } });
		fireEvent.click(screen.getByRole("button", { name: "일괄 실행" }));
		fireEvent.click(await screen.findByRole("button", { name: "계속" }));
		expect(await screen.findByText(/첫 글/)).toBeTruthy();
		expect(screen.getByText(/카테고리를 지정하세요/)).toBeTruthy();
		expect(screen.getByRole("button", { name: "실패만 다시 실행" })).toBeTruthy();
		expect(onDone).toHaveBeenCalledWith(["entry-1"]);
	});

	it("offers only record-safe actions for record collections", () => {
		stubBulkApi();
		render(<BulkBar collection="tag" selected={selected} folders={[]} onClearSelection={vi.fn()} onDone={vi.fn()} />);
		const options = Array.from(
			(screen.getByRole("combobox", { name: "일괄 작업 종류" }) as HTMLSelectElement).options,
		).map((option) => option.value);
		expect(options).toEqual(["folder.move", "trash"]);
	});
});
