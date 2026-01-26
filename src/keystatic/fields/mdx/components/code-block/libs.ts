export function escapeCodeHikeAnnotations(code: string) {
	// // !tooltip -> // !​tooltip (ZWSP 삽입)
	return code.replace(/^(\s*\/\/\s*)!(\S)/gm, (_, p, c) => `${p}!\u200B${c}`);
}
