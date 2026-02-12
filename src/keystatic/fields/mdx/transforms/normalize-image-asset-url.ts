import type { Image, Root } from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { visit } from "unist-util-visit";

const IMAGE_ASSET_PREFIX = "/assets/images/";

const normalizeAssetPath = (value: string) => {
	const queryOrHashStart = value.search(/[?#]/);
	const rawPath = queryOrHashStart >= 0 ? value.slice(0, queryOrHashStart) : value;
	const suffix = queryOrHashStart >= 0 ? value.slice(queryOrHashStart) : "";

	if (!rawPath.startsWith(IMAGE_ASSET_PREFIX)) {
		return value;
	}

	let decodedPath = rawPath;
	try {
		decodedPath = decodeURIComponent(rawPath);
	} catch {
		return value;
	}

	const normalizedPath = decodedPath.normalize("NFC");
	const encodedPath = normalizedPath
		.split("/")
		.map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
		.join("/");

	return `${encodedPath}${suffix}`;
};

const isImageNode = (node: unknown): node is Image =>
	typeof node === "object" && node !== null && "type" in node && (node as Image).type === "image";

const isMdxJsxNode = (node: unknown): node is MdxJsxFlowElement | MdxJsxTextElement =>
	typeof node === "object" &&
	node !== null &&
	"type" in node &&
	((node as MdxJsxFlowElement | MdxJsxTextElement).type === "mdxJsxFlowElement" ||
		(node as MdxJsxFlowElement | MdxJsxTextElement).type === "mdxJsxTextElement");

const normalizeMdxJsxNodeAttrs = (node: MdxJsxFlowElement | MdxJsxTextElement) => {
	for (const attr of node.attributes) {
		if (attr.type !== "mdxJsxAttribute") continue;
		if (typeof attr.value !== "string") continue;
		if (attr.name !== "src" && attr.name !== "href") continue;

		(attr as MdxJsxAttribute & { value: string }).value = normalizeAssetPath(attr.value);
	}
};

export const normalizeImageAssetUrls = (mdxAst: Root) => {
	visit(mdxAst, (node) => {
		if (isImageNode(node)) {
			node.url = normalizeAssetPath(node.url);
			return;
		}

		if (isMdxJsxNode(node)) {
			normalizeMdxJsxNodeAttrs(node);
		}
	});
};

export const __testable__ = {
	normalizeAssetPath,
};
