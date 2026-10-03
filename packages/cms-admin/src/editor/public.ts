/**
 * 편집기 진입점(`@bh2980/cms-admin/editor`). 본문 MDX ↔ 편집기 문서 변환과 편집기 확장을 플러그인·사이트 테스트가 쓴다.
 */

export { BLOCK_NODE_VIEWS } from "./block-views";
export { blockNodeName } from "./blocks/added";
export { buildEditorExtensions } from "./extensions";
export { mdxToTiptap, OPAQUE_BLOCK_NAME, tiptapToMdx } from "./tiptap-content";
export type { BlockAction } from "./tiptap-editor";
export { UNTRANSLATED_MARK_NAME } from "./untranslated-mark";
