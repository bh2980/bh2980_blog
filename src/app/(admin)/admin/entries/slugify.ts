/**
 * Utility to convert title into clean URL-friendly slug.
 * Preserves Korean NFC characters, replaces spaces/underscores with hyphens,
 * and collapses multiple hyphens.
 */
export function slugify(text: string): string {
	if (!text) return "";
	return text
		.normalize("NFC")
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-") // replace spaces and underscores with -
		.replace(/[^\p{L}\p{N}-]+/gu, "") // remove all non-alphanumeric/non-letter chars except hyphen
		.replace(/--+/g, "-") // collapse multiple hyphens
		.replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}
