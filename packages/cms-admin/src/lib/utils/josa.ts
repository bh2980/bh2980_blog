/** 낱말 끝 글자에 받침이 있는지. 한글이 아니면 받침이 없다고 본다. */
function hasFinalConsonant(word: string): boolean {
	const code = word.trim().charCodeAt(word.trim().length - 1) - 0xac00;
	return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 낱말에 맞는 조사를 붙인다. `josa("태그", "을", "를")` → `태그를`. 이름을 설정에서 받아 쓰는 문구에 쓴다. */
export const josa = (word: string, withFinal: string, withoutFinal: string) =>
	`${word}${hasFinalConsonant(word) ? withFinal : withoutFinal}`;
