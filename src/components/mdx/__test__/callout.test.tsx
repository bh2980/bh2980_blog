import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Callout } from "../callout";

describe("Callout", () => {
	it("variant에 맞는 기본 제목을 보여준다", () => {
		render(<Callout variant="warning">주의 내용</Callout>);

		expect(screen.getByText("WARNING")).toBeTruthy();
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

	it("제목을 비우면 다시 기본 제목으로 돌아간다", () => {
		render(
			<Callout variant="warning" title="   ">
				주의 내용
			</Callout>,
		);

		expect(screen.getByText("WARNING")).toBeTruthy();
	});

	it("callout 전체를 prose 스타일 바깥으로 렌더링한다", () => {
		const { container } = render(<Callout variant="note">본문</Callout>);

		expect(container.firstElementChild?.className).toContain("not-prose");
	});

	it("실제 렌더링은 grid 대신 단순한 본문 영역을 사용한다", () => {
		render(<Callout variant="note">본문</Callout>);
		const description = screen.getByText("본문").closest('[data-slot="callout-body"]');
		expect(description).toBeTruthy();
		expect(description?.className).toContain("mt-2");
		expect(description?.className).not.toContain("rounded-md");
		expect(description?.className).not.toContain("border");
		expect(description?.className).not.toContain("bg-white/60");
	});
});
