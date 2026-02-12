import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { collapse as Collapse } from "../collapse";

describe("CodeBlock collapse whitespace", () => {
	it("whitespace text node를 제거하고 첫 코드 라인을 summary로 사용한다", () => {
		const { container } = render(
			<Collapse>
				{"\n"}
				<span className="line">{"export async function generateImageMetadata() {"}</span>
				{"\n"}
				<span className="line">{"\tconst post = await getPost(slug);"}</span>
				{"\n"}
			</Collapse>,
		);

		const summary = container.querySelector("summary");
		const summaryText = summary?.textContent ?? "";

		expect(summaryText).toContain("export async function generateImageMetadata() {");
	});

	it("선행 공백 제거 이후에도 내부 line 사이 줄바꿈 텍스트 노드는 유지한다", () => {
		const { container } = render(
			<Collapse>
				{"\n\n"}
				<span className="line">{"line-1"}</span>
				{"\n"}
				<span className="line">{"line-2"}</span>
				{"\n"}
				<span className="line">{"line-3"}</span>
			</Collapse>,
		);

		const body = container.querySelector("details > div");
		const textNodes = Array.from(body?.childNodes ?? []).filter((node) => node.nodeType === Node.TEXT_NODE);

		expect(textNodes.some((node) => (node.textContent ?? "").includes("\n"))).toBe(true);
	});
});
