import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BacklinkField } from "@/cms/schema/fields";
import { BacklinkInput } from "../field-inputs";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const field: BacklinkField = {
	kind: "backlink",
	label: "모음집",
	from: "collection",
	via: "itemIds",
	createInline: true,
};

const shared = {
	references: [
		{
			state: "working" as const,
			sourceId: "c1",
			sourceCollection: "collection",
			sourceTitle: "시리즈 A",
			sourceSlug: "a",
			kind: "entry" as const,
			isStale: false,
			occurrences: [{ type: "metadata" as const, path: "itemIds", ordinal: 0 }],
		},
	],
	loading: false,
	refresh: vi.fn(),
};

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

/** 모음집 `c2`의 저장을 `release`로 풀기 전까지 붙잡아 둔다. */
function stubApi(patchStatus: number) {
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url.startsWith("/api/cms/v1/entries?")) {
				return json({
					items: [
						{ id: "c1", title: "시리즈 A", slug: "a" },
						{ id: "c2", title: "시리즈 B", slug: "b" },
					],
					total: 2,
				});
			}
			if (url === "/api/cms/v1/entries/c2" && !init?.method) {
				return json({ version: 1, workingSlug: "b", working: { metadata: { title: "시리즈 B", itemIds: [] } } });
			}
			if (url === "/api/cms/v1/entries/c2" && init?.method === "PATCH") {
				await held;
				return patchStatus < 400 ? json({ version: 2 }) : json({ code: "internal", message: "실패" }, patchStatus);
			}
			throw new Error(`Unexpected fetch: ${url}`);
		}),
	);
	return () => release();
}

const addSeriesB = async () => {
	render(<BacklinkInput field={field} targetId="post-1" disabled={false} shared={shared} />);
	const input = await screen.findByRole("combobox", { name: "모음집" });
	fireEvent.input(input, { target: { value: "시리즈 B" }, inputType: "insertText" });
	fireEvent.click(await screen.findByRole("option", { name: "시리즈 B" }));
};

describe("모음집 넣기(반대 방향 관계)", () => {
	it("고르면 저장을 기다리지 않고 바로 보인다", async () => {
		const release = stubApi(200);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeTruthy();
		release();
		await waitFor(() => expect(shared.refresh).toHaveBeenCalled());
		expect(toast.error).not.toHaveBeenCalled();
	});

	it("저장이 실패하면 알리고 되돌린다", async () => {
		const release = stubApi(500);
		await addSeriesB();
		expect(screen.getByText("시리즈 B")).toBeTruthy();
		release();
		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		await waitFor(() => expect(screen.queryByText("시리즈 B")).toBeNull());
		expect(screen.getByText("시리즈 A")).toBeTruthy();
	});
});
