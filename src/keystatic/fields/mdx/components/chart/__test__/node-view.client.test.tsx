import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChartNodeView } from "../node-view.client";

vi.mock("../../../hooks/use-live-code-block-node", () => ({
	useLiveCodeBlockNode: () => ({
		type: "mdxJsxFlowElement",
		name: "Chart",
		attributes: [],
		children: [
			{ type: "paragraph", children: [{ type: "text", value: "chart bar" }] },
			{ type: "paragraph", children: [{ type: "text", value: "x month" }] },
			{ type: "paragraph", children: [] },
			{ type: "paragraph", children: [{ type: "text", value: "data" }] },
			{ type: "paragraph", children: [{ type: "text", value: "month | views" }] },
			{ type: "paragraph", children: [{ type: "text", value: "Jan | 1200" }] },
		],
	}),
}));

vi.mock("../../code-block/components", () => ({
	NodeViewCodeEditor: ({ lang, overrideHighlightLang }: { lang: string; overrideHighlightLang?: string }) => (
		<div data-testid="node-view-code-editor">
			{lang}:{overrideHighlightLang}
		</div>
	),
}));

vi.mock("../chart.client", () => ({
	Chart: ({ source }: { source: string }) => <div data-testid="chart-preview">{source}</div>,
}));

describe("ChartNodeView", () => {
	it("코드 에디터와 미리보기를 함께 렌더링한다", async () => {
		render(
			<ChartNodeView value={{ id: "chart-1", lang: "chart" }} onChange={vi.fn()} onRemove={vi.fn()} isSelected={false}>
				chart source
			</ChartNodeView>,
		);

		expect(screen.getAllByTestId("node-view-code-editor")).toHaveLength(1);
		expect(screen.getByText("txt:txt")).toBeTruthy();
		expect(await screen.findAllByTestId("chart-preview")).toHaveLength(1);
		expect(screen.getByLabelText("차트 블럭 삭제")).toBeTruthy();
		expect(screen.getAllByText(/chart bar/)[0]).toBeTruthy();
	});
});
