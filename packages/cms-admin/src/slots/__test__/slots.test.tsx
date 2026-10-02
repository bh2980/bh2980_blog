import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../ui/tooltip";
import { type SlotAction, SlotRegistryProvider, type SlotRequest, type SlotSource, useSlot } from "../slots";

afterEach(cleanup);

function Host({ request }: { request: SlotRequest }) {
	const { trigger, panel } = useSlot(request);
	return (
		<div>
			<span data-testid="trigger">{trigger}</span>
			{panel}
		</div>
	);
}

const action = (overrides: Partial<SlotAction> = {}): SlotAction => ({
	id: "a1",
	label: "주소 추천",
	apply: "replace",
	run: async () => ({ kind: "candidates", items: [{ value: "react-query", label: "react-query" }] }),
	...overrides,
});

function renderSlot(sources: SlotSource[], request: Partial<SlotRequest> = {}) {
	const apply = vi.fn();
	const getContext = vi.fn(() => ({ title: "제목" }));
	render(
		<TooltipProvider>
			<SlotRegistryProvider sources={sources}>
				<Host request={{ slot: "field", target: "slug", collection: "post", getContext, apply, ...request }} />
			</SlotRegistryProvider>
		</TooltipProvider>,
	);
	return { apply, getContext };
}

describe("화면 자리", () => {
	it("연결된 동작이 없으면 아무것도 그리지 않는다", () => {
		renderSlot([() => []]);
		expect(screen.getByTestId("trigger").childElementCount).toBe(0);
	});

	it("공급원은 자리 이름·대상·컬렉션을 보고 동작을 고른다", () => {
		const source = vi.fn<SlotSource>(() => []);
		renderSlot([source]);
		expect(source).toHaveBeenCalledWith({ slot: "field", target: "slug", collection: "post" });
	});

	it("누르면 지금 상황으로 실행하고, 후보를 눌러야 값을 바꾼다", async () => {
		const run = vi.fn(action().run);
		const { apply, getContext } = renderSlot([() => [action({ run })]]);

		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		const chip = await screen.findByRole("button", { name: "react-query" });
		expect(getContext).toHaveBeenCalledTimes(1);
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "제목" });
		expect(apply).not.toHaveBeenCalled();

		fireEvent.click(chip);
		expect(apply).toHaveBeenCalledWith("react-query", "replace");
		// 넣은 뒤에도 다시 누를 수 있다(지웠다가 다시 넣기).
		expect((chip as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(chip);
		expect(apply).toHaveBeenCalledTimes(2);
	});

	it("요청을 받는 동작은 입력을 먼저 열고, 적은 요청을 실행할 때 함께 보낸다", async () => {
		const run = vi.fn(action().run);
		renderSlot([() => [action({ run, askInstruction: true })]]);

		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		expect(run).not.toHaveBeenCalled();
		const input = screen.getByRole("textbox", { name: "추가 요청" });
		fireEvent.change(input, { target: { value: "  tailwind 클래스만 " } });
		fireEvent.keyDown(input, { key: "Enter" });

		await screen.findByRole("button", { name: "react-query" });
		expect(run.mock.calls[0]?.[0]).toEqual({ title: "제목", request: "tailwind 클래스만" });
		// 결과를 본 뒤에도 요청은 남아 다시 실행할 수 있다.
		expect((screen.getByRole("textbox", { name: "추가 요청" }) as HTMLInputElement).value).toBe("  tailwind 클래스만 ");
	});

	it("실패하면 이유를 보여 주고 값은 그대로 둔다", async () => {
		const { apply } = renderSlot([
			() => [
				action({
					run: async () => {
						throw new Error("AI 서비스에 문제가 있습니다.");
					},
				}),
			],
		]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		expect((await screen.findByRole("alert")).textContent).toContain("AI 서비스에 문제가 있습니다.");
		expect(apply).not.toHaveBeenCalled();
	});

	it("긴 글 결과는 적용 버튼으로 적용하고, 메모는 적용 버튼이 없다", async () => {
		const { apply } = renderSlot([() => [action({ run: async () => ({ kind: "text", text: "요약 글" }) })]]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		fireEvent.click(await screen.findByRole("button", { name: "적용" }));
		expect(apply).toHaveBeenCalledWith("요약 글", "replace");

		cleanup();
		renderSlot([() => [action({ apply: "none", run: async () => ({ kind: "note", text: "메모" }) })]]);
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		await waitFor(() => expect(screen.getByText("메모")).toBeTruthy());
		expect(screen.queryByRole("button", { name: "적용" })).toBeNull();
	});

	it("만드는 중에 자리가 사라져도 요청을 멈추지 않고, 다시 그리면 결과가 남아 있다", async () => {
		let finish: (value: { kind: "candidates"; items: { value: string; label: string }[] }) => void = () => {};
		const run = vi.fn<SlotAction["run"]>(
			(_context, signal) =>
				new Promise((resolve, reject) => {
					finish = resolve;
					signal.addEventListener("abort", () => reject(new Error("aborted")));
				}),
		);
		const sources: SlotSource[] = [() => [action({ run })]];
		const request: SlotRequest = {
			slot: "image",
			target: "alt",
			scope: "image-1",
			getContext: () => ({}),
			apply: vi.fn(),
		};
		const view = (shown: boolean) => (
			<TooltipProvider>
				<SlotRegistryProvider sources={sources}>{shown && <Host request={request} />}</SlotRegistryProvider>
			</TooltipProvider>
		);
		const { rerender } = render(view(true));
		fireEvent.click(screen.getByRole("button", { name: "주소 추천" }));
		rerender(view(false));
		expect(run.mock.calls[0]?.[1].aborted).toBe(false);

		finish({ kind: "candidates", items: [{ value: "설정 화면", label: "설정 화면" }] });
		rerender(view(true));
		expect(await screen.findByRole("button", { name: "설정 화면" })).toBeTruthy();
	});

	it("같은 자리라도 구분값이 다르면 결과를 따로 둔다", async () => {
		const sources: SlotSource[] = [() => [action()]];
		const host = (scope: string) => (
			<Host request={{ slot: "image", target: "alt", scope, getContext: () => ({}), apply: vi.fn() }} />
		);
		render(
			<TooltipProvider>
				<SlotRegistryProvider sources={sources}>
					<div data-testid="a">{host("a")}</div>
					<div data-testid="b">{host("b")}</div>
				</SlotRegistryProvider>
			</TooltipProvider>,
		);
		fireEvent.click(screen.getAllByRole("button", { name: "주소 추천" })[0] as HTMLElement);
		await screen.findByRole("button", { name: "react-query" });
		expect(screen.getByTestId("b").textContent).not.toContain("react-query");
	});
});
