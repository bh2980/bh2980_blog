import {
	CHART_THEME_TOKENS,
	CHART_TYPES,
	type ChartDslParseError,
	type ChartDslParseResult,
	type ChartThemeToken,
	type ChartType,
	type NormalizeChartResult,
} from "./types";

const isChartType = (value: string): value is ChartType => CHART_TYPES.includes(value as ChartType);
const isChartThemeToken = (value: string): value is ChartThemeToken =>
	CHART_THEME_TOKENS.includes(value as ChartThemeToken);

const splitTableRow = (line: string) => line.split("|").map((item) => item.trim());

const toError = (line: number, message: string): ChartDslParseError => ({ line, message });
const isBlankCell = (value: unknown) => typeof value === "string" && value.trim() === "";

export const parseChartDsl = (source: string): ChartDslParseResult => {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const errors: ChartDslParseError[] = [];
	const result: ChartDslParseResult = {
		source,
		series: [],
		tableHeaders: [],
		rows: [],
		errors,
	};

	const firstLine = lines[0]?.trim() ?? "";
	const firstMatch = firstLine.match(/^chart\s+(\S+)$/);
	if (!firstMatch) {
		errors.push(toError(1, "첫 줄은 chart <type> 형식이어야 합니다."));
		return result;
	}

	const rawType = firstMatch[1];
	if (!isChartType(rawType)) {
		errors.push(toError(1, `지원하지 않는 차트 타입입니다: ${rawType}`));
		return result;
	}

	result.type = rawType;

	let dataIndex = -1;
	for (let index = 1; index < lines.length; index += 1) {
		const trimmed = lines[index].trim();
		if (!trimmed) continue;

		if (trimmed === "data") {
			dataIndex = index;
			result.dataLine = index + 1;
			break;
		}

		if (trimmed.startsWith("x ")) {
			result.xKey = trimmed.slice(2).trim();
			continue;
		}

		if (trimmed.startsWith("label ")) {
			result.labelKey = trimmed.slice(6).trim();
			continue;
		}

		if (trimmed.startsWith("value ")) {
			result.valueKey = trimmed.slice(6).trim();
			continue;
		}

		if (trimmed.startsWith("series ")) {
			const payload = trimmed.slice(7).trim();
			const [key = "", label = "", colorToken = ""] = splitTableRow(payload);

			if (!key || !label || !colorToken) {
				errors.push(toError(index + 1, "series 줄은 series <key> | <label> | <theme-token> 형식이어야 합니다."));
				continue;
			}

			if (!isChartThemeToken(colorToken)) {
				errors.push(toError(index + 1, "색상은 chart-1 ~ chart-5 토큰만 사용할 수 있습니다."));
				continue;
			}

			if (result.series.some((series) => series.key === key)) {
				errors.push(toError(index + 1, `series key ${key} 가 중복되었습니다.`));
				continue;
			}

			result.series.push({ key, label, colorToken });
			continue;
		}

		errors.push(toError(index + 1, `알 수 없는 헤더입니다: ${trimmed}`));
	}

	if (dataIndex === -1) {
		errors.push(toError(lines.length, "data 섹션이 필요합니다."));
		return result;
	}

	const tableHeaderLine = lines[dataIndex + 1]?.trim() ?? "";
	if (!tableHeaderLine) {
		errors.push(toError(dataIndex + 2, "data 헤더 행이 필요합니다."));
		return result;
	}

	result.tableHeaders = splitTableRow(tableHeaderLine);

	for (let index = dataIndex + 2; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.trim()) continue;
		result.rows.push(splitTableRow(line));
	}

	return result;
};

export const normalizeChartDsl = (parsed: ChartDslParseResult): NormalizeChartResult => {
	if (parsed.errors.length > 0 || !parsed.type) {
		return { errors: [...parsed.errors] };
	}

	const errors = [...parsed.errors];
	const dataHeaderLine = (parsed.dataLine ?? 0) + 1;
	const rowStartLine = (parsed.dataLine ?? 0) + 2;

	if (parsed.type === "pie") {
		const labelKey = parsed.labelKey;
		const valueKey = parsed.valueKey;

		if (!labelKey) {
			errors.push(toError(2, "pie 차트는 label 필드가 필요합니다."));
		}
		if (!valueKey) {
			errors.push(toError(3, "pie 차트는 value 필드가 필요합니다."));
		}

		if (!labelKey || !valueKey) {
			return { errors };
		}

		if (!parsed.tableHeaders.includes(labelKey) || !parsed.tableHeaders.includes(valueKey)) {
			errors.push(toError(dataHeaderLine, "data 헤더에 label/value 필드가 모두 포함되어야 합니다."));
			return { errors };
		}

		const data = parsed.rows.map((row, index) => {
			const record = Object.fromEntries(parsed.tableHeaders.map((header, cellIndex) => [header, row[cellIndex] ?? ""]));
			if (isBlankCell(record[valueKey])) {
				errors.push(toError(rowStartLine + index, `숫자 필드 ${valueKey} 는 비어 있을 수 없습니다.`));
				return {
					[labelKey]: String(record[labelKey] ?? ""),
					[valueKey]: Number.NaN,
					fill: `var(--${CHART_THEME_TOKENS[index % CHART_THEME_TOKENS.length]})`,
				};
			}
			const numericValue = Number(record[valueKey]);
			if (!Number.isFinite(numericValue)) {
				errors.push(toError(rowStartLine + index, `숫자 필드 ${valueKey} 는 숫자여야 합니다.`));
			}

			return {
				[labelKey]: String(record[labelKey] ?? ""),
				[valueKey]: numericValue,
				fill: `var(--${CHART_THEME_TOKENS[index % CHART_THEME_TOKENS.length]})`,
			};
		});

		if (errors.length > 0) {
			return { errors };
		}

		return {
			errors: [],
			spec: {
				type: "pie",
				labelKey,
				valueKey,
				data,
				series: [],
				options: {
					showTooltip: true,
					showLegend: data.length > 1,
				},
			},
		};
	}

	if (!parsed.xKey) {
		errors.push(toError(2, "x 필드가 필요합니다."));
	}
	if (parsed.series.length === 0) {
		errors.push(toError(3, "series 는 1개 이상 필요합니다."));
	}
	const xKey = parsed.xKey;
	if (!xKey || parsed.series.length === 0) {
		return { errors };
	}

	if (
		!parsed.tableHeaders.includes(xKey) ||
		!parsed.series.every((series) => parsed.tableHeaders.includes(series.key))
	) {
		errors.push(toError(dataHeaderLine, "data 헤더에 series key가 모두 포함되어야 합니다."));
		return { errors };
	}

	const data = parsed.rows.map((row, index) => {
		const record = Object.fromEntries(parsed.tableHeaders.map((header, cellIndex) => [header, row[cellIndex] ?? ""]));
		const normalizedRow: Record<string, string | number> = {
			[xKey]: String(record[xKey] ?? ""),
		};

		for (const series of parsed.series) {
			if (isBlankCell(record[series.key])) {
				errors.push(toError(rowStartLine + index, `숫자 필드 ${series.key} 는 비어 있을 수 없습니다.`));
				continue;
			}
			const numericValue = Number(record[series.key]);
			if (!Number.isFinite(numericValue)) {
				errors.push(toError(rowStartLine + index, `숫자 필드 ${series.key} 는 숫자여야 합니다.`));
				continue;
			}
			normalizedRow[series.key] = numericValue;
		}

		return normalizedRow;
	});

	if (errors.length > 0) {
		return { errors };
	}

	return {
		errors: [],
		spec: {
			type: parsed.type,
			xKey,
			data,
			series: parsed.series.map((series) => ({
				key: series.key,
				label: series.label,
				colorToken: series.colorToken as ChartThemeToken,
			})),
			options: {
				showTooltip: true,
				showLegend: parsed.series.length > 1,
			},
		},
	};
};
