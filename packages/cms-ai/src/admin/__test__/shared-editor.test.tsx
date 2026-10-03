// @vitest-environment jsdom
import { useConfirm } from "@bh2980/cms-admin/confirm-dialog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiSharedView } from "../../shared";
import { SharedManager } from "../shared-editor";

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

const VIEW: AiSharedView = {
	version: 2,
	items: [
		{ source: "config", key: "styleGuide", label: "문체 가이드", defaultText: "기본", text: "고침", overridden: true },
		{ source: "added", key: "tone", label: "말투", text: "정중하게" },
	],
};

let view: AiSharedView;
let fetchMock: ReturnType<typeof vi.fn>;
const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method);
const bodyOf = (call: unknown[] | undefined) => JSON.parse(String((call?.[1] as RequestInit).body));

beforeEach(() => {
	view = VIEW;
	fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
		if (input === "/api/cms/v1/ai/shared" && !init?.method) return json(view);
		if (input === "/api/cms/v1/ai/shared" && init?.method === "POST") {
			const body = JSON.parse(String(init.body));
			return json(
				{ version: 3, items: [...view.items, { source: "added", key: body.key, label: body.label, text: body.text }] },
				201,
			);
		}
		if (input === "/api/cms/v1/ai/shared" && init?.method === "PATCH") return json({ ...view, version: 3 });
		if (input.startsWith("/api/cms/v1/ai/shared?") && init?.method === "DELETE") {
			return json(
				{ code: "ai_invalid_input", message: "이 문구를 쓰는 기능이 있어 삭제할 수 없습니다: 요약 만들기" },
				400,
			);
		}
		throw new Error(`Unexpected fetch ${init?.method ?? "GET"} ${input}`);
	});
	vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** AI 화면처럼 연 문구를 들고, 저장하지 않은 내용이 있으면 묻는다. */
function Harness() {
	const [selected, setSelected] = useState<string | "new" | null>(null);
	const [dirty, setDirty] = useState(false);
	const { confirmDiscard, dialog } = useConfirm();
	return (
		<>
			<button type="button" onClick={async () => (await confirmDiscard(dirty)) && setSelected("new")}>
				머리 추가
			</button>
			<SharedManager
				selected={selected}
				onOpen={async (key) => {
					if (key !== selected && (await confirmDiscard(dirty))) setSelected(key);
				}}
				onSelectedChange={setSelected}
				onDirtyChange={setDirty}
			/>
			{dialog}
		</>
	);
}

const renderManager = () =>
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<Harness />
		</QueryClientProvider>,
	);
const list = () => screen.getByRole("list", { name: "공통 문구 목록" });
const row = (name: string) => within(list()).getByRole("button", { name: new RegExp(name) });

describe("AI 화면 공통 문구 탭", () => {
	it("목록과 빈 상세를 보이고, 고른 문구를 열린 줄로 표시한다", async () => {
		renderManager();
		await screen.findByText("문구를 고르세요");
		expect(
			within(list())
				.getAllByRole("button")
				.map((item) => item.textContent),
		).toEqual(["문체 가이드{{shared.styleGuide}}", "말투{{shared.tone}} · 직접 만듦"]);
		expect(screen.getByRole("button", { name: "문구 추가" })).toBeTruthy();

		fireEvent.click(row("문체 가이드"));
		expect(await screen.findByRole("heading", { name: "문체 가이드" })).toBeTruthy();
		expect(row("문체 가이드").getAttribute("aria-current")).toBe("true");
		// 설정 문구: 이름은 설정이 정하고, 기본값으로 되돌릴 수 있으며 삭제는 없다.
		expect((screen.getByRole("textbox", { name: "이름" }) as HTMLInputElement).disabled).toBe(true);
		expect(screen.getByText("{{shared.styleGuide}}", { selector: "code" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "복사" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "기본값으로" }));
		expect((screen.getByRole("textbox", { name: "내용" }) as HTMLTextAreaElement).value).toBe("기본");

		fireEvent.click(screen.getByRole("button", { name: "저장" }));
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1));
		expect(bodyOf(calls("PATCH")[0])).toEqual({ expectedVersion: 2, key: "styleGuide", text: "기본" });
	});

	it("저장하지 않은 내용이 있으면 다른 문구를 열기 전에 묻는다", async () => {
		renderManager();
		fireEvent.click(await screen.findByRole("button", { name: /말투/ }));
		fireEvent.change(await screen.findByRole("textbox", { name: "내용" }), { target: { value: "바꿈" } });
		fireEvent.click(row("문체 가이드"));
		expect(await screen.findByRole("alertdialog", { name: "저장하지 않은 내용" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "취소" }));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(screen.getByRole("heading", { name: "말투" })).toBeTruthy();
	});

	it("새 문구는 키·이름·내용을 적어 저장하고, 저장한 문구를 연 채 둔다", async () => {
		renderManager();
		await screen.findByText("문구를 고르세요");
		fireEvent.click(screen.getByRole("button", { name: "문구 추가" }));
		const save = (await screen.findByRole("button", { name: "저장" })) as HTMLButtonElement;
		expect(save.disabled).toBe(true);
		fireEvent.change(screen.getByRole("textbox", { name: "이름" }), { target: { value: "독자" } });
		fireEvent.change(screen.getByRole("textbox", { name: "키" }), { target: { value: "reader" } });
		fireEvent.change(screen.getByRole("textbox", { name: "내용" }), { target: { value: "개발자" } });
		fireEvent.click(save);
		await waitFor(() => expect(calls("POST")).toHaveLength(1));
		expect(bodyOf(calls("POST")[0])).toEqual({ expectedVersion: 2, key: "reader", label: "독자", text: "개발자" });
		await waitFor(() => expect(row("독자").getAttribute("aria-current")).toBe("true"));
		expect(screen.getByText("{{shared.reader}}", { selector: "code" })).toBeTruthy();
	});

	it("더한 문구는 삭제를 묻고, 막히면 칸 안에 이유를 보인다", async () => {
		renderManager();
		fireEvent.click(await screen.findByRole("button", { name: /말투/ }));
		expect(screen.queryByRole("button", { name: "기본값으로" })).toBeNull();
		fireEvent.click(await screen.findByRole("button", { name: "삭제" }));
		const dialog = await screen.findByRole("alertdialog", { name: "문구 삭제" });
		fireEvent.click(within(dialog).getByRole("button", { name: "삭제" }));
		expect((await screen.findByRole("alert")).textContent).toBe(
			"이 문구를 쓰는 기능이 있어 삭제할 수 없습니다: 요약 만들기",
		);
		expect(calls("DELETE")[0]?.[0]).toBe("/api/cms/v1/ai/shared?key=tone&expectedVersion=2");
	});

	it("문구가 없으면 목록 자리에 한 줄로 알린다", async () => {
		view = { version: 0, items: [] };
		renderManager();
		expect(await screen.findByText("공통 문구가 없습니다.")).toBeTruthy();
	});
});
