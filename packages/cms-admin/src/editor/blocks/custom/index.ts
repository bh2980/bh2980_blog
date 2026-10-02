import type { Editor, Range } from "@tiptap/core";
import type { BlockConverter } from "../../converters/types";
import { customBlockConverter } from "./converter";
import { CUSTOM_NODE_BLOCKS, customNodeName, defaultValues, isContainer } from "./shared";

export { CUSTOM_BLOCK_NODES } from "./nodes";
export { CUSTOM_NODE_BLOCKS, customNodeName } from "./shared";
export type { CustomBlockEditorProps } from "./view";

/** 사용자 블록 변환기. */
export const CUSTOM_BLOCK_CONVERTERS: readonly BlockConverter[] = CUSTOM_NODE_BLOCKS.map((block) =>
	customBlockConverter(block, CUSTOM_NODE_BLOCKS),
);

/** 사용자 블록 삽입(슬래시 메뉴). 기본 속성 값으로, 컨테이너는 빈 본문(또는 첫 자식 블록 하나)과 함께 넣는다. */
export const CUSTOM_BLOCK_INSERT_ACTIONS: Readonly<Record<string, (editor: Editor, range: Range) => void>> =
	Object.fromEntries(
		CUSTOM_NODE_BLOCKS.map((block) => {
			const firstChild = CUSTOM_NODE_BLOCKS.find((candidate) => candidate.name === block.children?.blocks?.[0]);
			const body = (definition: typeof block): Record<string, unknown> => ({
				type: customNodeName(definition),
				attrs: { values: defaultValues(definition), originalAttributes: [] },
				...(isContainer(definition) ? { content: [{ type: "paragraph" }] } : {}),
			});
			const content = {
				...body(block),
				...(isContainer(block) && firstChild ? { content: [body(firstChild)] } : {}),
			};
			return [
				block.editor.nodeView ?? block.name,
				(editor: Editor, range: Range) => editor.chain().focus().deleteRange(range).insertContent(content).run(),
			];
		}),
	);
