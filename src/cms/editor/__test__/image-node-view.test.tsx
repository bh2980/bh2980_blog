import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsImageNodeView } from "../image-node-view";

vi.mock("@tiptap/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tiptap/react")>();
	const react = await import("react");
	return {
		...actual,
		NodeViewWrapper: ({
			as = "figure",
			children,
			...props
		}: { as?: "figure"; children?: ReactNode } & Omit<ComponentProps<"figure">, "children">) =>
			react.createElement(as, props, children),
	};
});

afterEach(cleanup);

describe("CmsImageNodeView (v2 C2)", () => {
	const createProps = (attrs: Record<string, unknown> = {}, isEditable = true) => {
		const updateAttributes = vi.fn();
		const deleteNode = vi.fn();
		const props = {
			node: {
				attrs: {
					src: "https://example.com/test.png",
					alt: "테스트 이미지",
					width: "100%",
					align: "center",
					caption: "",
					mediaId: null,
					crop: null,
					rotate: null,
					...attrs,
				},
			},
			updateAttributes,
			deleteNode,
			selected: false,
			editor: { isEditable },
		} as unknown as NodeViewProps;
		return { props, updateAttributes, deleteNode };
	};

	it("너비 조절 모서리 핸들을 렌더링하고 드래그 시 한번의 트랜잭션으로 업데이트한다", () => {
		const { props, updateAttributes } = createProps({ width: "500px" });
		render(<CmsImageNodeView {...props} />);

		const leftHandle = screen.getByLabelText("이미지 너비 조절 핸들 (좌측 하단)");
		const rightHandle = screen.getByLabelText("이미지 너비 조절 핸들 (우측 하단)");
		expect(leftHandle).toBeDefined();
		expect(rightHandle).toBeDefined();

		// pointerdown 후 window pointermove, pointerup 시뮬레이션
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200 }));
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).toHaveBeenCalledOnce();
		expect(updateAttributes.mock.calls[0][0].width).toMatch(/^\d+px$/);
	});

	it("% 너비의 경우 드래그 시 % 값으로 계산하여 업데이트한다", () => {
		const { props, updateAttributes } = createProps({ width: "60%" });
		render(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText("이미지 너비 조절 핸들 (우측 하단)");
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 150 }));
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).toHaveBeenCalledOnce();
		expect(updateAttributes.mock.calls[0][0].width).toMatch(/^\d+%$/);
	});

	it("crop 및 rotate 속성이 있으면 transform wrapper가 렌더된다", () => {
		const { props } = createProps({
			crop: "10,20,50,40",
			rotate: "90",
		});
		const { container } = render(<CmsImageNodeView {...props} />);
		const wrapper = container.querySelector('[data-slot="image-transform-wrapper"]');
		expect(wrapper).toBeTruthy();
	});

	it("자르기 및 회전 대화상자를 열고 회전 및 적용을 수행할 수 있다", () => {
		const { props, updateAttributes } = createProps();
		render(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByLabelText("이미지 자르기 및 회전");
		fireEvent.click(cropBtn);

		// 다이얼로그 열림 확인
		expect(screen.getByText("이미지 자르기 및 회전")).toBeDefined();

		// 90도 회전 버튼 클릭
		const rotateBtn = screen.getByRole("button", { name: "시계 방향 90도 회전" });
		fireEvent.click(rotateBtn);
		expect(screen.getByText("90°")).toBeDefined();

		// 적용 버튼 클릭
		const applyBtn = screen.getByRole("button", { name: "적용" });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: null,
			rotate: "90",
		});
	});

	it("너비 핸들을 이동 없이 놓으면 updateAttributes를 호출하지 않는다 (P1-4: 너비 미지정 이미지 보존)", () => {
		const { props, updateAttributes } = createProps({ width: null });
		render(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText("이미지 너비 조절 핸들 (우측 하단)");
		// 이동 없이 단순 클릭 후 놓음
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointerup"));
		});

		expect(updateAttributes).not.toHaveBeenCalled();
	});

	it("pointercancel 발생 시 updateAttributes를 호출하지 않고 정리된다 (P2)", () => {
		const { props, updateAttributes } = createProps({ width: "400px" });
		render(<CmsImageNodeView {...props} />);

		const rightHandle = screen.getByLabelText("이미지 너비 조절 핸들 (우측 하단)");
		fireEvent.pointerDown(rightHandle, { clientX: 100, pointerId: 1 });
		act(() => {
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 200 }));
			window.dispatchEvent(new PointerEvent("pointercancel"));
		});

		expect(updateAttributes).not.toHaveBeenCalled();
	});

	it("회전된 상태에서도 크롭 좌표계는 원본 기준(0~100)으로 저장된다 (P1-2)", () => {
		const { props, updateAttributes } = createProps({ rotate: "90" });
		render(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByLabelText("이미지 자르기 및 회전");
		fireEvent.click(cropBtn);

		// X, Y, W, H 키보드 수치 입력 대안 (P2)
		const inputX = screen.getByLabelText("자르기 X 좌표 (%)");
		const inputY = screen.getByLabelText("자르기 Y 좌표 (%)");
		const inputW = screen.getByLabelText("자르기 너비 (%)");
		const inputH = screen.getByLabelText("자르기 높이 (%)");

		fireEvent.change(inputX, { target: { value: "15" } });
		fireEvent.change(inputY, { target: { value: "25" } });
		fireEvent.change(inputW, { target: { value: "50" } });
		fireEvent.change(inputH, { target: { value: "60" } });

		// 적용 버튼 클릭
		const applyBtn = screen.getByRole("button", { name: "적용" });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: "15,25,50,60",
			rotate: "90",
		});
	});

	it("대화상자에서 회전 초기화와 전체 초기화가 동작한다", () => {
		const { props, updateAttributes } = createProps({
			crop: "10,10,80,80",
			rotate: "180",
		});
		render(<CmsImageNodeView {...props} />);

		const cropBtn = screen.getByLabelText("이미지 자르기 및 회전");
		fireEvent.click(cropBtn);

		// 초기화 버튼 클릭
		const resetAllBtn = screen.getByRole("button", { name: "초기화" });
		fireEvent.click(resetAllBtn);

		// 적용 버튼 클릭
		const applyBtn = screen.getByRole("button", { name: "적용" });
		fireEvent.click(applyBtn);

		expect(updateAttributes).toHaveBeenCalledWith({
			crop: null,
			rotate: null,
		});
	});
});
