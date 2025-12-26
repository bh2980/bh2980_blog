import { getKoreanSlug } from "./get-korean-slug";

export const getCategoryTitleSlug = (name: string) => {
	const labelElement = [...document.querySelectorAll("label")].find((l) => (l.textContent || "").includes("카테고리"));
	if (!labelElement) return "";

	const root = labelElement.parentElement;
	const category = root?.querySelector('input[role="combobox"]') ?? null;
	const title = getKoreanSlug(name);

	if (!category || !title) return "";

	return `${category}/${title}`;
};
