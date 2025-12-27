export function sanitizeSlug(slug: string) {
	if (!slug) return "";

	try {
		return decodeURIComponent(slug).normalize("NFC").trim();
	} catch (e) {
		console.error(e);
		throw e;
	}
}
