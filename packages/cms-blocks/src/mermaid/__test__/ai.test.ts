import { describe, expect, it } from "vitest";
import { chartAi, validateChart } from "../../chart/ai";
import { mermaidAi, validateMermaid } from "../ai";

describe("다이어그램·차트 AI 결과의 코드 검사", () => {
	it("Mermaid: 펜스 하나이고 아는 다이어그램 종류만 통과한다", () => {
		expect(validateMermaid("```mermaid\ngraph TD\n  A --> B\n```")).toBeUndefined();
		expect(validateMermaid("```mermaid\n%% 설명\nsequenceDiagram\n  A->>B: 안녕\n```")).toBeUndefined();
		expect(validateMermaid("graph TD\n  A --> B")).toBe("```mermaid 코드 펜스 하나가 아닙니다.");
		expect(validateMermaid("```mermaid\n```")).toBe("다이어그램이 비었습니다.");
		expect(validateMermaid("```mermaid\ngrpah TD\n```")).toBe("알 수 없는 다이어그램 종류입니다: grpah");
		expect(validateMermaid("설명\n\n```mermaid\ngraph TD\n```")).toBe("```mermaid 코드 펜스 하나가 아닙니다.");
	});

	it("차트: 펜스 하나이고 차트 문법에 맞아야 한다", () => {
		const chart = (body: string) => `\`\`\`chart\n${body}\n\`\`\``;
		expect(
			validateChart(chart("chart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200")),
		).toBeUndefined();
		expect(validateChart(chart("chart radar\ndata"))).toBe("차트 문법 오류(1줄): 지원하지 않는 차트 타입입니다: radar");
		expect(
			validateChart(chart("chart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 많음")),
		).toBe("차트 문법 오류(7줄): 숫자 필드 views 는 숫자여야 합니다.");
		expect(validateChart("chart bar")).toBe("```chart 코드 펜스 하나가 아닙니다.");
	});

	it("가짜 연결의 답(fake)은 문법 검사를 통과하고, 고칠 블록은 모양을 지킨 채 한 줄을 더한다", () => {
		const diagram = "```mermaid\ngraph TD\n  A --> B\n```";
		const mermaidDraft = mermaidAi.draft().fake({ title: '"따옴표" 제목' });
		const mermaidEdit = mermaidAi.edit().fake({ block: diagram });
		expect(validateMermaid(mermaidDraft)).toBeUndefined();
		expect(validateMermaid(mermaidEdit)).toBeUndefined();
		expect(mermaidEdit).toContain("A --> B");
		expect(mermaidEdit).not.toBe(diagram);

		const chart =
			"```chart\nchart bar\nx month\nseries views | 조회수 | chart-1\n\ndata\nmonth | views\nJan | 1200\n```";
		const chartDraft = chartAi.draft().fake({ title: "a | b" });
		const chartEdit = chartAi.edit().fake({ block: chart });
		expect(validateChart(chartDraft)).toBeUndefined();
		expect(validateChart(chartEdit)).toBeUndefined();
		expect(chartEdit.match(/Jan \| 1200/g)).toHaveLength(2);
	});
});
