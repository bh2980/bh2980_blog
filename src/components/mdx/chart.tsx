"use client";

import { AlertOctagon } from "lucide-react";
import { Children, isValidElement, type ReactNode, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis } from "recharts";
import {
	type CartesianChartSpec,
	type ChartRenderError,
	type NormalizedChartSpec,
	normalizeChartDsl,
	type PieChartSpec,
	parseChartDsl,
} from "@/libs/chart";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
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

const CartesianChart = ({ spec }: { spec: CartesianChartSpec }) => {
	const config = toChartConfig(spec);

	return (
		<ChartContainer
			config={config}
			className="not-prose my-6 w-full min-w-0 rounded-xl border border-border/60 bg-card/60 p-4"
		>
			{spec.type === "bar" ? (
				<BarChart accessibilityLayer data={spec.data}>
					<CartesianGrid vertical={false} />
					<XAxis dataKey={spec.xKey} tickLine={false} tickMargin={10} axisLine={false} />
					<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
					{spec.options.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
					{spec.series.map((series) => (
						<Bar
							key={series.key}
							dataKey={series.key}
							fill={`var(--color-${series.key})`}
							radius={8}
							isAnimationActive={false}
						/>
					))}
				</BarChart>
			) : null}

			{spec.type === "line" ? (
				<LineChart accessibilityLayer data={spec.data}>
					<CartesianGrid vertical={false} />
					<XAxis dataKey={spec.xKey} tickLine={false} tickMargin={10} axisLine={false} />
					<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
					{spec.options.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
					{spec.series.map((series) => (
						<Line
							key={series.key}
							type="monotone"
							dataKey={series.key}
							stroke={`var(--color-${series.key})`}
							strokeWidth={2}
							dot={false}
							isAnimationActive={false}
						/>
					))}
				</LineChart>
			) : null}

			{spec.type === "area" ? (
				<AreaChart accessibilityLayer data={spec.data}>
					<CartesianGrid vertical={false} />
					<XAxis dataKey={spec.xKey} tickLine={false} tickMargin={10} axisLine={false} />
					<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
					{spec.options.showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
					{spec.series.map((series) => (
						<Area
							key={series.key}
							type="monotone"
							dataKey={series.key}
							stroke={`var(--color-${series.key})`}
							fill={`var(--color-${series.key})`}
							fillOpacity={0.24}
							isAnimationActive={false}
						/>
					))}
				</AreaChart>
			) : null}
		</ChartContainer>
	);
};

const PieChartRenderer = ({ spec }: { spec: PieChartSpec }) => {
	const config = toChartConfig(spec);

	return (
		<ChartContainer
			config={config}
			className="not-prose my-6 w-full min-w-0 rounded-xl border border-border/60 bg-card/60 p-4"
		>
			<PieChart>
				<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey={spec.labelKey} />} />
				{spec.options.showLegend ? <ChartLegend content={<ChartLegendContent nameKey={spec.labelKey} />} /> : null}
				<Pie
					data={spec.data}
					dataKey={spec.valueKey}
					nameKey={spec.labelKey}
					innerRadius={48}
					outerRadius={88}
					isAnimationActive={false}
				/>
			</PieChart>
		</ChartContainer>
	);
};

export const Chart = ({ children, source }: { children?: ReactNode; source?: string }) => {
	const chartSource = useMemo(
		() => source ?? Children.toArray(children).map(extractText).join("\n"),
		[children, source],
	);
	const normalized = useMemo(() => normalizeChartDsl(parseChartDsl(chartSource)), [chartSource]);

	if (!normalized.spec) {
		return <ChartErrorCard errors={normalized.errors} />;
	}

	return normalized.spec.type === "pie" ? (
		<PieChartRenderer spec={normalized.spec} />
	) : (
		<CartesianChart spec={normalized.spec} />
	);
};
