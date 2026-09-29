import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tooltip } from "../tooltip";

const mockMatchMedia = ({
	hoverNone = false,
	pointerCoarse = false,
	supportsEventListener = true,
}: {
	hoverNone?: boolean;
	pointerCoarse?: boolean;
	supportsEventListener?: boolean;
} = {}) =>
	vi.fn().mockImplementation((query: string) => {
		const mediaQueryList = {
			matches: query === "(hover: none)" ? hoverNone : query === "(pointer: coarse)" ? pointerCoarse : false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		};

		if (supportsEventListener) {
			return {
				...mediaQueryList,
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			};
		}

		return mediaQueryList;
	});

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
		// 설명은 열기 전에도 트리거의 접근 가능한 설명으로 연결돼 있다.
		const describedBy = trigger.getAttribute("aria-describedby");
		expect(describedBy && document.getElementById(describedBy)?.textContent).toBe("설명");
		await act(async () => trigger.focus());

		const popup = await screen.findByText("설명", { selector: "[data-slot=tooltip-content]" });
		expect(popup.hasAttribute("data-open")).toBe(true);
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

		// Base UI는 바깥 누름을 click 단계에서 닫는다. 실제 탭과 같은 순서로 보낸다.
		const outside = screen.getByRole("button", { name: "바깥" });
		fireEvent.pointerDown(outside);
		fireEvent.mouseDown(outside);
		fireEvent.click(outside);

		expect(screen.queryByText("설명")).toBeNull();
	});

	it("구형 MediaQueryList 환경에서는 addListener fallback을 사용한다", () => {
		const mediaQueryLists: Array<{
			addListener: ReturnType<typeof vi.fn>;
			removeListener: ReturnType<typeof vi.fn>;
		}> = [];

		window.matchMedia = vi.fn().mockImplementation((query: string) => {
			const mediaQueryList = {
				matches: query === "(hover: none)" || query === "(pointer: coarse)",
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				dispatchEvent: vi.fn(),
			};

			mediaQueryLists.push(mediaQueryList);
			return mediaQueryList;
		});

		const { unmount } = render(<Tooltip content="설명">단어</Tooltip>);

		expect(mediaQueryLists).toHaveLength(2);
		for (const mediaQueryList of mediaQueryLists) {
			expect(mediaQueryList.addListener).toHaveBeenCalledTimes(1);
			expect(mediaQueryList.removeListener).not.toHaveBeenCalled();
		}

		unmount();

		for (const mediaQueryList of mediaQueryLists) {
			expect(mediaQueryList.removeListener).toHaveBeenCalledTimes(1);
		}
	});

	it("코드 주석 번호가 있으면 터치 기기에서 팝오버 대신 번호만 보이고 설명은 스크린 리더로 읽는다", () => {
		window.matchMedia = mockMatchMedia({ hoverNone: true });
		render(
			<Tooltip content="코드 설명" note="2">
				item
			</Tooltip>,
		);

		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("2").tagName).toBe("SUP");
		expect(screen.getByText("주석 2: 코드 설명").className).toContain("sr-only");
	});
});
