import { render, screen } from "@testing-library/react";
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

	it("해석 실패에는 캡션만 남긴다(width 적용 없음)", () => {
		render(<CmsImage mediaId="uuid-1" alt="설명" width="60%" caption="캡션" resolve={() => ({ failure: "not-ready" })} />);

		expect(screen.getByText("캡션")).toBeTruthy();
		expect(screen.queryByAltText("설명")).toBeNull();
	});
});
