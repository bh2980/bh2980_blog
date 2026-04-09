export const CHART_TYPES = ["bar", "line", "area", "pie"] as const;
export const CHART_THEME_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

export type ChartType = (typeof CHART_TYPES)[number];
export type ChartThemeToken = (typeof CHART_THEME_TOKENS)[number];

export type ChartDslParseError = {
	line: number;
	message: string;
};

export type ChartDslParseSeries = {
	key: string;
	label: string;
	colorToken: string;
};

export type ChartDslParseResult = {
	source: string;
	type?: ChartType;
	xKey?: string;
	labelKey?: string;
	valueKey?: string;
	showValues: boolean;
	showValuesLine?: number;
	hideGrid: boolean;
	hideGridLine?: number;
	yRange?: {
		min: number;
		max: number;
	};
	yRangeLine?: number;
	series: ChartDslParseSeries[];
	tableHeaders: string[];
	rows: string[][];
	dataLine?: number;
	errors: ChartDslParseError[];
};

export type ChartRenderError = ChartDslParseError;

export type NormalizedChartSeries = {
	key: string;
	label: string;
	colorToken: ChartThemeToken;
};

export type CartesianChartSpec = {
	type: "bar" | "line" | "area";
	data: Array<Record<string, string | number>>;
	series: NormalizedChartSeries[];
	xKey: string;
	options: {
		showTooltip: boolean;
		showLegend: boolean;
		showValues: boolean;
		hideGrid: boolean;
		yRange?: {
			min: number;
			max: number;
		};
	};
};

export type PieChartSpec = {
	type: "pie";
	data: Array<Record<string, string | number>>;
	series: [];
	labelKey: string;
	valueKey: string;
	options: {
		showTooltip: boolean;
		showLegend: boolean;
	};
};

export type NormalizedChartSpec = CartesianChartSpec | PieChartSpec;

export type NormalizeChartResult = {
	spec?: NormalizedChartSpec;
	errors: ChartRenderError[];
};
