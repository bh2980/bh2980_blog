import type { CmsNode } from "../../mdx";
import { CONTAINER_CONVERTERS } from "../blocks/containers";
import { codeBlockConverter } from "./code-block";
import { chartConverter, mathConverter, mermaidConverter } from "./fence-preview";
import { fileConverter } from "./file";
import { imageConverter } from "./image";
import { tableConverter } from "./table";
import type { BlockConverter } from "./types";

export type { BlockConverter, ConverterContext } from "./types";

/**
 * 블록 변환기 등록부(v2 C0). 편집 UI가 있는 블록은 여기에 변환기를 한 줄 더한다.
 * 같은 `cmsTypes`·`tiptapTypes`를 두 변환기가 가지면 등록부 테스트가 실패한다.
 * (단, `matches`가 있는 세부 분기 변환기는 같은 cmsType을 공유할 수 있다.)
 */
export const BLOCK_CONVERTERS: readonly BlockConverter[] = [
	imageConverter,
	fileConverter,
	mermaidConverter,
	chartConverter,
	mathConverter,
	codeBlockConverter,
	tableConverter,
	...CONTAINER_CONVERTERS,
];

const CMS_CONVERTERS_BY_TYPE = new Map<string, BlockConverter[]>();
const TIPTAP_CONVERTERS_BY_TYPE = new Map<string, BlockConverter>();

for (const converter of BLOCK_CONVERTERS) {
	for (const type of converter.cmsTypes) {
		const list = CMS_CONVERTERS_BY_TYPE.get(type) ?? [];
		list.push(converter);
		CMS_CONVERTERS_BY_TYPE.set(type, list);
	}
	for (const type of converter.tiptapTypes) {
		TIPTAP_CONVERTERS_BY_TYPE.set(type, converter);
	}
}

export const converterForCms = (type: string, node?: CmsNode): BlockConverter | undefined => {
	const candidates = CMS_CONVERTERS_BY_TYPE.get(type);
	if (!candidates || candidates.length === 0) return undefined;
	if (node) {
		const matched = candidates.find((c) => c.matches?.(node));
		if (matched) return matched;
	}
	return candidates.find((c) => !c.matches);
};

export const converterForTiptap = (type: string): BlockConverter | undefined => TIPTAP_CONVERTERS_BY_TYPE.get(type);
