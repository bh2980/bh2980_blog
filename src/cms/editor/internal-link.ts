export interface InternalLinkItem {
	id: string;
	collection: string;
	title: string;
	slug: string;
}

export function formatContentLinkMdx(item: InternalLinkItem, alias?: string): string {
	const displayText = alias ? alias.trim() : item.title;
	// §4.4: 내부 글 링크는 일반 Markdown 링크(`[제목](/posts/글-slug)`)로 저장한다.
	// 팝업은 글(post)만 검색하므로 `/posts/`로 고정한다. slug가 없으면 깨진 링크를 만들지 않는다.
	if (!item.slug) return displayText;
	return `[${displayText}](/posts/${item.slug})`;
}

export function parseInternalLinkTrigger(text: string): { active: boolean; query: string } {
	const match = text.match(/\[\[([^\]]*)$/);
	if (!match) return { active: false, query: "" };
	return { active: true, query: match[1] };
}
