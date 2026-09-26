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
		if (input.endsWith("/relations")) return json({ incomingReferences: [] });
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
	it("loads, autosaves, publishes, and reopens the KST display date as UTC", async () => {
		let savedEntry = {
			...entry,
			publishedAt: "2020-01-04T16:15:00.000Z",
			working: {
				...entry.working,
				metadata: { ...entry.working.metadata, publishedAt: "2020-01-04T16:15:00.000Z" },
			},
		};
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input.endsWith("/relations")) return json({ incomingReferences: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(savedEntry);
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				savedEntry = {
					...savedEntry,
					version: 5,
					working: { ...savedEntry.working, metadata: body.metadata },
				};
				return json({ version: 5 });
			}
			if (input.endsWith("/publish")) {
				const body = JSON.parse(String(init?.body));
				savedEntry = { ...savedEntry, version: 6, status: "published", publishedAt: body.publishedAt };
				return json({ version: 6, warnings: [] });
			}
			throw new Error(`Unexpected fetch: ${input}`);
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		const publishDate = (await screen.findByLabelText("발행 일시 (서울 시간)")) as HTMLInputElement;
		expect(publishDate.value).toBe("2020-01-05T01:15");
		fireEvent.change(publishDate, { target: { value: "2020-02-03T04:05" } });
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));

		await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/publish"))).toBe(true));
		const patchCall = fetchMock.mock.calls.find(
			([input, init]) => String(input).endsWith("/entry-1") && init?.method === "PATCH",
		);
		const publishCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/publish"));
		expect(JSON.parse(String(patchCall?.[1]?.body)).metadata.publishedAt).toBe("2020-02-02T19:05:00.000Z");
		expect(JSON.parse(String(publishCall?.[1]?.body))).toEqual({
			expectedVersion: 5,
			publishedAt: "2020-02-02T19:05:00.000Z",
		});

		cleanup();
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		const reopenedDate = (await screen.findByLabelText("발행 일시 (서울 시간)")) as HTMLInputElement;
		expect(reopenedDate.value).toBe("2020-02-03T04:05");
	});

	it("shows draft and published incoming references with their locations", async () => {
		const references = [
			{
				state: "working",
				sourceId: "draft-source",
				sourceCollection: "post",
				sourceTitle: "Draft referrer",
				sourceSlug: "draft-referrer",
				kind: "tag",
				isStale: true,
				occurrences: [
					{ type: "mdx", line: 3, column: 2 },
					{ type: "metadata", path: "tagIds", ordinal: 0 },
				],
			},
			{
				state: "published",
				sourceId: "published-source",
				sourceCollection: "memo",
				sourceTitle: "Published referrer",
				sourceSlug: "published-referrer",
				kind: "tag",
				isStale: false,
				occurrences: [{ type: "mdx", line: 5, column: 1 }],
			},
		];
		const relationRequests = vi.fn();
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input.endsWith("/relations")) {
				relationRequests();
				return json({ incomingReferences: references });
			}
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
			throw new Error(`Unexpected fetch: ${input}`);
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);

		expect(await screen.findByRole("heading", { name: "초안에서 사용" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "현재 공개본에서 사용" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Draft referrer" }).getAttribute("href")).toBe(
			"/admin/entries/draft-source/edit",
		);
		expect(screen.getByText("본문 3:2")).toBeTruthy();
		expect(screen.getByText("tagIds · 1번째")).toBeTruthy();
		expect(screen.getByText("대상 변경 확인 필요")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "사용처 새로고침" }));
		await waitFor(() => expect(relationRequests).toHaveBeenCalledTimes(2));
	});

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
		expect(dialog.contains(document.activeElement)).toBe(true);
		expect(within(dialog).getByRole("button", { name: "로컬 복구본 불러오기" })).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "서버 본문 유지" }));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith("admin:entry-1"));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "임시 저장된 로컬 복구본 발견" })).toBeNull());
		expect(document.activeElement).toBe(document.getElementById("cms-publish"));
	});

	it("binds blocking fields and moves positioned issues to the MDX source", async () => {
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input.endsWith("/relations")) return json({ incomingReferences: [] });
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
			if (input.endsWith("/relations")) return json({ incomingReferences: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
			if (input.endsWith("/publish"))
				return json(
					{
						issues: [
							{ code: "missing_title", path: "title" },
							{ code: "mdx_error", position: { line: 2, column: 2 } },
						],
					},
					422,
				);
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
		expect(document.querySelector('textarea[aria-label="시각 본문"]')?.closest("[inert]")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: /MDX 본문 구문을 확인하세요.*수정할 곳으로 이동/ }));
		const source = (await screen.findByRole("textbox", { name: "MDX 본문" })) as HTMLTextAreaElement;
		await waitFor(() => expect(document.activeElement).toBe(source));
		expect(screen.queryByRole("textbox", { name: /제목 \(Title\)/ })).toBeNull();
		expect(source.closest("[inert]")).toBeNull();
		vi.unstubAllGlobals();
	});

	it("sends slugs when adding a category and tag from the inspector", async () => {
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input.endsWith("/relations")) return json({ incomingReferences: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
			if (init?.method === "PATCH") return json({ version: 5 });
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const data = JSON.parse(String(init.body));
				return json({ id: data.collection === "category" ? "cat-2" : "tag-2" }, 201);
			}
			throw new Error(`Unexpected fetch: ${input}`);
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		const categoryInput = await screen.findByPlaceholderText("새 카테고리 추가");
		fireEvent.change(categoryInput, { target: { value: "새 카테고리" } });
		fireEvent.click(screen.getByRole("button", { name: "추가" }));
		const categorySelect = await screen.findByRole("combobox", { name: /^카테고리/ });
		await waitFor(() => expect((categorySelect as HTMLSelectElement).value).toBe("cat-2"));
		expect(categorySelect.parentElement?.className).toContain("w-full");
		fireEvent.change(screen.getByPlaceholderText("새 태그 생성 후 즉시 추가"), { target: { value: "새 태그" } });
		fireEvent.click(screen.getByRole("button", { name: "생성" }));
		await waitFor(() => expect(screen.getAllByText("새 태그").length).toBeGreaterThan(0));
		const creations = fetchMock.mock.calls
			.filter(([input, init]) => input === "/api/cms/v1/entries" && init?.method === "POST")
			.map(([, init]) => JSON.parse(String(init?.body)));
		expect(creations).toEqual([
			expect.objectContaining({ collection: "category", slug: "새-카테고리" }),
			expect.objectContaining({ collection: "tag", slug: "새-태그" }),
		]);
	});

	it("stops publish after an autosave conflict and offers a copy/reload dialog", async () => {
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input.endsWith("/relations")) return json({ incomingReferences: [] });
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
		expect(dialog.contains(document.activeElement)).toBe(true);
		expect(within(dialog).getByRole("button", { name: "내 본문 복사" })).toBeTruthy();
		expect(within(dialog).getByRole("button", { name: "서버 최신본으로 새로고침" })).toBeTruthy();
		expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/publish"))).toBe(false);
		fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: /편집 충돌 발생/ })).toBeNull());
		expect(document.activeElement).toBe(document.getElementById("cms-publish"));
		fireEvent.click(screen.getByRole("button", { name: "예약" }));
		const scheduleDialog = await screen.findByRole("dialog", { name: "발행 예약" });
		fireEvent.change(within(scheduleDialog).getByLabelText("예약 일시 (서울 시간)"), {
			target: { value: "2027-01-01T12:00" },
		});
		fireEvent.click(within(scheduleDialog).getByRole("button", { name: "예약 등록" }));
		expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/schedule"))).toBe(false);
	});

	it("keeps a retryable backup for offline, server, and expired-session failures", async () => {
		const patchErrors = [
			new Error("offline"),
			json({ message: "server error" }, 500),
			json({ message: "session expired" }, 401),
		];
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input.endsWith("/relations")) return json({ incomingReferences: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(entry);
			if (init?.method === "PATCH") {
				const failure = patchErrors.shift();
				if (failure instanceof Error) throw failure;
				return failure;
			}
			throw new Error(`Unexpected fetch: ${input}`);
		});
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		const titleInput = (await screen.findByRole("textbox", { name: /제목 \(Title\)/ })) as HTMLInputElement;

		for (const [index, nextTitle] of ["오프라인 수정", "서버 오류 수정", "세션 만료 수정"].entries()) {
			fireEvent.change(titleInput, { target: { value: nextTitle } });
			await waitFor(
				() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(index + 1),
				{ timeout: 4000 },
			);
			await waitFor(() => expect(screen.getByText(index === 0 ? "오프라인" : "오류")).toBeTruthy());
		}

		expect(saveLocalBackup).toHaveBeenCalledTimes(3);
		expect(saveLocalBackup).toHaveBeenLastCalledWith(
			expect.objectContaining({ snapshot: expect.objectContaining({ title: "세션 만료 수정" }) }),
		);
	});

	it("does not resend an old backup after a save succeeded but its response was lost", async () => {
		let serverEntry = { ...entry };
		let localBackup: unknown;
		saveLocalBackup.mockImplementation(async (backup) => {
			localBackup = backup;
		});
		fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
			if (input.includes("?collection=")) return json({ items: [] });
			if (input.endsWith("/relations")) return json({ incomingReferences: [] });
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(serverEntry);
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				serverEntry = {
					...serverEntry,
					version: 5,
					working: { ...serverEntry.working, metadata: body.metadata, mdx: body.mdx },
				};
				throw new Error("PATCH committed, response lost");
			}
			throw new Error(`Unexpected fetch: ${input}`);
		});

		const firstRender = render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		const titleInput = (await screen.findByRole("textbox", { name: /제목 \(Title\)/ })) as HTMLInputElement;
		fireEvent.change(titleInput, { target: { value: "응답 유실 수정" } });
		await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true), {
			timeout: 4000,
		});
		await waitFor(() => expect(screen.getByText("오프라인")).toBeTruthy(), { timeout: 4000 });
		expect(localBackup).toBeTruthy();
		firstRender.unmount();

		getLocalBackup.mockResolvedValue(localBackup);
		const patchCountBeforeReload = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH").length;
		render(<EntryEditorShell mode="edit" initialEntryId="entry-1" />);
		await waitFor(() => expect(screen.getByDisplayValue("응답 유실 수정")).toBeTruthy());
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith("admin:entry-1"));
		expect(screen.queryByRole("dialog", { name: "임시 저장된 로컬 복구본 발견" })).toBeNull();
		expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(patchCountBeforeReload);
	});
});
