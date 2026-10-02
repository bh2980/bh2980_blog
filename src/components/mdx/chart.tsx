"use client";

import { AlertOctagon } from "lucide-react";
import { Children, isValidElement, type ReactNode, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	Line,
	LineChart,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	type CartesianChartSpec,
	CHART_LEGEND_HEIGHT,
	type ChartRenderError,
	type NormalizedChartSpec,
	normalizeChartDsl,
	type PieChartSpec,
	parseChartDsl,
	resolvePieGeometry,
} from "@/libs/chart";
import { useTranslate } from "@/libs/i18n/use-locale";
import { cn } from "@/utils/cn";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	useChartDimensions,
} from "../ui/chart";

const extractText = (node: ReactNode): string => {
	if (node == null || typeof node === "boolean") return "";
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(extractText).join("");
	if (!isValidElement<{ children?: ReactNode }>(node)) return "";
	return extractText(node.props.children);
};

const toChartConfig = (spec: NormalizedChartSpec): ChartConfig => {
	if (spec.type === "pie" && spec.labelKey) {
		return Object.fromEntries(
			spec.data.map((row) => [
				String(row[spec.labelKey] ?? ""),
				{
					label: String(row[spec.labelKey] ?? ""),
					color: String(row.fill ?? "var(--chart-1)"),
				},
			]),
		);
	}

	return Object.fromEntries(
		spec.series.map((series) => [
			series.key,
			{
				label: series.label,
				color: `var(--${series.colorToken})`,
			},
		]),
	);
};

/**
 * Y축 눈금 글자 폭(px)을 데이터에서 어림한다. recharts의 `width="auto"`는 브라우저에서 글자를 재서
 * 서버 HTML과 달라지므로(hydration 불일치) 쓰지 않는다. 기본 고정 폭 60px은 두 자리 수에도 왼쪽이 빈다.
 */
const Y_AXIS_CHAR_WIDTH = 7;
const Y_AXIS_TICK_GAP = 14;
const estimateYAxisWidth = (spec: CartesianChartSpec) => {
	const values = spec.data.flatMap((row) =>
		spec.series.map((series) => Number(row[series.key])).filter((value) => Number.isFinite(value)),
	);
	if (spec.options.yRange) values.push(spec.options.yRange.min, spec.options.yRange.max);
	// 눈금은 데이터 최댓값보다 한 단계 크게 잡힐 수 있다(예: 95 → 100).
	const labels = values.flatMap((value) => [String(value), String(Math.round(value * 1.25))]);
	const longest = Math.max(1, ...labels.map((label) => label.length));
	return longest * Y_AXIS_CHAR_WIDTH + Y_AXIS_TICK_GAP;
};

const ChartErrorCard = ({ errors }: { errors: ChartRenderError[] }) => {
	const { t } = useTranslate();
	return (
		<div className="not-prose my-6">
			<Alert variant="danger">
				<AlertOctagon />
				<AlertTitle>{t("mdx.chartError")}</AlertTitle>
				<AlertDescription>
					<ul className="ml-4 list-disc space-y-1">
						{errors.map((error) => (
							<li key={`${error.line}-${error.message}`}>
								{t("mdx.chartErrorLine", { line: error.line, message: error.message })}
							</li>
						))}
					</ul>
				</AlertDescription>
			</Alert>
		</div>
	);
};

const cartesianChartComponents = {
	bar: BarChart,
	line: LineChart,
	area: AreaChart,
} satisfies Record<CartesianChartSpec["type"], typeof BarChart | typeof LineChart | typeof AreaChart>;

const formatChartValue = (value: string | number | boolean | null | undefined) => {
	if (value == null || value === false) {
		return "";
	}

	if (typeof value !== "number") {
		return String(value);
	}

	return value.toLocaleString();
};

const renderCartesianSeries = (spec: CartesianChartSpec) => {
	switch (spec.type) {
		case "bar":
			return spec.series.map((series) => (
				<Bar
					key={series.key}
					dataKey={series.key}
					fill={`var(--color-${series.key})`}
					radius={8}
					isAnimationActive={false}
				>
					{spec.options.showValues ? (
						<LabelList
							position="top"
							offset={8}
							formatter={formatChartValue}
							className="fill-foreground font-medium text-[11px]"
						/>
					) : null}
				</Bar>
			));
		case "line":
			return spec.series.map((series) => (
				<Line
					key={series.key}
					type="monotone"
					dataKey={series.key}
					stroke={`var(--color-${series.key})`}
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				>
					{spec.options.showValues ? (
						<LabelList
							position="top"
							offset={10}
							formatter={formatChartValue}
							className="fill-foreground font-medium text-[11px]"
						/>
					) : null}
				</Line>
			));
		case "area":
			return spec.series.map((series) => (
				<Area
					key={series.key}
					type="monotone"
					dataKey={series.key}
					stroke={`var(--color-${series.key})`}
					fill={`var(--color-${series.key})`}
					fillOpacity={0.24}
					isAnimationActive={false}
				>
					{spec.options.showValues ? (
						<LabelList
							position="top"
							offset={10}
							formatter={formatChartValue}
							className="fill-foreground font-medium text-[11px]"
						/>
					) : null}
				</Area>
			));
	}
};

const ResponsivePie = ({ spec, legendHeight }: { spec: PieChartSpec; legendHeight: number }) => {
	const dimensions = useChartDimensions();
	const geometry = resolvePieGeometry(dimensions, spec.options.showLegend ? legendHeight : 0);

	return (
		<Pie data={spec.data} dataKey={spec.valueKey} nameKey={spec.labelKey} isAnimationActive={false} {...geometry} />
	);
};

const CartesianChart = ({ spec, className }: { spec: CartesianChartSpec; className?: string }) => {
	const config = toChartConfig(spec);
	const ChartComponent = cartesianChartComponents[spec.type];
	const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);

	return (
		<ChartContainer config={config} className={cn("not-prose my-6 w-full min-w-0", className)}>
			<ChartComponent
				accessibilityLayer
				data={spec.data}
				margin={{
					top: spec.options.showValues ? 28 : 12,
					right: 12,
					// Y축 폭은 눈금 글자에 맞춘다(estimateYAxisWidth). 고정 폭(60)에 여백을 더하면 왼쪽이 비어 보인다.
					left: spec.options.hideYAxis ? 12 : 0,
					bottom: 0,
				}}
			>
				{spec.options.hideGrid ? null : <CartesianGrid vertical={false} />}
				<XAxis dataKey={spec.xKey} tickLine={false} tickMargin={10} axisLine={false} />
				<YAxis
					hide={spec.options.hideYAxis}
					width={estimateYAxisWidth(spec)}
					tickLine={false}
					tickMargin={10}
					axisLine={false}
					domain={spec.options.yRange ? [spec.options.yRange.min, spec.options.yRange.max] : undefined}
					allowDataOverflow={!!spec.options.yRange}
				/>
				<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
				{spec.options.showLegend ? (
					<ChartLegend
						verticalAlign="bottom"
						height={legendHeight}
						content={<ChartLegendContent onHeightChange={setLegendHeight} />}
					/>
				) : null}
				{renderCartesianSeries(spec)}
			</ChartComponent>
		</ChartContainer>
	);
};

const PieChartRenderer = ({ spec, className }: { spec: PieChartSpec; className?: string }) => {
	const config = toChartConfig(spec);
	const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);

	return (
		<ChartContainer config={config} className={cn("not-prose my-6 w-full min-w-0", className)}>
			<PieChart>
				<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey={spec.labelKey} />} />
				{spec.options.showLegend ? (
					<ChartLegend
						verticalAlign="bottom"
						height={legendHeight}
						content={<ChartLegendContent nameKey={spec.labelKey} onHeightChange={setLegendHeight} />}
					/>
				) : null}
				<ResponsivePie spec={spec} legendHeight={legendHeight} />
			</PieChart>
		</ChartContainer>
	);
};

export const Chart = ({
	children,
	source,
	className,
}: {
	children?: ReactNode;
	source?: string;
	className?: string;
}) => {
	const chartSource = useMemo(
		() => source ?? Children.toArray(children).map(extractText).join("\n"),
		[children, source],
	);
	const normalized = useMemo(() => normalizeChartDsl(parseChartDsl(chartSource)), [chartSource]);

	if (!normalized.spec) {
		return <ChartErrorCard errors={normalized.errors} />;
	}

	return normalized.spec.type === "pie" ? (
		<PieChartRenderer spec={normalized.spec} className={className} />
	) : (
		<CartesianChart spec={normalized.spec} className={className} />
	);
};
