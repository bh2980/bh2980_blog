import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordPanel } from "../record-panel";

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const tag = {
	id: "tag-1",
	collection: "tag",
	status: "published",
	version: 3,
	folderId: null,
	workingSlug: "react",
	publishedSlug: "react",
	working: { metadata: { title: "리액트", translations: { en: { title: "React" } } }, mdx: "" },
};

let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit).body));

beforeEach(() => {
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		if (input === "/api/cms/v1/entries/tag-1" && !init?.method) return json(tag);
		if (input === "/api/cms/v1/entries/tag-1" && init?.method === "PATCH") return json({ ...tag, version: 4 });
		if (input === "/api/cms/v1/entries" && init?.method === "POST") return json({ ...tag, id: "tag-2" }, 201);
		if (input.startsWith("/api/cms/v1/entries?")) return json({ items: [], total: 0 });
		throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

const renderPanel = (target: { collection: "tag" | "category" | "collection"; id: string | null }) => {
	const onClose = vi.fn();
	const onSaved = vi.fn();
	render(<RecordPanel target={target} onClose={onClose} onSaved={onSaved} />);
	return { onClose, onSaved };
};
const panel = () => screen.getByRole("complementary", { name: /태그/ });

describe("분류 편집 패널", () => {
	it("목록 옆 패널로 열리고 언어 탭마다 번역이 있는지 보인다", async () => {
		renderPanel({ collection: "tag", id: "tag-1" });
		const name = (await screen.findByRole("textbox", { name: /이름/ })) as HTMLInputElement;
		await waitFor(() => expect(name.value).toBe("리액트"));

		const tabs = within(panel())
			.getAllByRole("tab")
			.map((tab) => tab.getAttribute("aria-label"));
		expect(tabs).toEqual(["한국어", "영어 · 번역 있음", "일본어 · 번역 없음"]);
	});

	it("다른 언어 탭에서는 그 언어 이름만 고치고, 주소는 모든 언어가 같다고 알린다", async () => {
		const { onSaved } = renderPanel({ collection: "tag", id: "tag-1" });
		await screen.findByDisplayValue("리액트");

		fireEvent.click(within(panel()).getByRole("tab", { name: /일본어/ }));
		expect(screen.queryByRole("textbox", { name: "주소" })).toBeNull();
		expect(screen.getByText(/주소와 연결은 모든 언어가 같습니다/)).toBeTruthy();
		fireEvent.change(screen.getByRole("textbox", { name: "이름 (일본어)" }), { target: { value: "リアクト" } });
		expect(within(panel()).getByRole("tab", { name: "일본어 · 번역 있음" })).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		expect(bodyOf(calls("PATCH")[0])).toEqual({
			expectedVersion: 3,
			slug: "react",
			metadata: { title: "리액트", translations: { en: { title: "React" }, ja: { title: "リアクト" } } },
		});
		await waitFor(() => expect(onSaved).toHaveBeenCalled());
	});

	it("새 항목은 이름만으로 만든다", async () => {
		const { onSaved } = renderPanel({ collection: "tag", id: null });
		expect(screen.getByRole("heading", { name: "새 태그" })).toBeTruthy();
		fireEvent.change(screen.getByRole("textbox", { name: /이름/ }), { target: { value: "Vue" } });
		fireEvent.click(screen.getByRole("button", { name: "만들기" }));

		await waitFor(() => expect(calls("POST")).toHaveLength(1));
		expect(bodyOf(calls("POST")[0])).toEqual({ collection: "tag", slug: null, metadata: { title: "Vue" }, mdx: "" });
		await waitFor(() => expect(onSaved).toHaveBeenCalled());
	});

	it("저장하지 않은 변경이 있으면 한 번 알리고, 한 번 더 닫으면 버린다", async () => {
		const { onClose } = renderPanel({ collection: "tag", id: "tag-1" });
		fireEvent.change(await screen.findByDisplayValue("리액트"), { target: { value: "React!" } });

		fireEvent.click(within(panel()).getByRole("button", { name: "닫기" }));
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByRole("alert").textContent).toContain("저장하지 않은 변경이 있습니다");

		fireEvent.click(within(panel()).getByRole("button", { name: "변경 버리고 닫기" }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it("모음집은 글 목록을 기본 언어 탭에서 고친다", async () => {
		renderPanel({ collection: "collection", id: null });
		expect(await screen.findByRole("combobox", { name: "글 추가·빼기" })).toBeTruthy();
	});
});
