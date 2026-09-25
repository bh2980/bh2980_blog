import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EntryEditorShell } from "../entry-editor-shell";

const { getLocalBackup, deleteLocalBackup, saveLocalBackup, success, warning } = vi.hoisted(() => ({
	getLocalBackup: vi.fn(),
	deleteLocalBackup: vi.fn(),
	saveLocalBackup: vi.fn(),
	success: vi.fn(),
	warning: vi.fn(),
}));
vi.mock("../[id]/edit/indexed-db", () => ({ getLocalBackup, deleteLocalBackup, saveLocalBackup }));
vi.mock("@/cms/editor/tiptap-editor", () => ({ CmsEditor: () => <textarea aria-label="시각 본문" readOnly /> }));
vi.mock("sonner", () => ({ Toaster: () => null, toast: { success, warning } }));

const entry = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	workingSlug: "test",
	working: { metadata: { title: "테스트", categoryId: "cat-1" }, mdx: "첫째 줄\n둘째 줄" },
};

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
	getLocalBackup.mockResolvedValue(null);
	deleteLocalBackup.mockResolvedValue(undefined);
	saveLocalBackup.mockResolvedValue(undefined);
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		if (input.includes("?collection=")) return json({ items: [] });
		if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
		if (input.endsWith("/publish")) return json({ version: 5, warnings: [] });
		throw new Error(`Unexpected fetch: ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("live entry editor M10 feedback", () => {
	it("renders the recoverable backup as an accessible dialog", async () => {
		getLocalBackup.mockResolvedValue({
			key: "admin:entry-1",
			entryId: "entry-1",
			baseVersion: 4,
			baseFingerprint: "테스트:::test:::첫째 줄\n둘째 줄",
			localFingerprint: "수정:::test:::첫째 줄\n둘째 줄",
			snapshot: { title: "수정", slug: "test", metadata: {}, mdx: "첫째 줄\n둘째 줄" },
			changeSeq: 1,
			savedAt: Date.now(),
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		const dialog = await screen.findByRole("dialog", { name: "임시 저장된 로컬 복구본 발견" });
		expect(within(dialog).getByRole("button", { name: "로컬 복구본 불러오기" })).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "서버 본문 유지" }));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith("admin:entry-1"));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "임시 저장된 로컬 복구본 발견" })).toBeNull());
	});

	it("binds blocking fields and moves positioned issues to the MDX source", async () => {
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
			if (input.endsWith("/publish"))
				return json(
					{
						code: "publish_validation_failed",
						issues: [
							{ code: "missing_title", path: "title" },
							{ code: "mdx_error", path: "mdx", position: { line: 2, column: 2 } },
						],
					},
					422,
				);
			throw new Error(`Unexpected fetch: ${input}`);
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		await screen.findByDisplayValue("테스트");
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));
		await screen.findByRole("alert");
		const title = screen.getByRole("textbox", { name: /제목 \(Title\)/ });
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(title.getAttribute("aria-describedby")).toBe("cms-title-error");
		fireEvent.click(screen.getByRole("button", { name: /MDX 본문 구문을 확인하세요.*수정할 곳으로 이동/ }));
		const source = (await screen.findByRole("textbox", { name: "MDX 본문" })) as HTMLTextAreaElement;
		await waitFor(() => expect(document.activeElement).toBe(source));
		expect(source.selectionStart).toBe("첫째 줄\n".length + 1);
		expect(source.getAttribute("aria-invalid")).toBe("true");
	});

	it("keeps the editor usable at narrow widths and opens the inspector on field errors", async () => {
		vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
			if (input.endsWith("/publish")) return json({ issues: [{ code: "missing_title", path: "title" }] }, 422);
			throw new Error(`Unexpected fetch: ${input}`);
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		await screen.findByRole("button", { name: "발행하기" });
		expect(screen.queryByRole("textbox", { name: /제목 \(Title\)/ })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));
		const issueButton = await screen.findByRole("button", { name: /제목을 입력하세요.*수정할 곳으로 이동/ });
		fireEvent.click(issueButton);
		const title = await screen.findByRole("textbox", { name: /제목 \(Title\)/ });
		await waitFor(() => expect(document.activeElement).toBe(title));
		vi.unstubAllGlobals();
	});

	it("stops publish after an autosave conflict and offers a copy/reload dialog", async () => {
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
			if (init?.method === "PATCH") return json({ code: "conflict" }, 409);
			if (input.endsWith("/publish")) throw new Error("Publish must not run after conflict");
			throw new Error(`Unexpected fetch: ${input}`);
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		const title = await screen.findByRole("textbox", { name: /제목 \(Title\)/ });
		fireEvent.change(title, { target: { value: "로컬 수정" } });
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));
		const dialog = await screen.findByRole("dialog", { name: /편집 충돌 발생/ });
		expect(within(dialog).getByRole("button", { name: "내 본문 복사" })).toBeTruthy();
		expect(within(dialog).getByRole("button", { name: "서버 최신본으로 새로고침" })).toBeTruthy();
		expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/publish"))).toBe(false);
		fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
		fireEvent.click(screen.getByRole("button", { name: "예약" }));
		const scheduleDialog = await screen.findByRole("dialog", { name: "발행 예약" });
		fireEvent.change(within(scheduleDialog).getByLabelText("예약 일시 (서울 시간)"), {
			target: { value: "2027-01-01T12:00" },
		});
		fireEvent.click(within(scheduleDialog).getByRole("button", { name: "예약 등록" }));
		expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/schedule"))).toBe(false);
	});
});
