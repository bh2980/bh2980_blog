import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EntryEditorShell } from "../entry-editor-shell";
import { EMPTY_FORM, formFingerprint, formFromEntry } from "../entry-form";

const { getLocalBackup, deleteLocalBackup, saveLocalBackup, success, warning, message, routerReplace, routerPush } =
	vi.hoisted(() => ({
		getLocalBackup: vi.fn(),
		deleteLocalBackup: vi.fn(),
		saveLocalBackup: vi.fn(),
		success: vi.fn(),
		warning: vi.fn(),
		message: vi.fn(),
		routerReplace: vi.fn(),
		routerPush: vi.fn(),
	}));
vi.mock("../local-backup", async (importOriginal) => ({
	...(await importOriginal<typeof import("../local-backup")>()),
	getLocalBackup,
	deleteLocalBackup,
	saveLocalBackup,
}));
vi.mock("@/cms/editor/tiptap-editor", () => ({
	CmsEditor: ({ editable }: { editable?: boolean }) => (
		<textarea aria-label="시각 본문" readOnly={editable === false} />
	),
}));
vi.mock("sonner", () => ({ Toaster: () => null, toast: { success, warning, message } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: routerReplace, push: routerPush }) }));

const ADMIN = "u1";
const entry = {
	id: "entry-1",
	collection: "post",
	status: "draft",
	version: 4,
	folderId: null,
	workingSlug: "test",
	publishedSlug: null,
	working: { metadata: { title: "테스트", categoryId: "cat-1", summary: "요약" }, mdx: "첫째 줄\n둘째 줄" },
	schedule: { pending: null, last: null, runnerConfigured: true },
};

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
type Handler = (input: string, init?: RequestInit) => unknown;
let fetchMock: ReturnType<typeof vi.fn>;

/** 공통 응답(목록·사용처)에 테스트별 처리를 덧붙인다. */
function serve(handler: Handler, current: unknown = entry) {
	fetchMock.mockImplementation(async (input: string, init?: RequestInit) => {
		const handled = await handler(input, init);
		if (handled !== undefined) return handled;
		if (input.startsWith("/api/cms/v1/entries?")) return json({ items: [], total: 0 });
		if (input.endsWith("/relations")) return json({ incomingReferences: [] });
		if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(current);
		throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${input}`);
	});
}

const methodCalls = (method: string, suffix = "") =>
	fetchMock.mock.calls.filter(([input, init]) => init?.method === method && String(input).endsWith(suffix));

const renderEdit = () => render(<EntryEditorShell mode="edit" initialEntryId="entry-1" adminId={ADMIN} />);
const inspectorTitle = () => screen.findByRole("textbox", { name: /^제목/ });

beforeEach(() => {
	vi.clearAllMocks();
	getLocalBackup.mockResolvedValue(null);
	deleteLocalBackup.mockResolvedValue(undefined);
	saveLocalBackup.mockResolvedValue(true);
	fetchMock = vi.fn();
	serve(() => undefined);
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("entry editor shell", () => {
	it("saves the KST display date in draft metadata and publishes with only the version", async () => {
		let saved = {
			...entry,
			working: { ...entry.working, metadata: { ...entry.working.metadata, publishedAt: "2020-01-04T16:15:00.000Z" } },
		};
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(saved);
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				saved = { ...saved, version: 5, working: { ...saved.working, metadata: body.metadata } };
				return json(saved);
			}
			if (input.endsWith("/publish")) return json({ ...saved, version: 6, status: "published", warnings: [] });
		});
		renderEdit();
		const publishDate = (await screen.findByLabelText(/표시 발행일/)) as HTMLInputElement;
		expect(publishDate.value).toBe("2020-01-05T01:15");
		fireEvent.change(publishDate, { target: { value: "2020-02-03T04:05" } });
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));

		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.publishedAt).toBe(
			"2020-02-02T19:05:00.000Z",
		);
		expect(JSON.parse(String(methodCalls("POST", "/publish")[0]?.[1]?.body))).toEqual({ expectedVersion: 5 });

		cleanup();
		renderEdit();
		expect(((await screen.findByLabelText(/표시 발행일/)) as HTMLInputElement).value).toBe("2020-02-03T04:05");
	});

	it("shows draft and published incoming references with their locations", async () => {
		const relationRequests = vi.fn();
		serve((input) => {
			if (!input.endsWith("/relations")) return undefined;
			relationRequests();
			return json({
				incomingReferences: [
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
				],
			});
		});
		renderEdit();
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

	it("offers a same-version browser backup and deletes it when the server copy is kept", async () => {
		const server = formFromEntry(entry as never);
		getLocalBackup.mockResolvedValue({
			key: `${ADMIN}:entry-1`,
			entryId: "entry-1",
			baseVersion: 4,
			baseFingerprint: formFingerprint(server),
			localFingerprint: formFingerprint({ ...server, title: "수정" }),
			snapshot: { ...server, title: "수정" },
			changeSeq: 1,
			savedAt: Date.now(),
		});
		renderEdit();
		const dialog = await screen.findByRole("dialog", { name: "브라우저 복구본 발견" });
		expect(within(dialog).getByRole("button", { name: "복구본 불러오기" })).toBeTruthy();
		fireEvent.click(within(dialog).getByRole("button", { name: "서버 내용 유지 (복구본 삭제)" }));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
	});

	it("shows both sides instead of restoring a backup made before the server changed", async () => {
		const server = formFromEntry(entry as never);
		getLocalBackup.mockResolvedValue({
			key: `${ADMIN}:entry-1`,
			entryId: "entry-1",
			baseVersion: 3,
			baseFingerprint: "old",
			localFingerprint: formFingerprint({ ...server, mdx: "브라우저 본문" }),
			snapshot: { ...server, mdx: "브라우저 본문" },
			changeSeq: 1,
			savedAt: Date.now(),
		});
		renderEdit();
		const dialog = await screen.findByRole("dialog", { name: /복구본과 서버 내용이 모두 바뀌었습니다/ });
		expect(within(dialog).getByText("브라우저 본문")).toBeTruthy();
		expect(within(dialog).queryByRole("button", { name: "복구본 불러오기" })).toBeNull();
	});

	it("binds field issues and moves positioned issues to the MDX source", async () => {
		serve((input) =>
			input.endsWith("/publish")
				? json(
						{
							code: "publish_validation_failed",
							issues: [
								{ code: "missing_title", path: "title" },
								{ code: "mdx_error", path: "mdx", position: { line: 2, column: 2 } },
							],
						},
						422,
					)
				: undefined,
		);
		renderEdit();
		await screen.findByDisplayValue("요약");
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));
		await screen.findByRole("list", { name: "발행 검증 문제" });
		const title = await inspectorTitle();
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(title.getAttribute("aria-describedby")).toBe("cms-title-error");
		fireEvent.click(screen.getByRole("button", { name: /MDX 본문 구문을 확인하세요.*수정할 곳으로 이동/ }));
		const source = (await screen.findByRole("textbox", { name: "MDX 본문" })) as HTMLTextAreaElement;
		await waitFor(() => expect(document.activeElement).toBe(source));
		expect(source.selectionStart).toBe("첫째 줄\n".length + 1);
	});

	it("opens unparseable MDX in source mode and does not allow the visual editor (no silent overwrite)", async () => {
		serve(() => undefined, { ...entry, working: { ...entry.working, mdx: "본문 <Callout>닫히지 않음" } });
		renderEdit();
		const source = (await screen.findByRole("textbox", { name: "MDX 본문" })) as HTMLTextAreaElement;
		expect(source.value).toBe("본문 <Callout>닫히지 않음");
		expect(screen.queryByLabelText("시각 본문")).toBeNull();
		expect((screen.getByRole("button", { name: "시각 모드" }) as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByText(/원문 모드로만 편집합니다/)).toBeTruthy();
	});

	it("keeps the editor usable at narrow widths and opens the inspector on field errors", async () => {
		vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
		serve((input) =>
			input.endsWith("/publish")
				? json({ issues: [{ code: "missing_category", path: "categoryId" }] }, 422)
				: undefined,
		);
		renderEdit();
		await screen.findByRole("button", { name: "발행하기" });
		expect(screen.queryByRole("textbox", { name: /^제목/ })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));
		fireEvent.click(await screen.findByRole("button", { name: /카테고리를 지정하세요.*수정할 곳으로 이동/ }));
		const category = await screen.findByRole("combobox", { name: /카테고리/ });
		await waitFor(() => expect(document.activeElement).toBe(category));
		expect(screen.getByLabelText("시각 본문").closest("[inert]")).toBeTruthy();
	});

	it("creates categories and tags from their name alone (the server derives the slug)", async () => {
		serve((input, init) => {
			if (init?.method === "PATCH") return json({ ...entry, version: 5 });
			if (input === "/api/cms/v1/entries" && init?.method === "POST") {
				const data = JSON.parse(String(init.body));
				return json({ id: data.collection === "category" ? "cat-2" : "tag-2", publishedSlug: "slug" }, 201);
			}
		});
		renderEdit();
		fireEvent.change(await screen.findByLabelText("새 카테고리 이름"), { target: { value: "새 카테고리" } });
		fireEvent.click(screen.getByRole("button", { name: "추가" }));
		// Base UI Select는 네이티브 select가 아니라 트리거에 고른 항목 이름을 보여 준다.
		await waitFor(() =>
			expect(screen.getByRole("combobox", { name: /카테고리/ }).textContent).toContain("새 카테고리"),
		);
		fireEvent.change(screen.getByLabelText("새 태그 이름"), { target: { value: "새 태그" } });
		fireEvent.click(screen.getByRole("button", { name: "생성" }));
		await waitFor(() => expect(screen.getAllByText("새 태그").length).toBeGreaterThan(0));
		const creations = methodCalls("POST", "/api/cms/v1/entries").map(([, init]) => JSON.parse(String(init?.body)));
		expect(creations).toEqual([
			{ collection: "category", metadata: { title: "새 카테고리" }, mdx: "" },
			{ collection: "tag", metadata: { title: "새 태그" }, mdx: "" },
		]);
	});

	it("stops publishing after an autosave conflict and offers copy, reload and overwrite", async () => {
		serve((input, init) => {
			if (init?.method === "PATCH") return json({ code: "conflict", serverVersion: 9 }, 409);
			if (input.endsWith("/publish")) throw new Error("Publish must not run after conflict");
		});
		renderEdit();
		fireEvent.change(await inspectorTitle(), { target: { value: "로컬 수정" } });
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));
		const dialog = await screen.findByRole("dialog", { name: /편집 충돌/ });
		expect(within(dialog).getAllByRole("button", { name: "본문 복사" })).toHaveLength(2);
		expect(within(dialog).getByRole("button", { name: "서버 최신본으로 다시 열기" })).toBeTruthy();
		expect(within(dialog).getByRole("button", { name: "내 내용으로 덮어쓰기" })).toBeTruthy();
		expect(methodCalls("POST", "/publish")).toHaveLength(0);
	});

	it("reports offline, server and expired-session failures and keeps a browser backup", async () => {
		const failures: unknown[] = [
			new TypeError("offline"),
			json({ message: "server error" }, 500),
			json({ code: "unauthorized" }, 401),
		];
		serve((_input, init) => {
			if (init?.method !== "PATCH") return undefined;
			const failure = failures.shift();
			if (failure instanceof Error) throw failure;
			return failure;
		});
		renderEdit();
		const title = await inspectorTitle();
		const expected = ["브라우저에만 임시 저장됨", "브라우저에만 임시 저장됨", "세션 만료 — 다시 로그인하세요"];
		for (const [index, value] of ["오프라인 수정", "서버 오류 수정", "세션 만료 수정"].entries()) {
			fireEvent.change(title, { target: { value } });
			fireEvent.keyDown(window, { key: "s", metaKey: true });
			await waitFor(() => expect(methodCalls("PATCH").length).toBeGreaterThanOrEqual(index + 1), { timeout: 4000 });
			await waitFor(() => expect(screen.getByText(expected[index] as string)).toBeTruthy());
		}
		expect(screen.getByRole("button", { name: "다시 시도" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "새 창에서 로그인" })).toBeTruthy();
		expect(saveLocalBackup).toHaveBeenLastCalledWith(
			expect.objectContaining({
				key: `${ADMIN}:entry-1`,
				snapshot: expect.objectContaining({ title: "세션 만료 수정", summary: "요약" }),
			}),
		);
	});

	it("drops a backup that already matches the server after a lost save response", async () => {
		let server = { ...entry };
		let backup: unknown;
		saveLocalBackup.mockImplementation(async (record) => {
			backup = record;
			return true;
		});
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(server);
			if (init?.method === "PATCH") {
				const body = JSON.parse(String(init.body));
				server = { ...server, version: 5, working: { ...server.working, metadata: body.metadata, mdx: body.mdx } };
				throw new TypeError("committed, response lost");
			}
		});
		const first = renderEdit();
		fireEvent.change(await inspectorTitle(), { target: { value: "응답 유실 수정" } });
		fireEvent.keyDown(window, { key: "s", ctrlKey: true });
		await waitFor(() => expect(methodCalls("PATCH")).toHaveLength(1));
		first.unmount();

		getLocalBackup.mockResolvedValue(backup);
		renderEdit();
		await waitFor(() => expect(screen.getAllByDisplayValue("응답 유실 수정").length).toBeGreaterThan(0));
		await waitFor(() => expect(deleteLocalBackup).toHaveBeenCalledWith(`${ADMIN}:entry-1`));
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(methodCalls("PATCH")).toHaveLength(1);
	});

	it("locks a scheduled entry and unlocks it with 예약 해제 후 편집", async () => {
		let current: Record<string, unknown> & {
			schedule: { pending: unknown; last: unknown; runnerConfigured: boolean };
		} = {
			...entry,
			schedule: {
				pending: {
					id: "s1",
					status: "pending",
					scheduledAt: "2099-01-01T00:00:00.000Z",
					completedAt: null,
					failureCode: null,
					failureDetail: null,
				},
				last: null,
				runnerConfigured: false,
			},
		};
		serve((input, init) => {
			if (input === "/api/cms/v1/entries/entry-1" && !init?.method) return json(current);
			if (init?.method === "DELETE" && input.includes("/schedule?scheduleId=s1")) {
				current = { ...current, version: 5, schedule: { ...current.schedule, pending: null } };
				return json({ id: "s1", status: "cancelled" });
			}
		});
		renderEdit();
		const banner = await screen.findByRole("region", { name: "예약" });
		expect(within(banner).getByText(/외부 실행기 연결 필요/)).toBeTruthy();
		expect(((await inspectorTitle()) as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);
		expect((screen.getByRole("button", { name: "발행하기" }) as HTMLButtonElement).disabled).toBe(true);
		fireEvent.click(within(banner).getByRole("button", { name: "예약 해제 후 편집" }));
		await waitFor(() => expect(screen.queryByRole("region", { name: "예약" })).toBeNull());
		expect((screen.getByRole("button", { name: "발행하기" }) as HTMLButtonElement).disabled).toBe(false);
	});

	it("fills an empty post summary from the body before publishing", async () => {
		serve(
			(input, init) => {
				if (init?.method === "PATCH") return json({ ...entry, version: 5 });
				if (input.endsWith("/publish")) return json({ ...entry, version: 6, status: "published", warnings: [] });
			},
			{
				...entry,
				working: { metadata: { title: "테스트", categoryId: "cat-1" }, mdx: "## 소개\n\n**본문** 첫 문장." },
			},
		);
		renderEdit();
		expect(await screen.findByText(/비워 두면 발행할 때 본문에서 만듭니다/)).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "발행하기" }));
		await waitFor(() => expect(methodCalls("POST", "/publish")).toHaveLength(1));
		expect(JSON.parse(String(methodCalls("PATCH")[0]?.[1]?.body)).metadata.summary).toBe("소개 본문 첫 문장.");
	});

	it("shows trashed entries read-only with restore and permanent delete", async () => {
		serve(() => undefined, { ...entry, status: "trashed" });
		renderEdit();
		const banner = await screen.findByRole("region", { name: "휴지통" });
		expect(within(banner).getByRole("button", { name: "복원" })).toBeTruthy();
		expect(within(banner).getByRole("button", { name: "영구 삭제" })).toBeTruthy();
		expect((screen.getByLabelText("시각 본문") as HTMLTextAreaElement).readOnly).toBe(true);
	});

	it("sends record collections to their explicit-save form", async () => {
		serve(() => undefined, { ...entry, collection: "tag" });
		renderEdit();
		await waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/admin?collection=tag"));
		expect(EMPTY_FORM.title).toBe("");
	});
});
