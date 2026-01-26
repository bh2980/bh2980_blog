export function escapeCodeHikeAnnotations(code: string) {
	// // !tooltip -> // !​tooltip (ZWSP 삽입)
	return code.replace(/^(\s*\/\/\s*)!(\S)/gm, (_, p, c) => `${p}!\u200B${c}`);
}

export const NBSP = "&nbsp;";
export const TAB_SIZE = 2;

export function encodeLeadingIndentInFences(src: string) {
	return src.replaceAll("\t", NBSP.repeat(TAB_SIZE)).replaceAll(/^[  ]+/gm, (match) => NBSP.repeat(match.length));
}
