export const getKoreanSlug = (name: string) =>
	name
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w\uAC00-\uD7A3-]+/g, "");

export const getSlugWithLabel = (label: string) => (name: string) => {
	const labelElement = [...document.querySelectorAll("label")].find((l) => (l.textContent || "").includes(label));
	if (!labelElement) return "";

	const forId = (labelElement as HTMLLabelElement).htmlFor;
	const categoryInput = document.getElementById(forId) as HTMLInputElement;

	let category: string | undefined | null = categoryInput?.value;

	if (!forId || !categoryInput) {
		const parentElement = labelElement.parentElement;
		const categoryInput = parentElement?.querySelector("input") as HTMLInputElement | null;
		const selectButton = parentElement?.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement | null;

		category = categoryInput?.value || selectButton?.textContent;
	}

	const title = getKoreanSlug(name);

	if (!category || !title) return "";

	return `${category}/${title}`;
};

export const mapLabelSlugToValueSlug = (rawSlug: string, options: readonly { label: string; value: string }[]) => {
	const [label, slug] = rawSlug.split("/");

	if (!label || !slug) return "";

	const value = options.find((item) => item.label === label)?.value;
	if (!value) return "";

	return `${value}/${slug}`;
};

/**
 * 맥, 우분투의 한글 인코딩 문제로 한글 slug를 인식하지 못하는 문제를 수정하는 함수
 * @param slug
 * @returns slug
 */
export function sanitizeSlug(slug: string) {
	if (!slug) return "";

	try {
		return decodeURIComponent(slug).normalize("NFC").trim();
	} catch (e) {
		console.error(e);
		throw e;
	}
}
