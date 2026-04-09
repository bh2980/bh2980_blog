import { describe, expect, it } from "vitest";
import { CHART_LEGEND_HEIGHT, DEFAULT_CHART_DIMENSIONS, resolvePieGeometry } from "../layout";

describe("resolvePieGeometry", () => {
	it("작은 컨테이너에서는 파이 반지름을 함께 줄인다", () => {
		const large = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, true);
		const small = resolvePieGeometry({ width: 240, height: 160 }, true);

		expect(small.outerRadius).toBeLessThan(large.outerRadius);
		expect(small.innerRadius).toBeLessThan(large.innerRadius);
		expect(small.outerRadius * 2).toBeLessThan(160 - CHART_LEGEND_HEIGHT);
	});

	it("범례가 있으면 파이 중심을 위로 올린다", () => {
		const withLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, true);
		const withoutLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, false);

		expect(withLegend.cy).toBeLessThan(withoutLegend.cy);
	});

	it("유효하지 않은 크기 값이면 기본 크기를 사용한다", () => {
		const fallback = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, false);
		const invalid = resolvePieGeometry({ width: 0, height: Number.NaN }, false);

		expect(invalid).toEqual(fallback);
	});
});
