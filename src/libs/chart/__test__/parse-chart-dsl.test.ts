import { describe, expect, it } from "vitest";
import { normalizeChartDsl, parseChartDsl } from "../parse-chart-dsl";

describe("parseChartDsl", () => {
	it("bar chart DSL을 파싱하고 정규화한다", () => {
		const source = [
			"chart bar",
			"x month",
			"series views | 조회수 | chart-1",
			"series likes | 좋아요 | chart-2",
			"",
			"data",
			"month | views | likes",
			"Jan | 1200 | 200",
			"Feb | 1800 | 260",
		].join("\n");

		const parsed = parseChartDsl(source);
		expect(parsed.errors).toEqual([]);
		expect(parsed.type).toBe("bar");
		expect(parsed.xKey).toBe("month");
		expect(parsed.series).toEqual([
			{ key: "views", label: "조회수", colorToken: "chart-1" },
			{ key: "likes", label: "좋아요", colorToken: "chart-2" },
		]);

		const normalized = normalizeChartDsl(parsed);
		expect(normalized.errors).toEqual([]);
		expect(normalized.spec).toMatchObject({
			type: "bar",
			xKey: "month",
			options: { showTooltip: true, showLegend: true },
			series: [
				{ key: "views", label: "조회수", colorToken: "chart-1" },
				{ key: "likes", label: "좋아요", colorToken: "chart-2" },
			],
			data: [
				{ month: "Jan", views: 1200, likes: 200 },
				{ month: "Feb", views: 1800, likes: 260 },
			],
		});
	});

	it("single-series line chart는 범례를 숨긴다", () => {
		const source = [
			"chart line",
			"x month",
			"series views | 조회수 | chart-1",
			"",
			"data",
			"month | views",
			"Jan | 1200",
			"Feb | 1800",
		].join("\n");

		const normalized = normalizeChartDsl(parseChartDsl(source));
		expect(normalized.errors).toEqual([]);
		expect(normalized.spec?.options.showLegend).toBe(false);
	});

	it("pie chart DSL을 파싱하고 색상을 자동 배정한다", () => {
		const source = [
			"chart pie",
			"label browser",
			"value visitors",
			"",
			"data",
			"browser | visitors",
			"Chrome | 275",
			"Safari | 200",
			"Firefox | 187",
		].join("\n");

		const normalized = normalizeChartDsl(parseChartDsl(source));
		expect(normalized.errors).toEqual([]);
		expect(normalized.spec).toMatchObject({
			type: "pie",
			labelKey: "browser",
			valueKey: "visitors",
			options: { showTooltip: true, showLegend: true },
		});
		expect(normalized.spec?.data).toEqual([
			{ browser: "Chrome", visitors: 275, fill: "var(--chart-1)" },
			{ browser: "Safari", visitors: 200, fill: "var(--chart-2)" },
			{ browser: "Firefox", visitors: 187, fill: "var(--chart-3)" },
		]);
	});

	it("알 수 없는 차트 타입이면 오류를 반환한다", () => {
		const parsed = parseChartDsl(["chart radar", "data", "a", "b"].join("\n"));
		expect(parsed.errors).toEqual([{ line: 1, message: "지원하지 않는 차트 타입입니다: radar" }]);
	});

	it("series 색상 토큰이 허용 범위를 벗어나면 오류를 반환한다", () => {
		const parsed = parseChartDsl(
			["chart area", "x month", "series views | 조회수 | blue", "", "data", "month | views", "Jan | 1200"].join("\n"),
		);

		expect(parsed.errors).toEqual([{ line: 3, message: "색상은 chart-1 ~ chart-5 토큰만 사용할 수 있습니다." }]);
	});

	it("data 헤더와 series key가 일치하지 않으면 정규화 오류를 반환한다", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				["chart bar", "x month", "series views | 조회수 | chart-1", "", "data", "month | likes", "Jan | 1200"].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([{ line: 6, message: "data 헤더에 series key가 모두 포함되어야 합니다." }]);
	});

	it("숫자 필드에 숫자가 아닌 값이 오면 오류를 반환한다", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				["chart pie", "label browser", "value visitors", "", "data", "browser | visitors", "Chrome | many"].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([{ line: 7, message: "숫자 필드 visitors 는 숫자여야 합니다." }]);
	});
});
