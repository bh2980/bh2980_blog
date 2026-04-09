"use client";

import { useEffect } from "react";

const getIsKeystaticDark = (root: HTMLElement, mediaQuery: MediaQueryList) =>
	root.classList.contains("kui-scheme--dark") ||
	(root.classList.contains("kui-scheme--auto") && mediaQuery.matches);

export function KeystaticThemeBridge() {
	useEffect(() => {
		const root = document.documentElement;
		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const hadDarkClass = root.classList.contains("dark");

		const syncDarkClass = () => {
			root.classList.toggle("dark", getIsKeystaticDark(root, mediaQuery));
		};

		syncDarkClass();

		const observer = new MutationObserver(syncDarkClass);
		observer.observe(root, { attributes: true, attributeFilter: ["class"] });

		mediaQuery.addEventListener("change", syncDarkClass);

		return () => {
			observer.disconnect();
			mediaQuery.removeEventListener("change", syncDarkClass);
			root.classList.toggle("dark", hadDarkClass);
		};
	}, []);

	return null;
}
