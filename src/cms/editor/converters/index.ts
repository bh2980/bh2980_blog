import { codeBlockConverter } from "./code-block";
import { imageConverter } from "./image";
import { tableConverter } from "./table";
import type { BlockConverter } from "./types";

export type { BlockConverter, ConverterContext } from "./types";

/**
 * 블록 변환기 등록부(v2 C0). 편집 UI가 있는 블록은 여기에 변환기를 한 줄 더한다.
 * 같은 `cmsTypes`·`tiptapTypes`를 두 변환기가 가지면 등록부 테스트가 실패한다.
 */
export const BLOCK_CONVERTERS: readonly BlockConverter[] = [imageConverter, codeBlockConverter, tableConverter];

const index = (key: "cmsTypes" | "tiptapTypes") => {
	const map = new Map<string, BlockConverter>();
	for (const converter of BLOCK_CONVERTERS) for (const type of converter[key]) map.set(type, converter);
	return map;
};

const BY_CMS_TYPE = index("cmsTypes");
const BY_TIPTAP_TYPE = index("tiptapTypes");

export const converterForCms = (type: string): BlockConverter | undefined => BY_CMS_TYPE.get(type);
export const converterForTiptap = (type: string): BlockConverter | undefined => BY_TIPTAP_TYPE.get(type);
