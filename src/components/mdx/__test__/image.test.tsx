import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

	it("명시적 px width도 인라인 width로 렌더된다", () => {
		render(
			<CmsImage
				src="https://example.com/a.png"
				alt="설명"
				width="600px"
				resolve={() => ({ url: "https://example.com/a.png" })}
			/>,
		);

		expect(screen.getByAltText("설명").style.width).toBe("600px");
	});

	it("장식 이미지도 주소가 있으면 이미지를 렌더한다", () => {
		const { container } = render(
			<CmsImage
				src="https://example.com/a.png"
				alt=""
				decorative
				resolve={() => ({ url: "https://example.com/a.png" })}
			/>,
		);

		expect(container.querySelector("img")).toBeTruthy();
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

	it("crop 속성이 있으면 wrapper overflow-hidden과 계산된 스타일을 렌더한다", () => {
		const { container } = render(
			<CmsImage
				src="https://example.com/a.png"
				alt="자른 이미지"
				crop="10,20,50,40"
				resolve={() => ({ url: "https://example.com/a.png" })}
			/>,
		);

		const wrapper = container.querySelector('[data-slot="image-transform-wrapper"]') as HTMLElement;
		expect(wrapper).toBeTruthy();
		expect(wrapper.style.overflow).toBe("hidden");
		expect(wrapper.style.position).toBe("relative");
		const img = screen.getByAltText("자른 이미지");
		expect(img.style.position).toBe("absolute");
		expect(img.style.width).toBe("200%");
	});

	it("rotate 속성이 있으면 transform 회전 스타일이 적용된다", () => {
		const { container } = render(
			<CmsImage
				src="https://example.com/a.png"
				alt="회전 이미지"
				rotate="90"
				resolve={() => ({ url: "https://example.com/a.png" })}
			/>,
		);

		const wrapper = container.querySelector('[data-slot="image-transform-wrapper"]');
		expect(wrapper).toBeTruthy();
		const img = screen.getByAltText("회전 이미지");
		expect(img.style.transform).toContain("rotate(90deg)");
	});

	it("너비 미지정 이미지에 crop/rotate 적용 시 wrapper가 width 100%를 가져 수축하지 않는다 (P1-1)", () => {
		const { container } = render(
			<CmsImage
				src="https://example.com/a.png"
				alt="너비 미지정 자른 이미지"
				crop="10,20,50,40"
				resolve={() => ({ url: "https://example.com/a.png" })}
			/>,
		);

		const wrapper = container.querySelector('[data-slot="image-transform-wrapper"]') as HTMLElement;
		expect(wrapper).toBeTruthy();
		expect(wrapper.style.width).toBe("100%");
		expect(wrapper.style.maxWidth).toBe("100%");
	});
});

describe("CmsImage 변환 이미지(v2 C2)", () => {
	it("제목을 img title로 보존한다", () => {
		render(
			<CmsImage
				src="https://example.com/t.png"
				alt="제목 있음"
				title="도움말"
				crop="0,0,50,50"
				resolve={() => ({ url: "https://example.com/t.png" })}
			/>,
		);
		expect(screen.getByAltText("제목 있음").getAttribute("title")).toBe("도움말");
	});

	it("너비 미지정이면 원본을 읽은 뒤 보이는 영역의 원본 너비로 보인다", () => {
		render(
			<CmsImage
				src="https://example.com/n.png"
				alt="작은 이미지"
				crop="0,0,50,100"
				resolve={() => ({ url: "https://example.com/n.png" })}
			/>,
		);
		const img = screen.getByAltText("작은 이미지") as HTMLImageElement;
		Object.defineProperty(img, "naturalWidth", { value: 120 });
		Object.defineProperty(img, "naturalHeight", { value: 80 });
		fireEvent.load(img);
		const wrapper = img.parentElement as HTMLElement;
		expect(wrapper.style.width).toBe("60px");
		expect(wrapper.style.maxWidth).toBe("100%");
	});

	it("캐시된 외부 이미지는 load 이벤트가 없어도 실제 비율로 자리를 잡는다", () => {
		const complete = vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
		const width = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(800);
		const height = vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(400);
		try {
			const { container } = render(
				<CmsImage
					src="https://example.com/cached.png"
					alt="캐시됨"
					crop="0,0,50,100"
					resolve={() => ({ url: "https://example.com/cached.png" })}
				/>,
			);
			const wrapper = container.querySelector<HTMLElement>('[data-slot="image-transform-wrapper"]');
			expect(wrapper?.style.aspectRatio).toBe("1");
			expect(wrapper?.style.width).toBe("400px");
		} finally {
			complete.mockRestore();
			width.mockRestore();
			height.mockRestore();
		}
	});

	it("미디어 원본 크기를 알면 로드 전에 이미지 자리를 잡는다", () => {
		const resolve = () => ({ url: "https://example.com/a.png", width: 800, height: 400 });
		const { container } = render(
			<>
				<CmsImage mediaId="plain" alt="일반" resolve={resolve} />
				<CmsImage mediaId="cropped" alt="자름" crop="0,0,50,100" resolve={resolve} />
			</>,
		);

		const plain = screen.getByAltText("일반");
		expect(plain.getAttribute("width")).toBe("800");
		expect(plain.getAttribute("height")).toBe("400");
		const wrapper = container.querySelector<HTMLElement>('[data-slot="image-transform-wrapper"]');
		// 800×400의 왼쪽 절반 → 400×400
		expect(wrapper?.style.aspectRatio).toBe("1");
		expect(wrapper?.style.width).toBe("400px");
	});
});
