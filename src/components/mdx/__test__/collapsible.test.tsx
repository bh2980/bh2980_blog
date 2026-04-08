import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Collapsible } from "../collapsible";

describe("Collapsible", () => {
	it("저장된 제목이 있으면 런타임 트리거에 그 값을 보여준다", () => {
		render(<Collapsible title="풀이 보기">내용</Collapsible>);

		expect(screen.getByText("풀이 보기")).toBeTruthy();
		expect(screen.queryByText("펼치기")).toBeNull();
	});

	it("제목이 비어 있으면 기본 문구를 사용한다", () => {
		render(<Collapsible title="   ">내용</Collapsible>);

		expect(screen.getByText("펼치기")).toBeTruthy();
	});
});
