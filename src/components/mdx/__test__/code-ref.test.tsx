import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeRef } from "../code-ref.client";

vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
	SheetContent: ({ children }: { children: React.ReactNode }) => <div role="dialog">{children}</div>,
	SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
	SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const matchMedia = (touch: boolean) =>
	vi.fn().mockImplementation((query: string) => ({
		matches: touch && (query === "(hover: none)" || query === "(pointer: coarse)"),
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
	}));

/** 공개 코드 블록처럼 이름표 달린 줄을 둔다. `onScreen`이면 줄이 화면 안에 보인다. */
const mountCode = (onScreen: boolean) => {
	const wrapper = document.createElement("div");
	wrapper.innerHTML =
		'<div data-title="add.ts"></div><pre class="shiki" style="--shiki-dark:#fff"><code>' +
		'<span class="line">function add(a, b) {</span>' +
		'<span class="line" data-anchor="c1">  return a + b;</span>' +
		'<span class="line">}</span></code></pre>';
	document.body.append(wrapper);
	for (const line of wrapper.querySelectorAll<HTMLElement>(".line")) {
		line.getClientRects = () => (onScreen ? [new DOMRect(0, 100, 100, 20)] : []) as unknown as DOMRectList;
		line.getBoundingClientRect = () => (onScreen ? new DOMRect(0, 100, 100, 20) : new DOMRect(0, 5000, 100, 20));
		line.scrollIntoView = vi.fn();
	}
	return wrapper;
};

beforeEach(() => {
	window.matchMedia = matchMedia(false);
});
afterEach(() => {
	cleanup();
	document.body.innerHTML = "";
});

describe("CodeRef(공개 화면)", () => {
	it("코드가 화면에 보이면 마우스를 올린 동안 연결된 줄을 강조하고 나머지를 흐린다", async () => {
		const code = mountCode(true);
		render(<CodeRef to="c1">이 함수가</CodeRef>);
		const link = await screen.findByRole("button", { name: /이 함수가/ });

		fireEvent.pointerEnter(link, { pointerType: "mouse" });
		expect(code.querySelector("pre")?.hasAttribute("data-code-focus")).toBe(true);
		expect(code.querySelector('[data-anchor="c1"]')?.hasAttribute("data-focused")).toBe(true);

		fireEvent.pointerLeave(link, { pointerType: "mouse" });
		expect(code.querySelector("pre")?.hasAttribute("data-code-focus")).toBe(false);
	});

	it("데스크톱에서 화면 밖 코드를 누르면 코드로 옮기고, 읽던 곳으로 돌아가는 버튼이 뜬다", async () => {
		const code = mountCode(false);
		const scrollTo = vi.fn();
		window.scrollTo = scrollTo;
		render(<CodeRef to="c1">이 함수가</CodeRef>);
		act(() => fireEvent.click(screen.getByRole("button", { name: /이 함수가/ })));

		expect(code.querySelector('[data-anchor="c1"]')?.scrollIntoView).toHaveBeenCalled();
		const back = await screen.findByRole("button", { name: /읽던 곳으로/ });
		act(() => fireEvent.click(back));
		expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
		expect(screen.queryByRole("button", { name: /읽던 곳으로/ })).toBeNull();
	});

	it("터치 기기에서 화면 밖 코드를 누르면 페이지를 움직이지 않고 연결된 줄만 시트로 보인다", async () => {
		window.matchMedia = matchMedia(true);
		const code = mountCode(false);
		render(<CodeRef to="c1">이 함수가</CodeRef>);
		const link = await screen.findByRole("button", { name: /이 함수가/ });
		await waitFor(() => expect(link.closest("[data-code-ref]")).toBeTruthy());
		act(() => fireEvent.click(link));

		const sheet = await screen.findByRole("dialog");
		expect(sheet.textContent).toContain("연결된 코드");
		expect(sheet.textContent).toContain("add.ts");
		expect(sheet.querySelectorAll("[data-preview-line]")).toHaveLength(3);
		expect(code.querySelector('[data-anchor="c1"]')?.scrollIntoView).not.toHaveBeenCalled();
	});

	it("연결된 줄이 없으면 연결 없는 글자로 보인다", async () => {
		render(<CodeRef to="c9">이 함수가</CodeRef>);
		await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
		expect(screen.getByText("이 함수가")).toBeTruthy();
	});
});
