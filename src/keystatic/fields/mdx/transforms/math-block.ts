export const INTERNAL_MATH_FENCE_LANG = "__keystatic_math__";

type FenceState = {
	prefix: string;
	marker: "`" | "~";
	size: number;
	info: string;
	openLine: string;
};

type MathBlockState = {
	prefix: string;
	lines: string[];
};

const FENCE_RE = /^([>\t ]*)(`{3,}|~{3,})(.*)$/;

const escapeForRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getFenceState = (line: string): FenceState | undefined => {
	const match = line.match(FENCE_RE);
	if (!match) return;

	const prefix = match[1] ?? "";
	const markerText = match[2] ?? "";
	const info = match[3] ?? "";
	const marker = markerText[0];

	if (marker !== "`" && marker !== "~") {
		return;
	}

	return {
		prefix,
		marker,
		size: markerText.length,
		info,
		openLine: line,
	};
};

const isFenceClose = (line: string, fence: FenceState) => {
	const closeRe = new RegExp(`^${escapeForRegExp(fence.prefix)}${escapeForRegExp(fence.marker)}{${fence.size},}\\s*$`);
	return closeRe.test(line);
};

const getMathBlockPrefix = (line: string) => {
	const match = line.match(/^([>\t ]*)\$\$\s*$/);
	return match?.[1];
};

const isMathBlockClose = (line: string, prefix: string) => {
	const closeRe = new RegExp(`^${escapeForRegExp(prefix)}\\$\\$\\s*$`);
	return closeRe.test(line);
};

const isInternalMathFenceOpen = (line: string) => {
	const fence = getFenceState(line);
	if (!fence) return;
	return fence.info.trim() === INTERNAL_MATH_FENCE_LANG ? fence : undefined;
};

export const replaceMathBlocksWithCodeFences = (mdx: string) => {
	const lines = mdx.split(/\r?\n/);
	const output: string[] = [];
	let fence: FenceState | undefined;
	let mathBlock: MathBlockState | undefined;

	for (const line of lines) {
		if (mathBlock) {
			if (isMathBlockClose(line, mathBlock.prefix)) {
				output.push(
					`${mathBlock.prefix}\`\`\`${INTERNAL_MATH_FENCE_LANG}`,
					...mathBlock.lines,
					`${mathBlock.prefix}\`\`\``,
				);
				mathBlock = undefined;
				continue;
			}

			mathBlock.lines.push(line);
			continue;
		}

		if (fence) {
			output.push(line);
			if (isFenceClose(line, fence)) {
				fence = undefined;
			}
			continue;
		}

		const nextFence = getFenceState(line);
		if (nextFence) {
			fence = nextFence;
			output.push(line);
			continue;
		}

		const mathPrefix = getMathBlockPrefix(line);
		if (mathPrefix != null) {
			mathBlock = { prefix: mathPrefix, lines: [] };
			continue;
		}

		output.push(line);
	}

	if (mathBlock) {
		output.push(`${mathBlock.prefix}$$`, ...mathBlock.lines);
	}

	return output.join("\n");
};

export const replaceMathCodeFencesWithBlocks = (mdx: string) => {
	const lines = mdx.split(/\r?\n/);
	const output: string[] = [];
	let fence: FenceState | undefined;
	let mathFence: FenceState | undefined;
	let mathLines: string[] | undefined;

	for (const line of lines) {
		if (mathFence && mathLines) {
			if (isFenceClose(line, mathFence)) {
				output.push(`${mathFence.prefix}$$`, ...mathLines, `${mathFence.prefix}$$`);
				mathFence = undefined;
				mathLines = undefined;
				continue;
			}

			mathLines.push(line);
			continue;
		}

		if (fence) {
			output.push(line);
			if (isFenceClose(line, fence)) {
				fence = undefined;
			}
			continue;
		}

		const internalMathFence = isInternalMathFenceOpen(line);
		if (internalMathFence) {
			mathFence = internalMathFence;
			mathLines = [];
			continue;
		}

		const nextFence = getFenceState(line);
		if (nextFence) {
			fence = nextFence;
		}

		output.push(line);
	}

	if (mathFence && mathLines) {
		output.push(mathFence.openLine, ...mathLines);
	}

	return output.join("\n");
};
