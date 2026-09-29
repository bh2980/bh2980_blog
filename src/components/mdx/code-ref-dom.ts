/**
 * 본문 `:code-ref`가 가리키는 코드 줄을 공개 화면 DOM에서 찾고 다루는 함수들.
 * 코드 줄은 서버 렌더에서 `.line[data-anchor~="이름"]`로 표시된다(shiki transformers `addLineDecorations`).
 */

const ANCHOR_ID = /^[\w-]+$/;

/** 이름표가 `id`인 코드 줄(문서 순서). */
export function findAnchorLines(id: string, root: ParentNode = document): HTMLElement[] {
	if (!ANCHOR_ID.test(id)) return [];
	return Array.from(root.querySelectorAll<HTMLElement>(`.line[data-anchor~="${id}"]`));
}

/** 화면에 그려져 있는지(닫힌 접기 안이면 그려지지 않는다). */
const isRendered = (element: HTMLElement) => element.getClientRects().length > 0;

/** 줄 가운데 하나라도 지금 화면 안에 보이는지. 보이면 페이지를 움직이지 않고 그 자리에서 강조한다. */
export function isOnScreen(lines: readonly HTMLElement[]): boolean {
	const height = window.innerHeight || document.documentElement.clientHeight;
	return lines.some((line) => {
		if (!isRendered(line)) return false;
		const rect = line.getBoundingClientRect();
		return rect.bottom > 0 && rect.top < height;
	});
}

/** 줄을 강조하고 같은 코드 블록의 나머지 줄을 흐리게 한다(focus). 되돌리는 함수를 돌려준다. */
export function focusLines(lines: readonly HTMLElement[]): () => void {
	const pres = new Set<HTMLElement>();
	for (const line of lines) {
		line.setAttribute("data-focused", "");
		const pre = line.closest("pre");
		if (pre) pres.add(pre);
	}
	for (const pre of pres) pre.setAttribute("data-code-focus", "");
	return () => {
		for (const line of lines) line.removeAttribute("data-focused");
		for (const pre of pres) pre.removeAttribute("data-code-focus");
	};
}

export const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** 줄이 접힌 곳 안이면 펼치고, 화면 가운데로 옮긴다. 움직임 줄이기 설정이면 애니메이션 없이 옮긴다. */
export function revealLines(lines: readonly HTMLElement[]) {
	const first = lines[0];
	if (!first) return;
	for (const line of lines) {
		for (let details = line.closest("details"); details; details = details.parentElement?.closest("details") ?? null)
			details.open = true;
	}
	first.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export interface CodePreviewRow {
	number: number;
	html: string;
	focused: boolean;
}

export interface CodePreview {
	title: string | null;
	/** 코드 블록 `<pre>`의 class·style. 구문 색(밝은·어두운 테마)을 그대로 쓴다. */
	preClass: string;
	preStyle: string;
	rows: CodePreviewRow[];
}

/** 연결된 줄과 앞뒤 한 줄을 미리보기로 만든다(같은 코드 블록의 줄 순서·번호). */
export function buildPreview(lines: readonly HTMLElement[], context = 1): CodePreview | null {
	const pre = lines[0]?.closest("pre");
	if (!pre) return null;
	const all = Array.from(pre.querySelectorAll<HTMLElement>("code .line"));
	const targets = new Set(lines);
	const indices = all.map((line, index) => (targets.has(line) ? index : -1)).filter((index) => index >= 0);
	if (!indices.length) return null;
	const from = Math.max(0, Math.min(...indices) - context);
	const to = Math.min(all.length - 1, Math.max(...indices) + context);
	const rows: CodePreviewRow[] = [];
	for (let index = from; index <= to; index += 1) {
		const line = all[index];
		if (!line) continue;
		const copy = line.cloneNode(true) as HTMLElement;
		copy.removeAttribute("data-focused");
		rows.push({ number: index + 1, html: copy.outerHTML, focused: targets.has(line) });
	}
	const title = pre.parentElement?.querySelector("[data-title]")?.getAttribute("data-title") ?? null;
	return { title: title || null, preClass: pre.className, preStyle: pre.getAttribute("style") ?? "", rows };
}
