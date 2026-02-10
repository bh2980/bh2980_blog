import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fold as Fold } from "../fold";

describe("CodeBlock Fold", () => {
	it("checkbox+label 토글 구조를 렌더링한다", () => {
		render(<Fold>secret</Fold>);

		const checkbox = screen.getByRole("checkbox", { name: "Toggle folded inline code" });
		const collapsedLabel = screen.getByText("...");
		const expandedText = screen.getByText("secret");
		const expandedLabel = expandedText.closest("label");

		expect(checkbox).toBeTruthy();
		expect(collapsedLabel.tagName).toBe("LABEL");
		expect(expandedLabel?.tagName).toBe("LABEL");
	});

	it("... 과 원문이 번갈아 토글되고 둘 다 클릭 트리거로 동작한다", () => {
		render(<Fold>secret</Fold>);

		const checkbox = screen.getByRole("checkbox", { name: "Toggle folded inline code" }) as HTMLInputElement;
		const collapsedLabel = screen.getByText("...");
		const expandedText = screen.getByText("secret");
		const expandedLabel = expandedText.closest("label");

		expect(collapsedLabel.className.includes("peer-checked:hidden")).toBe(true);
		expect(expandedLabel?.className.includes("hidden")).toBe(true);
		expect(expandedLabel?.className.includes("peer-checked:inline")).toBe(true);
		expect(checkbox.checked).toBe(false);

		fireEvent.click(collapsedLabel);
		expect(checkbox.checked).toBe(true);

		if (!expandedLabel) {
			throw new Error("expanded label not found");
		}
		fireEvent.click(expandedLabel);
		expect(checkbox.checked).toBe(false);
	});

	it("wrapper와 원문은 inline 요소로 렌더링한다", () => {
		const { container } = render(<Fold>secret</Fold>);
		const wrapper = container.firstElementChild;
		const content = screen.getByText("secret");

		expect(wrapper?.tagName).toBe("SPAN");
		expect(content.tagName).toBe("SPAN");
		expect(container.querySelector("details")).toBeNull();
	});
});
