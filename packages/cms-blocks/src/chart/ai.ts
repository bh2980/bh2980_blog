import { aiAction, aiInput } from "@bh2980/cms-ai";
import { normalizeChartDsl, parseChartDsl } from "./dsl";

/**
 * 차트 블록의 AI 기능(`@bh2980/cms-ai`를 쓰는 사이트만). `aiPlugin({ actions })`에 이름을 붙여 넣는다.
 *
 * ```ts
 * aiPlugin({ actions: { chartDraft: chartAi.draft(), chartEdit: chartAi.edit() } })
 * ```
 */

const lines = (...text: string[]) => text.join("\n");

/** 차트 문법(`parseChartDsl`) 설명. 지시문에 넣는다. */
export const CHART_SYNTAX_GUIDE = lines(
	"차트 문법(```chart 코드 펜스 안):",
	"- 첫 줄: chart <bar|line|area|pie>",
	"- 막대·선·영역(bar·line·area): x <가로축 열 이름>, 그리고 계열마다 series <열 이름> | <보일 이름> | <chart-1~chart-5>",
	"- 원(pie): label <이름 열>, value <숫자 열>. series·show-values·hide-grid·hide-y-axis·y-range는 쓰지 않는다",
	"- 고를 수 있는 줄: show-values, hide-grid, hide-y-axis, y-range <최솟값> <최댓값>",
	"- 그다음 data 줄, 그 아래 첫 줄은 열 이름을 | 로 나눈 머리 행, 이어서 값 행(숫자 열은 숫자만)",
	"예:",
	"```chart",
	"chart bar",
	"x month",
	"series views | 조회수 | chart-1",
	"",
	"data",
	"month | views",
	"1월 | 1200",
	"2월 | 1500",
	"```",
);

/** 코드 검사: 답이 ```chart 코드 펜스 하나이고 차트 문법(`parseChartDsl`·`normalizeChartDsl`)에 맞는가. */
export function validateChart(value: string): string | undefined {
	const match = value.trim().match(/^```chart[^\n]*\n([\s\S]*?)\n?```$/);
	if (!match) return "```chart 코드 펜스 하나가 아닙니다.";
	const { errors } = normalizeChartDsl(parseChartDsl(match[1] ?? ""));
	const [first] = errors;
	return first ? `차트 문법 오류(${first.line}줄): ${first.message}` : undefined;
}

export const chartAi = {
	/** 차트 만들기. 슬래시 메뉴에서 요청을 받아 커서 자리에 차트 블록을 넣는다. */
	draft: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "차트 만들기",
			input: { title: aiInput.text({ label: "제목" }), body: aiInput.mdx({ label: "지금 본문" }) },
			result: "mdx",
			stream: true,
			askInstruction: true,
			prompt:
				options.prompt ??
				lines(
					"요청과 글의 제목·본문을 보고 차트 하나를 만든다.",
					"- 답은 ```chart 코드 펜스 하나만 쓴다. 펜스 밖에는 아무것도 쓰지 않는다",
					"- 값은 요청이나 본문에 있는 것만 쓴다. 없으면 지어내지 않고 예시 값임을 열 이름에 적는다",
					"",
					CHART_SYNTAX_GUIDE,
				),
			validate: validateChart,
			attach: [{ slot: "insert" }],
		}),

	/** 차트 고치기. 블록 손잡이 옆에서 요청대로 고치고, 바뀐 곳을 보인 뒤 블록을 바꾼다. */
	edit: (options: { readonly prompt?: string } = {}) =>
		aiAction({
			label: "차트 고치기",
			input: { block: aiInput.mdx({ label: "차트", required: true }), title: aiInput.text({ label: "제목" }) },
			result: "mdx",
			stream: true,
			askInstruction: true,
			prompt:
				options.prompt ??
				lines(
					"차트(```chart 코드 펜스)를 요청대로 고친다.",
					"- 답은 고친 ```chart 코드 펜스 하나만 쓴다. 펜스 밖에는 아무것도 쓰지 않는다",
					"- 요청과 상관없는 부분은 그대로 둔다",
					"- 요청이 없으면 문법 오류를 고친다",
					"",
					CHART_SYNTAX_GUIDE,
				),
			validate: validateChart,
			attach: [{ slot: "block", block: "chart" }],
		}),
};
