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

const ChartErrorCard = ({ errors }: { errors: ChartRenderError[] }) => {
	return (
		<div className="not-prose my-6">
			<Alert variant="danger">
				<AlertOctagon />
				<AlertTitle>차트 문법 오류</AlertTitle>
				<AlertDescription>
					<ul className="ml-4 list-disc space-y-1">
						{errors.map((error) => (
							<li key={`${error.line}-${error.message}`}>
								{error.line}줄: {error.message}
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
					left: spec.options.hideYAxis ? 12 : 40,
					bottom: 24,
				}}
			>
				{spec.options.hideGrid ? null : <CartesianGrid vertical={false} />}
				<XAxis dataKey={spec.xKey} tickLine={false} tickMargin={10} axisLine={false} />
				<YAxis
					hide={spec.options.hideYAxis}
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
