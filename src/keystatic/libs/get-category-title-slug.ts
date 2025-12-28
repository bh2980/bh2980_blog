import { getKoreanSlug } from "./get-korean-slug";

export const getCategoryTitleSlug = (name: string) => {
	const labelElement = [...document.querySelectorAll("label")].find((l) => (l.textContent || "").includes("카테고리"));
	if (!labelElement) return "";

	const forId = (labelElement as HTMLLabelElement).htmlFor;
	const categoryInput = document.getElementById(forId) as HTMLInputElement;

	let category: string | undefined = categoryInput?.value;

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
