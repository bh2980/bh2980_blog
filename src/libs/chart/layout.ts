export type ChartDimensions = {
	width: number;
	height: number;
};

export const DEFAULT_CHART_DIMENSIONS: ChartDimensions = {
	width: 520,
	height: 280,
};

export const CHART_LEGEND_HEIGHT = 36;

const resolveDimension = (value: number, fallback: number) => {
	if (!Number.isFinite(value) || value <= 0) {
		return fallback;
	}

	return value;
};

export const resolvePieGeometry = (dimensions: ChartDimensions, showLegend: boolean) => {
	const width = resolveDimension(dimensions.width, DEFAULT_CHART_DIMENSIONS.width);
	const height = resolveDimension(dimensions.height, DEFAULT_CHART_DIMENSIONS.height);
	const legendSpace = showLegend ? CHART_LEGEND_HEIGHT : 0;
	const pieAreaHeight = Math.max(height - legendSpace - 12, 96);
	const maxRadius = Math.max(Math.min(width, pieAreaHeight) / 2, 40);
	const outerRadius = Math.max(Math.round(maxRadius * 0.76), 36);
	const innerRadius = Math.max(Math.round(outerRadius * 0.56), 20);
	const cy = showLegend ? Math.round((height - legendSpace) / 2 - 4) : Math.round(height / 2);

	return {
		cx: Math.round(width / 2),
		cy,
		innerRadius,
		outerRadius,
	};
};
