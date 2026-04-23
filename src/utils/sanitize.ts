/**
 * 맥, 우분투의 한글 인코딩 문제로 한글 string을 인식하지 못하는 문제를 수정하는 함수
 * @param str
 * @returns str
 */
export function sanitize(str: string) {
	if (!str) return "";

	try {
		return decodeURIComponent(str).normalize("NFC").trim();
	} catch (e) {
		console.error(e);
		throw e;
	}
}
