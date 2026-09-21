import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compileMDX } from "next-mdx-remote/rsc";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readLegacyCorpus } from "@/cms/migrate-from-files/legacy-parser";
import { auditRoundTrip, summarizeAudit } from "@/cms/migrate-from-files/roundtrip-audit";
import { MDX_COMPONENTS, MDX_REHYPE_PLUGINS, MDX_REMARK_PLUGINS, renderMDX } from "@/components/mdx/mdx-content";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

/**
 * `pre`는 async RSC 컴포넌트라 react-dom 정적 렌더러가 await하지 못한다(내용 문제가 아니라 렌더러 제약).
 * 코드 펜스가 있는 문서를 정적 마크업으로 확인할 때만 같은 마크업의 동기 대체 컴포넌트를 쓴다.
 * 플러그인 체인과 나머지 컴포넌트는 공개 렌더와 완전히 같은 것을 쓴다.
 */
const PreShim = ({
	children,
	title,
	showLineNumbers,
	code,
}: {
	children?: ReactNode;
	title?: string;
	showLineNumbers?: boolean;
	code?: string;
}) => (
	<div
		data-audit-pre-shim
		data-title={title}
		data-lnum={showLineNumbers ? "1" : "0"}
		data-code-length={code?.length ?? 0}
	>
		{children}
	</div>
);

const renderWithPreShim = async (source: string): Promise<string> => {
	const { content } = await compileMDX({
		source,
		options: {
			mdxOptions: {
				remarkPlugins: MDX_REMARK_PLUGINS(),
				rehypePlugins: MDX_REHYPE_PLUGINS,
			},
		},
		components: { ...MDX_COMPONENTS, pre: PreShim },
	});
	return renderToStaticMarkup(content);
};

interface RenderResult {
	ok: boolean;
	mode: "production" | "sync-pre-shim" | "compile-only";
	error: string | null;
	htmlLength: number;
}

const renderSafely = async (source: string): Promise<RenderResult> => {
	try {
		const { content } = await renderMDX(source);
		try {
			const html = renderToStaticMarkup(content);
			return { ok: true, mode: "production", error: null, htmlLength: html.length };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!message.includes("suspended")) {
				return { ok: false, mode: "production", error: message, htmlLength: 0 };
			}
			const html = await renderWithPreShim(source);
			return { ok: true, mode: "sync-pre-shim", error: message, htmlLength: html.length };
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, mode: "compile-only", error: message, htmlLength: 0 };
	}
};

describe("M6-ED-1 전편 왕복·공개 렌더 검수", () => {
	it("49편 모두 구조 왕복이 동일하고 production 렌더 체인을 통과한다", async () => {
		const corpus = readLegacyCorpus(REPO_ROOT);
		const items = [
			...corpus.posts.map((item) => ({ item, kind: "post" as const })),
			...corpus.memos.map((item) => ({ item, kind: "memo" as const })),
		];

		const samples = [];
		const renders: { path: string; kind: string; original: RenderResult; roundTripped: RenderResult }[] = [];

		for (const { item, kind } of items) {
			const audited = auditRoundTrip(item.mdx, { path: item.path, slug: item.slug, kind, status: item.status });
			samples.push(audited.sample);

			renders.push({
				path: item.path,
				kind,
				original: await renderSafely(item.mdx),
				roundTripped: await renderSafely(audited.roundTrippedSource),
			});
		}

		const generatedAt = new Date().toISOString();
		const audit = summarizeAudit(samples, generatedAt);
		const renderFailures = renders.filter((render) => !render.original.ok || !render.roundTripped.ok);
		const shimmed = renders.filter(
			(render) => render.original.mode === "sync-pre-shim" || render.roundTripped.mode === "sync-pre-shim",
		);

		const report = {
			...audit,
			render: {
				checked: renders.length * 2,
				failures: renderFailures,
				shimmedCount: shimmed.length,
				/** production 마크업으로 렌더된 문서의 원본 vs 왕복 HTML 길이 차이(참고용, 실패 조건 아님). */
				productionMarkupLengthDiffs: renders
					.filter((render) => render.original.mode === "production" && render.roundTripped.mode === "production")
					.map((render) => ({
						path: render.path,
						original: render.original.htmlLength,
						roundTripped: render.roundTripped.htmlLength,
					}))
					.filter((entry) => entry.original !== entry.roundTripped),
				results: renders,
			},
			summary: {
				files: audit.fileCount,
				structuralMismatches: audit.structuralMismatches,
				analyzeErrors: audit.analyzeErrors,
				reparseErrors: audit.reparseErrors,
				renderFailures: renderFailures.length,
				surfaceOnlyNormalizations: audit.classification.normalization.length,
				productionMarkupRenders: renders.filter(
					(render) => render.original.mode === "production" && render.roundTripped.mode === "production",
				).length,
				syncPreShimRenders: shimmed.length,
			},
			notes: [
				"구조 동등성은 analyze→toDocument→serialize→toDocument canonical 비교로 판정한다. 표기만 다른 경우는 normalizations로 분류한다.",
				"classification.unclassified는 정규화로 분류되지 않은 표기 차이다. 구조 동등성이 이미 증명된 항목만 들어가며(전환 차단 아님), 파일별 목록과 surfaceSamples로 수동 확인할 수 있다.",
				"공개 렌더는 production remark/rehype 체인과 실제 컴포넌트 표로 compileMDX를 실행하고, 마크업은 react-dom 정적 렌더러로 확인한다.",
				"코드 펜스가 있는 문서는 async RSC 컴포넌트(pre) 때문에 정적 렌더러가 멈추므로 같은 플러그인·나머지 컴포넌트에 pre만 동기 대체한 shim으로 마크업을 확인한다(내용 문제 아님, 렌더러 제약).",
			],
		};

		const runId = generatedAt.replace(/[:.]/g, "-");
		const outputDir = path.join(REPO_ROOT, "artifacts", "cms", "m6", runId);
		mkdirSync(outputDir, { recursive: true });
		writeFileSync(path.join(outputDir, "roundtrip-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

		console.log(
			`[M6-ED-1] files=${audit.fileCount} structuralMismatches=${audit.structuralMismatches} analyzeErrors=${audit.analyzeErrors} reparseErrors=${audit.reparseErrors} renderFailures=${renderFailures.length} production=${report.summary.productionMarkupRenders} shimmed=${shimmed.length} normalizations=${audit.classification.normalization.length}`,
		);

		expect(audit.fileCount).toBe(49);
		expect(audit.classification.blocking).toEqual([]);
		expect(renderFailures).toEqual([]);
		expect(audit.structuralMismatches).toBe(0);
		// 구조 동일이 이미 증명된 표기 차이만 남는다. 임계값으로 고정하고 파일별 목록·샘플은 보고서에 남긴다.
		expect(audit.classification.unclassified.length).toBeLessThanOrEqual(40);
	}, 900_000);
});
