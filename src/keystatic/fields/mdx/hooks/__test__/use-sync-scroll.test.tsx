import { fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { useSyncScroll, type SyncScrollAxis } from "../use-sync-scroll";

function TestHarness({ axis = "both" }: { axis?: SyncScrollAxis }) {
	const refA = useRef<HTMLDivElement>(null);
	const refB = useRef<HTMLDivElement>(null);
	useSyncScroll({ refA, refB, axis });

	return (
		<>
			<div data-testid="a" ref={refA} />
			<div data-testid="b" ref={refB} />
		</>
	);
}

function defineScrollable(
	el: HTMLElement,
	options?: Partial<{
		clientWidth: number;
		clientHeight: number;
		scrollWidth: number;
		scrollHeight: number;
	}>,
) {
	const { clientWidth = 120, clientHeight = 80, scrollWidth = 500, scrollHeight = 800 } = options ?? {};
	Object.defineProperties(el, {
		clientWidth: { configurable: true, value: clientWidth },
		clientHeight: { configurable: true, value: clientHeight },
		scrollWidth: { configurable: true, value: scrollWidth },
		scrollHeight: { configurable: true, value: scrollHeight },
	});
}

function emitScroll(el: HTMLElement, next: { left?: number; top?: number }) {
	if (typeof next.left === "number") el.scrollLeft = next.left;
	if (typeof next.top === "number") el.scrollTop = next.top;
	fireEvent.scroll(el);
}

function mount(axis?: SyncScrollAxis) {
	const { getByTestId } = render(<TestHarness axis={axis} />);
	const a = getByTestId("a");
	const b = getByTestId("b");

	defineScrollable(a);
	defineScrollable(b);

	return { a, b };
}

describe("useSyncScroll", () => {
	it("기본 axis=both 일 때 양쪽 컨테이너의 x/y 스크롤이 동기화된다", () => {
		const { a, b } = mount();

		emitScroll(a, { left: 31, top: 140 });
		expect(b.scrollLeft).toBe(31);
		expect(b.scrollTop).toBe(140);

		emitScroll(b, { left: 9, top: 52 });
		expect(a.scrollLeft).toBe(9);
		expect(a.scrollTop).toBe(52);
	});

	it("axis=x 일 때 가로 스크롤만 동기화된다", () => {
		const { a, b } = mount("x");

		emitScroll(a, { left: 77, top: 200 });
		expect(b.scrollLeft).toBe(77);
		expect(b.scrollTop).toBe(0);
	});

	it("axis=y 일 때 세로 스크롤만 동기화된다", () => {
		const { a, b } = mount("y");

		emitScroll(a, { left: 60, top: 210 });
		expect(b.scrollLeft).toBe(0);
		expect(b.scrollTop).toBe(210);
	});
});
