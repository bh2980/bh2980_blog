export function normalizeKstIsoString(iso: string) {
	// Assumes the stored ISO string represents KST local clock time but incorrectly ends with `Z`.
	// Convert it to an ISO 8601 datetime with explicit KST offset (e.g. `2026-01-12T12:40:00+09:00`).
	const noZ = iso.endsWith("Z") ? iso.slice(0, -1) : iso;
	const noMs = noZ.replace(/\.\d{3}$/, "");
	return `${noMs}+09:00`;
}
