import { getKoreanSlug } from "./get-korean-slug";

export const getCategoryTitleSlug = (name: string) => {
	const labelElement = [...document.querySelectorAll("label")].find((l) => (l.textContent || "").includes("카테고리"));
	if (!labelElement) return "";

	const forId = (labelElement as HTMLLabelElement).htmlFor;
	const categoryInput = document.getElementById(forId) as HTMLInputElement;

	const category = categoryInput?.value;
	const title = getKoreanSlug(name);

	if (!category || !title) return "";

	return `${category}/${title}`;
};
