import type { Node } from "@tiptap/core";
import {
	CmsCalloutNode,
	CmsCollapsibleNode,
	CmsColumnNode,
	CmsColumnsNode,
	CmsTabNode,
	CmsTabsNode,
} from "./blocks/containers";
import { CmsChartNode, CmsMathNode, CmsMermaidNode } from "./blocks/fence-preview";
import { CmsFileNode } from "./file-node";
import { CmsImageNode } from "./image-node";

/**
 * 블록 정의(v2 B3)의 `editor.nodeView` 이름 → Tiptap 노드(NodeView 포함) 등록부.
 *
 * 정의는 서버와 함께 쓰므로 React·Tiptap 코드를 담지 않고 이름만 가진다. 전용 편집 UI가 있는 블록은
 * 여기에 구현을 두고, 없는 블록은 에디터가 원문 보존 상자(`cmsOpaqueBlock`)로 보여 준다.
 * C3(커스텀 블록 삽입 UI)가 콜아웃·접기·탭·단·툴팁·Mermaid·차트의 노드를 이 표에 더한다.
 */
export const BLOCK_NODE_VIEWS: Readonly<Record<string, Node>> = {
	image: CmsImageNode,
	file: CmsFileNode,
	callout: CmsCalloutNode,
	collapsible: CmsCollapsibleNode,
	tabs: CmsTabsNode,
	tab: CmsTabNode,
	columns: CmsColumnsNode,
	column: CmsColumnNode,
	mermaid: CmsMermaidNode,
	chart: CmsChartNode,
	math: CmsMathNode,
};
