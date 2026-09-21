export interface InternalLinkItem {
	id: string;
	collection: string;
	title: string;
	slug: string;
}

export function formatContentLinkMdx(item: InternalLinkItem, alias?: string): string {
	const displayText = alias ? alias.trim() : item.title;
	return `[${displayText}](/entries/${item.id})`;
}

export function parseInternalLinkTrigger(text: string): { active: boolean; query: string } {
	const match = text.match(/\[\[([^\]]*)$/);
	if (!match) return { active: false, query: "" };
	return { active: true, query: match[1] };
}
