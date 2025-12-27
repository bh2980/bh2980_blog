export function sanitizeSlug(slug: string) {
	if (!slug) return "";

	return decodeURIComponent(slug).normalize("NFC").trim();
}
