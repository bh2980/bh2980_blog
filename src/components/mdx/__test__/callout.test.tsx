import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Callout } from "../callout";

describe("Callout", () => {
	it("제목이 없으면 기본 이름표 없이 본문만 보여준다", () => {
		render(<Callout variant="warning">주의 내용</Callout>);

		expect(screen.queryByText("WARNING")).toBeNull();
		expect(screen.getByText("주의 내용")).toBeTruthy();
	});

	it("사용자 정의 제목이 있으면 그 값을 우선 사용한다", () => {
		render(
			<Callout variant="warning" title="직접 입력한 제목">
				주의 내용
			</Callout>,
		);

		expect(screen.getByText("직접 입력한 제목")).toBeTruthy();
		expect(screen.queryByText("WARNING")).toBeNull();
	});

	it("빈칸뿐인 제목은 제목이 없는 것으로 본다", () => {
		render(
			<Callout variant="warning" title="   ">
				주의 내용
			</Callout>,
		);

		expect(screen.queryByText("WARNING")).toBeNull();
		expect(screen.getByText("주의 내용")).toBeTruthy();
	});

	it("callout 전체를 prose 스타일 바깥으로 렌더링한다", () => {
		const { container } = render(<Callout variant="note">본문</Callout>);

		expect(container.firstElementChild?.className).toContain("not-prose");
	});
});
