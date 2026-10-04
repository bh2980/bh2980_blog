import type { EntryActionContext } from "@bh2980/cms-admin";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@bh2980/cms-admin/ui/dropdown-menu";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleAction } from "../admin/provider";

const { success, error } = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success, error } }));

const ENTRY_ID = "entry-1";
const pending = {
	id: "s1",
	status: "pending",
	scheduledAt: "2099-01-01T00:00:00.000Z",
	createdAt: "2026-01-01T00:00:00.000Z",
	completedAt: null,
	failureCode: null,
	failureDetail: null,
};

const json = (data: unknown, status = 200) => ({ ok: status < 400, status, json: async () => data });
let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string) =>
	fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method) as [string, RequestInit][];

interface HarnessProps {
	readonly lockedBy?: string | null;
	readonly saved?: boolean;
	readonly reload?: () => Promise<void>;
	readonly showIssues?: EntryActionContext["showIssues"];
}

/** 편집 화면 대신 확장 결과를 자리마다 그린다. */
function Harness({ lockedBy = null, saved = true, reload = async () => {}, showIssues = () => {} }: HarnessProps) {
	const [busy, setBusy] = useState(false);
	const result = scheduleAction.use({
		entry: { id: ENTRY_ID, version: 4, lockedBy } as never,
		collection: "post",
		getVersion: () => 4,
		ensureSaved: async (purpose, report) => {
			if (saved) return ENTRY_ID;
			report?.(`변경사항을 먼저 저장한 후 ${purpose}하세요.`);
			return null;
		},
		reload,
		showIssues,
		busy,
		setBusy,
	});
	return (
		<>
			<div data-testid="notice">{result.notice}</div>
			<div data-testid="locked">{result.lockedAction}</div>
			<DropdownMenu>
				<DropdownMenuTrigger>발행 방식</DropdownMenuTrigger>
				<DropdownMenuContent>{result.publishMenu}</DropdownMenuContent>
			</DropdownMenu>
			{result.overlay}
		</>
	);
}

const openDialog = async () => {
	fireEvent.click(screen.getByRole("button", { name: "발행 방식" }));
	fireEvent.click(await screen.findByRole("menuitem", { name: "발행 예약" }));
	return screen.findByRole("dialog", { name: "발행 예약" });
};

beforeEach(() => {
	vi.clearAllMocks();
	fetchMock = vi.fn(async () => json({ pending: null, last: null, runnerConfigured: true }));
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("편집 화면 발행 예약", () => {
	it("미래 시각만 받고, 예약하면 글을 다시 불러온다", async () => {
		const reload = vi.fn(async () => {});
		render(<Harness reload={reload} />);
		const dialog = await openDialog();
		const input = within(dialog).getByLabelText("예약 일시");

		fireEvent.change(input, { target: { value: "2000-01-01T09:00" } });
		fireEvent.click(within(dialog).getByRole("button", { name: "예약" }));
		expect((await within(dialog).findByRole("alert")).textContent).toBe("예약은 미래 시각만 지정할 수 있습니다.");
		expect(calls("POST")).toHaveLength(0);

		fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
			init?.method === "POST" ? json({ id: "s1", status: "pending" }, 201) : json({ pending: null, last: null }),
		);
		fireEvent.change(input, { target: { value: "2099-01-01T09:00" } });
		fireEvent.click(within(dialog).getByRole("button", { name: "예약" }));

		await waitFor(() => expect(calls("POST")).toHaveLength(1));
		expect(calls("POST")[0]?.[0]).toBe(`/api/cms/v1/entries/${ENTRY_ID}/schedule`);
		expect(JSON.parse(String(calls("POST")[0]?.[1]?.body))).toEqual({
			expectedVersion: 4,
			scheduledAt: "2099-01-01T00:00:00.000Z",
		});
		await waitFor(() => expect(reload).toHaveBeenCalled());
		expect(success).toHaveBeenCalledWith("2099-01-01 09:00에 발행하도록 예약했습니다.");
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "발행 예약" })).toBeNull());
	});

	it("저장하지 않은 변경이 있으면 예약하지 않고 창 안에 알린다", async () => {
		render(<Harness saved={false} />);
		const dialog = await openDialog();
		fireEvent.change(within(dialog).getByLabelText("예약 일시"), { target: { value: "2099-01-01T09:00" } });
		fireEvent.click(within(dialog).getByRole("button", { name: "예약" }));
		expect((await within(dialog).findByRole("alert")).textContent).toBe("변경사항을 먼저 저장한 후 예약하세요.");
		expect(calls("POST")).toHaveLength(0);
	});

	it("발행 검사에 걸리면 창을 닫고 편집 화면 문제 목록으로 넘긴다", async () => {
		const showIssues = vi.fn();
		fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
			init?.method === "POST"
				? json(
						{
							code: "validation_failed",
							message: "발행할 수 없습니다.",
							issues: [{ code: "missing_field", path: "categoryId", message: "카테고리" }],
						},
						422,
					)
				: json({ pending: null, last: null }),
		);
		render(<Harness showIssues={showIssues} />);
		const dialog = await openDialog();
		fireEvent.change(within(dialog).getByLabelText("예약 일시"), { target: { value: "2099-01-01T09:00" } });
		fireEvent.click(within(dialog).getByRole("button", { name: "예약" }));
		await waitFor(() => expect(showIssues).toHaveBeenCalledWith([expect.objectContaining({ path: "categoryId" })]));
		await waitFor(() => expect(screen.queryByRole("dialog", { name: "발행 예약" })).toBeNull());
	});

	it("예약이 걸린 글은 안내 띠를 보이고 예약 해제로 풀린다", async () => {
		const reload = vi.fn(async () => {});
		fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
			init?.method === "DELETE"
				? json({ id: "s1", status: "cancelled" })
				: json({ pending, last: null, runnerConfigured: false }),
		);
		render(<Harness lockedBy="schedule" reload={reload} />);
		const banner = await screen.findByRole("region", { name: "예약" });
		expect(within(banner).getByText(/2099-01-01 09:00 발행 예약됨/)).toBeTruthy();
		expect(within(banner).getByText(/외부 실행기 연결 필요/)).toBeTruthy();

		fireEvent.click(within(screen.getByTestId("locked")).getByRole("button", { name: "예약 해제" }));
		await waitFor(() => expect(calls("DELETE")).toHaveLength(1));
		expect(calls("DELETE")[0]?.[0]).toBe(`/api/cms/v1/entries/${ENTRY_ID}/schedule?scheduleId=s1`);
		await waitFor(() => expect(reload).toHaveBeenCalled());
		expect(success).toHaveBeenCalledWith("예약을 해제했습니다. 이제 편집할 수 있습니다.");
	});

	it("마지막 예약이 실패했으면 알린다", async () => {
		fetchMock.mockImplementation(async () =>
			json({
				pending: null,
				last: { ...pending, status: "failed", failureCode: "publish_validation_failed", failureDetail: "링크" },
				runnerConfigured: true,
			}),
		);
		render(<Harness />);
		expect((await screen.findByRole("alert")).textContent).toContain("예약 발행이 실패해 공개본을 그대로 유지했습니다");
	});
});
