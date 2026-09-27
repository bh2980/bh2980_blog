import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { NodeViewProps } from "@tiptap/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeBlockView } from "../code-block-view";

vi.mock("@tiptap/react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tiptap/react")>();
	const react = await import("react");
	return {
		...actual,
		useEditorState: ({
			editor,
			selector,
		}: {
			editor: NodeViewProps["editor"];
			selector: (state: { editor: NodeViewProps["editor"] }) => unknown;
		}) => selector({ editor }),
		NodeViewWrapper: ({
			as = "div",
			children,
			...props
		}: { as?: string; children?: ReactNode } & ComponentProps<"div">) => react.createElement(as, props, children),
		NodeViewContent: ({
			as = "code",
			children,
			...props
		}: { as?: string; children?: ReactNode } & ComponentProps<"code">) => react.createElement(as, props, children),
	};
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const createCodeBlockViewProps = ({
	language = "ts",
	meta = 'title="test.ts" lnum',
	textContent = "const x = 1;",
	annotations = [],
	annotationsDisabled = false,
	selection = { from: 0, to: 0 },
	updateAttributes = vi.fn(),
}: {
	language?: string;
	meta?: string;
	textContent?: string;
	annotations?: unknown[];
	annotationsDisabled?: boolean;
	selection?: { from: number; to: number };
	updateAttributes?: ReturnType<typeof vi.fn>;
} = {}): NodeViewProps => {
	return {
		node: {
			type: { name: "codeBlock" },
			textContent,
			attrs: {
				language,
				meta,
				annotations,
				annotationsDisabled,
			},
		},
		updateAttributes,
		getPos: () => 1,
		editor: {
			state: {
				selection,
			},
		},
	} as unknown as NodeViewProps;
};

describe("CodeBlockView 컴포넌트", () => {
	it("상단 바에 언어 선택, 파일명 입력, 줄 번호 토글, 복사 버튼을 렌더링한다", () => {
		const props = createCodeBlockViewProps();
		render(<CodeBlockView {...props} />);

		expect(screen.getByLabelText("코드 언어 선택")).toBeDefined();
		expect(screen.getByLabelText("코드 블록 파일명")).toBeDefined();
		expect(screen.getByLabelText("줄 번호 표시 토글")).toBeDefined();
		expect(screen.getByLabelText("코드 복사")).toBeDefined();
	});

	it("파일명 입력 시 meta 속성을 업데이트한다", () => {
		const updateAttributes = vi.fn();
		const props = createCodeBlockViewProps({ updateAttributes, meta: "" });
		render(<CodeBlockView {...props} />);

		const titleInput = screen.getByLabelText("코드 블록 파일명");
		fireEvent.change(titleInput, { target: { value: "app.tsx" } });

		expect(updateAttributes).toHaveBeenCalledWith({
			meta: 'title="app.tsx"',
		});
	});

	it("줄 번호 토글 시 meta 속성을 업데이트한다", () => {
		const updateAttributes = vi.fn();
		const props = createCodeBlockViewProps({ updateAttributes, meta: 'title="app.tsx"' });
		render(<CodeBlockView {...props} />);

		const lnumToggle = screen.getByLabelText("줄 번호 표시 토글");
		fireEvent.click(lnumToggle);

		expect(updateAttributes).toHaveBeenCalledWith({
			meta: 'title="app.tsx" lnum',
		});
	});

	it("복사 버튼 클릭 시 클립보드에 코드 텍스트를 복사한다", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.assign(navigator, {
			clipboard: { writeText },
		});

		const props = createCodeBlockViewProps({ textContent: "console.log('copied');" });
		render(<CodeBlockView {...props} />);

		const copyBtn = screen.getByLabelText("코드 복사");
		await act(async () => {
			fireEvent.click(copyBtn);
		});

		expect(writeText).toHaveBeenCalledWith("console.log('copied');");
	});

	it("annotationsDisabled가 true일 때는 주석 편집 버튼들이 비활성화된다", () => {
		const props = createCodeBlockViewProps({
			annotationsDisabled: true,
			selection: { from: 2, to: 6 },
		});
		render(<CodeBlockView {...props} />);

		const underlineBtn = screen.getByLabelText("선택 영역 밑줄 주석 토글");
		const tooltipBtn = screen.getByLabelText("선택 영역 툴팁 주석");

		expect(underlineBtn.hasAttribute("disabled")).toBe(true);
		expect(tooltipBtn.hasAttribute("disabled")).toBe(true);
	});

	it("코드 선택 영역이 있을 때 밑줄 주석 토글을 클릭하면 annotations를 갱신한다", () => {
		const updateAttributes = vi.fn();
		// getPos가 1이므로 코드 시작은 pos 2. 'const'(pos 2~7) 선택
		const props = createCodeBlockViewProps({
			updateAttributes,
			annotationsDisabled: false,
			selection: { from: 2, to: 7 },
			textContent: "const x = 1;",
		});

		render(<CodeBlockView {...props} />);

		const underlineBtn = screen.getByLabelText("선택 영역 밑줄 주석 토글");
		expect(underlineBtn.hasAttribute("disabled")).toBe(false);

		fireEvent.click(underlineBtn);

		expect(updateAttributes).toHaveBeenCalledWith(
			expect.objectContaining({
				annotations: [
					expect.objectContaining({
						type: "underline",
						from: 0,
						to: 5,
					}),
				],
			}),
		);
	});
});
