import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CmsImage } from "../image";

/** O2: 명시적 `width="100%"`는 인라인 width로 렌더된다(미지정과 다르다). */
describe("CmsImage width", () => {
	it("명시적 width 100%에 인라인 width를 적용한다", () => {
		render(
			<CmsImage
				src="https://example.com/a.png"
				alt="설명"
				width="100%"
				resolve={() => ({ url: "https://example.com/a.png" })}
			/>,
		);

		expect(screen.getByAltText("설명").style.width).toBe("100%");
	});

	it("width 미지정에는 인라인 width를 적용하지 않는다(자연 크기)", () => {
		render(
			<CmsImage src="https://example.com/a.png" alt="설명" resolve={() => ({ url: "https://example.com/a.png" })} />,
		);

		expect(screen.getByAltText("설명").style.width).toBe("");
	});

	it("해석 실패에는 중립 플레이스홀더와 캡션을 남긴다", () => {
		render(
			<CmsImage mediaId="uuid-1" alt="설명" width="60%" caption="캡션" resolve={() => ({ failure: "not-ready" })} />,
		);

		expect(screen.getByText("이미지를 표시할 수 없습니다")).toBeTruthy();
		expect(screen.getByText("캡션")).toBeTruthy();
		expect(screen.queryByAltText("설명")).toBeNull();
		// 내부 실패 사유는 공개 화면에 노출하지 않는다.
		expect(screen.queryByText("not-ready")).toBeNull();
	});

	it("공개 URL이 런타임에 실패하면 중립 플레이스홀더로 바뀐다", () => {
		render(
			<CmsImage
				src="https://example.com/missing.png"
				alt="설명"
				resolve={() => ({ url: "https://example.com/missing.png" })}
			/>,
		);

		fireEvent.error(screen.getByAltText("설명"));
		expect(screen.getByText("이미지를 표시할 수 없습니다")).toBeTruthy();
		expect(screen.queryByAltText("설명")).toBeNull();
	});
});
