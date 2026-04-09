import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "../tooltip";

const mockMatchMedia = ({
	hoverNone = false,
	pointerCoarse = false,
}: {
	hoverNone?: boolean;
	pointerCoarse?: boolean;
} = {}) =>
	vi.fn().mockImplementation((query: string) => ({
		matches: query === "(hover: none)" ? hoverNone : query === "(pointer: coarse)" ? pointerCoarse : false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	}));

describe("MDX Tooltip", () => {
	beforeEach(() => {
		class ResizeObserverMock {
			observe() {}
			unobserve() {}
			disconnect() {}
		}

		Object.defineProperty(window, "ResizeObserver", {
			writable: true,
			value: ResizeObserverMock,
		});
		Object.defineProperty(globalThis, "ResizeObserver", {
			writable: true,
			value: ResizeObserverMock,
		});
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: mockMatchMedia(),
		});
	});

	it("데스크톱에서는 포커스로 tooltip을 연다", async () => {
		window.matchMedia = mockMatchMedia({ hoverNone: false, pointerCoarse: false });

		render(<Tooltip content="설명">단어</Tooltip>);

		const trigger = screen.getByRole("button");
		fireEvent.focus(trigger);

		const tooltip = await screen.findByRole("tooltip");
		expect(tooltip.textContent).toContain("설명");
	});

	it("모바일에서는 클릭으로 popover를 연다", async () => {
		window.matchMedia = mockMatchMedia({ hoverNone: true, pointerCoarse: true });

		render(<Tooltip content="설명">단어</Tooltip>);

		const trigger = screen.getByRole("button");
		fireEvent.click(trigger);

		const content = await screen.findByText("설명");
		expect(content).toBeTruthy();
	});

	it("모바일에서는 바깥 영역을 누르면 popover가 닫힌다", async () => {
		window.matchMedia = mockMatchMedia({ hoverNone: true, pointerCoarse: true });

		render(
			<div>
				<Tooltip content="설명">단어</Tooltip>
				<button type="button">바깥</button>
			</div>,
		);

		const trigger = screen.getByRole("button", { name: "단어" });
		fireEvent.click(trigger);
		await screen.findByText("설명");

		fireEvent.pointerDown(screen.getByRole("button", { name: "바깥" }));

		expect(screen.queryByText("설명")).toBeNull();
	});
});
