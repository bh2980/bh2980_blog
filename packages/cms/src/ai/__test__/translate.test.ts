import { describe, expect, it } from "vitest";
import { withBuiltin } from "../builtins";
import type { AiFeatureSpec } from "../definition";
import { AiError } from "../errors";
import type { AiProvider, AiRequest } from "../provider";
import { translateBlocks } from "../translate";

const spec = (patch: Partial<AiFeatureSpec> = {}): AiFeatureSpec => {
	const base = withBuiltin("translate", {});
	if (!base) throw new Error("번역 기능이 없습니다.");
	return { ...base, ...patch };
};

function provider(answer: (request: AiRequest<unknown>) => unknown) {
	const requests: AiRequest<unknown>[] = [];
	const generator: AiProvider = {
		name: "fake",
		model: "m",
		generate: async <T>(request: AiRequest<T>) => {
			requests.push(request as AiRequest<unknown>);
			return answer(request as AiRequest<unknown>) as T;
		},
	};
	return { generator, requests };
}

const body = (blocks: Array<{ id: string; mdx: string }>, request?: string) => ({
	sourceLocale: "ko",
	targetLocale: "en",
	blocks,
	...(request ? { request } : {}),
});

describe("본문 블록 번역", () => {
	it("블록마다 번역하고, 구조 검사를 통과한 것만 돌려준다", async () => {
		const { generator, requests } = provider((request) => {
			const source = String(request.data.body);
			return { mdx: source === "[링크](/a)" ? "[link](/b)" : "Hello **world**" };
		});
		const results = await translateBlocks(
			spec(),
			body([
				{ id: "b0", mdx: "안녕 **세상**" },
				{ id: "b1", mdx: "[링크](/a)" },
			]),
			generator,
		);
		expect(results[0]).toEqual({ id: "b0", mdx: "Hello **world**" });
		expect(results[1]).toMatchObject({ id: "b1", error: expect.stringContaining("구조") });
		expect(requests[0]?.system).toContain("대상 언어: English");
		expect(requests[0]?.content[0]).toMatchObject({ text: expect.stringContaining("<source_mdx>") });
	});

	it("구조 유지 검사를 끄면 MDX로 읽을 수 있는지만 본다", async () => {
		const { generator } = provider(() => ({ mdx: "[link](/b)" }));
		const off = spec({ checks: [{ kind: "structure", enabled: false }] });
		expect(await translateBlocks(off, body([{ id: "b0", mdx: "[링크](/a)" }]), generator)).toEqual([
			{ id: "b0", mdx: "[link](/b)" },
		]);
	});

	it("추가 요청은 요청 받기가 켜져 있을 때만 지시문에 붙는다", async () => {
		const { generator, requests } = provider(() => ({ mdx: "Hi" }));
		await translateBlocks(spec(), body([{ id: "b0", mdx: "안녕" }], "존댓말로"), generator);
		await translateBlocks(spec({ askInstruction: false }), body([{ id: "b0", mdx: "안녕" }], "무시"), generator);
		expect(requests[0]?.system).toContain("이번 요청(위 지시보다 우선):\n존댓말로");
		expect(requests[1]?.system).not.toContain("무시");
	});

	it("한 블록의 형식 오류는 그 블록만 실패로, 키·요청 수 문제는 요청 전체를 멈춘다", async () => {
		const failing = provider((request) => {
			if (request.data.body === "나쁨") throw new AiError("ai_failed", "형식 오류");
			return { mdx: "Good" };
		});
		expect(
			await translateBlocks(
				spec(),
				body([
					{ id: "b0", mdx: "좋음" },
					{ id: "b1", mdx: "나쁨" },
				]),
				failing.generator,
			),
		).toEqual([
			{ id: "b0", mdx: "Good" },
			{ id: "b1", error: "형식 오류" },
		]);

		const limited = provider(() => {
			throw new AiError("ai_rate_limited", "요청이 많습니다.");
		});
		await expect(translateBlocks(spec(), body([{ id: "b0", mdx: "가" }]), limited.generator)).rejects.toMatchObject({
			code: "ai_rate_limited",
		});
	});
});
