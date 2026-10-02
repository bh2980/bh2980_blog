import { remarkDemoteUnknownDirectives, remarkDirectivesToMdx } from "@bh2980/cms/mdx/remark-directives";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import remarkDirective from "remark-directive";
import { describe, expect, it } from "vitest";
import { MDX_COMPONENTS, MDX_REHYPE_PLUGINS, MDX_REMARK_PLUGINS } from "@/components/mdx/mdx-content";

/**
 * `pre`는 async RSC라 react-dom 정적 렌더러가 await하지 못한다(렌더러 제약). 비교 목적이므로
 * 양쪽 체인에 같은 동기 대체 컴포넌트를 쓴다. 플러그인 체인은 실제 공개 체인과 같다.
 */
const PreShim = ({ children, title }: { children?: ReactNode; title?: string }) => (
	<div data-audit-pre-shim data-title={title}>
		{children}
	</div>
);

const renderWith = async (source: string, plugins: ReturnType<typeof MDX_REMARK_PLUGINS>): Promise<string> => {
	const { content } = await compileMDX({
		source,
		options: { mdxOptions: { remarkPlugins: plugins, rehypePlugins: MDX_REHYPE_PLUGINS } },
		components: { ...MDX_COMPONENTS, pre: PreShim },
	});

	return renderToStaticMarkup(content);
};

const renderPublic = (source: string): Promise<string> => renderWith(source, MDX_REMARK_PLUGINS());

/** 배치 1 이전 체인 — directive 플러그인 3개만 뺀 것. */
const renderBeforeBatch1 = (source: string): Promise<string> =>
	renderWith(
		source,
		MDX_REMARK_PLUGINS().filter((entry) => {
			const plugin = Array.isArray(entry) ? entry[0] : entry;
			return plugin !== remarkDirective && plugin !== remarkDemoteUnknownDirectives && plugin !== remarkDirectivesToMdx;
		}),
	);

describe("배치 1 렌더 등가성 — directive를 쓰지 않는 글", () => {
	it("directive를 쓰지 않는 본문은 directive 플러그인이 붙어도 렌더가 같다", async () => {
		// 배치 1의 "49편 등가성"은 코퍼스가 directive로 변환된 뒤에는 성립하지 않는다 —
		// 변환된 본문은 directive 플러그인 없이는 아무것도 출력하지 않는다(그게 그 플러그인의 존재 이유다).
		// 그래서 **추가형** 성질은 directive를 쓰지 않는 본문으로 고정한다: 수식 `$`·표·코드 펜스·
		// 레거시 JSX·하드브레이크·미등록 `:이름`이 섞인 표본.
		const samples = [
			"문장 안의 $기호와 `코드` 그리고 **강조**",
			"| a | b |\n| --- | --- |\n| 1 | 2 |",
			'<Callout variant="note">\n\n레거시 JSX도 그대로\n\n</Callout>',
			"첫 줄\\\n둘째 줄",
			"```ts\nconst a = 1;\n```",
			"<u>밑줄</u>과 :free를 같은 산문",
		];

		const mismatches: string[] = [];
		for (const sample of samples) {
			const [before, after] = await Promise.all([renderBeforeBatch1(sample), renderPublic(sample)]);
			if (before !== after) mismatches.push(sample);
		}

		expect(mismatches).toEqual([]);
	});
});

describe("배치 1 신규 directive 렌더", () => {
	it("인라인 directive를 요소로 렌더한다", async () => {
		const html = await renderPublic("밑줄은 :u[밑줄 친 부분] 이고 위는 :sup[위] 아래는 :sub[아래] 다.");

		expect(html).toContain("<u>밑줄 친 부분</u>");
		expect(html).toContain("<sup>위</sup>");
		expect(html).toContain("<sub>아래</sub>");
	});

	it("강제 줄바꿈은 :br[] 로 렌더한다(뒤에 한글이 붙어도 안전한 형태)", async () => {
		// 이름은 뒤따르는 글자를 삼킨다. 한글도 이름 문자라 `:br둘째`는 이름 `br둘째`가 되어
		// 미등록으로 처리되고 `:br` 글자가 그대로 출력된다. 그래서 serializer는 항상 빈 라벨을 붙인다.
		const safe = await renderPublic("첫 줄:br[]둘째 줄");
		const ambiguous = await renderPublic("첫 줄:br둘째 줄");

		expect(safe).toContain("<br/>");
		expect(safe).not.toContain(":br");
		expect(ambiguous).toContain(":br둘째");
		expect(ambiguous).not.toContain("<br/>");
	});

	it(":::text-align 은 검증된 정렬 클래스만 출력한다", async () => {
		const centered = await renderPublic(':::text-align{align="center"}\n가운데\n:::');
		const bogus = await renderPublic(':::text-align{align="justify"}\n무시\n:::');

		expect(centered).toContain("text-center");
		expect(bogus).not.toContain("text-justify");
	});

	it("::image 는 src·alt·caption 을 렌더한다", async () => {
		const html = await renderPublic('::image{src="/images/a.png" alt="설명" caption="캡션" width="60%"}');

		expect(html).toContain('src="/images/a.png"');
		expect(html).toContain('alt="설명"');
		expect(html).toContain("<figcaption");
		expect(html).toContain("캡션");
		expect(html).toContain("width:60%");
	});

	it("해석할 수 없는 이미지는 중립 플레이스홀더와 캡션을 남긴다", async () => {
		const unresolved = await renderPublic(
			'::image{mediaId="00000000-0000-0000-0000-000000000000" alt="대체텍스트" caption="캡션"}',
		);
		const rejected = await renderPublic('::image{src="javascript:alert(1)" alt="대체텍스트" caption="캡션"}');
		const noCaption = await renderPublic('::image{mediaId="00000000-0000-0000-0000-000000000000"}');

		for (const html of [unresolved, rejected, noCaption]) {
			expect(html).not.toContain("<img");
			// 내부 실패 사유·alt 글자로 대체하지 않는다. width·align도 적용하지 않는다.
			expect(html).toContain("이미지를 표시할 수 없습니다");
			expect(html).not.toContain("대체텍스트");
			expect(html).not.toContain("width:");
		}
		expect(unresolved).toContain("캡션");
		expect(rejected).toContain("캡션");
		expect(noCaption).not.toContain("<figcaption");
	});

	it("미등록 이름은 본문 글자로 남는다(무음 손실 0)", async () => {
		const inline = await renderPublic("openai/gpt-oss-120b:free를 쓴다.");
		const container = await renderPublic(":::unknown\n안쪽 :free를 그대로\n:::");

		expect(inline).toContain("gpt-oss-120b:free를");
		expect(container).toContain("안쪽 :free를 그대로");
	});
});
