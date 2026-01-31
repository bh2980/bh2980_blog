import type { Element, Properties, Root } from "hast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const MERMAID_IMG_ID_PREFIX = "mermaid-";

export const rehypeMermaidDarkClass: Plugin<[], Root> = () => {
	return (tree) => {
		visit(tree, "element", (node: Element, index, parent) => {
			if (!parent || index == null) return;
			if (node.tagName !== "picture") return;

			const { source, img } = findDarkSourceAndImg(node);
			if (!source || !img) return;

			if (!(img.properties.id as string).startsWith(MERMAID_IMG_ID_PREFIX)) {
				return;
			}

			const darkSrc = getStringProp(source.properties, "srcset");
			const lightSrc = getStringProp(img.properties, "src");

			if (!darkSrc || !lightSrc) return;

			const lightImg = cloneImg(img, lightSrc);
			const darkImg = cloneImg(img, darkSrc);

			// picture -> [light wrapper, dark wrapper]
			parent.children.splice(
				index,
				1,
				wrapWithClass(["dark:hidden"], lightImg),
				wrapWithClass(["hidden", "dark:inline"], darkImg),
			);
		});
	};
};

function findDarkSourceAndImg(picture: Element): { source?: Element; img?: Element } {
	let source: Element | undefined;
	let img: Element | undefined;

	for (const child of picture.children) {
		if (child.type !== "element") continue;

		if (child.tagName === "source") {
			const media = getStringProp(child.properties, "media");
			if (media?.includes("prefers-color-scheme") && media.includes("dark")) {
				source = child;
			}
		}

		if (child.tagName === "img") img = child;
	}

	return { source, img };
}

function cloneImg(original: Element, src: string): Element {
	const props: Properties = { ...(original.properties ?? {}) };
	props.src = src;

	// picture/source에서 넘어온 width/height가 source에만 있던 경우가 종종 있어서 보강
	// (네 출력에서도 source에 width/height가 있음)
	// => 원본 img에 width/height 없으면 유지된 상태 그대로 두고, 필요하면 호출부에서 더 보강
	return { ...original, properties: props };
}

function wrapWithClass(classNames: string[], child: Element): Element {
	return {
		type: "element",
		tagName: "span",
		properties: { className: classNames },
		children: [child],
	};
}

function getStringProp(props: Properties | undefined, key: string): string | undefined {
	const v = props?.[key as keyof Properties];
	if (typeof v === "string") return v;
	if (Array.isArray(v)) {
		// hast에서 className 같은 건 string[]로 오기도 함. srcset이 array로 오는 경우도 방어.
		const s = v.filter((x) => typeof x === "string").join(" ");
		return s || undefined;
	}
	return undefined;
}
