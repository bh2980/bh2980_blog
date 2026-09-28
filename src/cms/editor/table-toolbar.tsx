"use client";

import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorState } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Separator } from "@/components/ui/separator";
import { ToolbarButton, type ToolbarItem } from "./toolbar-button";

const chain = (editor: Editor) => editor.chain().focus();
const isCellSelection = (editor: Editor): boolean => editor.state.selection instanceof CellSelection;

/** 선택이 들어 있는 표 노드와 그 위치. 표 밖이면 null. */
const findTable = (editor: Editor): { node: PmNode; pos: number } | null => {
	const { $from } = editor.state.selection;
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		const node = $from.node(depth);
		if (node.type.name === "table") return { node, pos: $from.before(depth) };
	}
	return null;
};

const isCell = (node: PmNode) => node.type.name === "tableCell" || node.type.name === "tableHeader";
const hasFixedWidth = (table: PmNode) => {
	let fixed = false;
	table.descendants((node) => {
		if (isCell(node) && Array.isArray(node.attrs.colwidth) && node.attrs.colwidth.some((width: number) => width > 0))
			fixed = true;
		return !fixed && !isCell(node);
	});
	return fixed;
};

/**
 * 열 너비를 모두 지운다. 너비가 없는 표는 본문 폭을 꽉 채운다(공개 화면도 같다).
 * 이후 한 열만 끌어 조절해도 나머지 열이 자동이라 표는 계속 꽉 찬다.
 */
const fillTableWidth = (editor: Editor) => {
	const table = findTable(editor);
	if (!table) return;
	const tr = editor.state.tr;
	table.node.descendants((node, offset) => {
		if (isCell(node) && node.attrs.colwidth)
			tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...node.attrs, colwidth: null });
		return !isCell(node);
	});
	editor.view.dispatch(tr);
	editor.commands.focus();
};

/** 표 안에 커서가 있을 때 표 위에 뜨는 조작 도구(§4.1, v2 C6). */
const TABLE_TOOL_GROUPS: ToolbarItem[][] = [
	[
		{ label: "↑행", title: "위에 행 추가", run: (e) => chain(e).addRowBefore().run() },
		{ label: "↓행", title: "아래에 행 추가", run: (e) => chain(e).addRowAfter().run() },
		{ label: "←열", title: "왼쪽에 열 추가", run: (e) => chain(e).addColumnBefore().run() },
		{ label: "→열", title: "오른쪽에 열 추가", run: (e) => chain(e).addColumnAfter().run() },
	],
	[
		{ label: "행 삭제", run: (e) => chain(e).deleteRow().run() },
		{ label: "열 삭제", run: (e) => chain(e).deleteColumn().run() },
	],
	[
		{
			label: "셀 병합",
			title: "선택한 셀 병합 (셀을 끌어 여러 칸 선택)",
			isDisabled: (e) => !isCellSelection(e) || !e.can().mergeCells(),
			run: (e) => chain(e).mergeCells().run(),
		},
		{
			label: "셀 나누기",
			title: "병합된 셀 나누기",
			isDisabled: (e) => !isCellSelection(e) || !e.can().splitCell(),
			run: (e) => chain(e).splitCell().run(),
		},
	],
	[
		{
			label: "폭 채우기",
			title: "열 너비를 지워 표가 본문 폭을 꽉 채우게 하기",
			isDisabled: (e) => {
				const table = findTable(e);
				return !table || !hasFixedWidth(table.node);
			},
			run: fillTableWidth,
		},
		{ label: "표 삭제", className: "text-destructive", run: (e) => chain(e).deleteTable().run() },
	],
];

const TOOLBAR_GAP = 6;

export function TableToolbar({ editor }: { editor: Editor }) {
	// 선택·문서가 바뀔 때마다(셀 이동, 병합 가능 여부, 열 너비) 다시 그린다. 표 밖이면 null.
	const tableKey = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current?.isEditable || !current.isActive("table")) return null;
			const table = findTable(current);
			const { from, to } = current.state.selection;
			return `${table?.pos}:${from}:${to}:${isCellSelection(current)}:${table?.node.nodeSize}:${table ? hasFixedWidth(table.node) : ""}`;
		},
	});
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
	const [, setScrollTick] = useState(0);

	// 스크롤·창 크기 변경에도 표를 따라간다(도구 줄은 화면 고정 위치로 띄운다).
	useEffect(() => {
		if (!tableKey) return;
		const update = () => setScrollTick((tick) => tick + 1);
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [tableKey]);

	useLayoutEffect(() => {
		if (!tableKey) {
			setPosition(null);
			return;
		}
		const table = findTable(editor);
		const dom = table ? editor.view.nodeDOM(table.pos) : null;
		const element = dom instanceof HTMLElement ? dom : null;
		const toolbar = toolbarRef.current;
		if (!element) {
			setPosition(null);
			return;
		}
		const rect = element.getBoundingClientRect();
		const height = toolbar?.offsetHeight ?? 32;
		const width = toolbar?.offsetWidth ?? 0;
		// 위쪽 서식 도구(sticky)에 가리지 않게, 표가 위로 스크롤되면 서식 도구 바로 아래에 붙는다.
		const formatBar = editor.view.dom
			.closest("[data-cms-editor-shell]")
			?.querySelector('[role="toolbar"][aria-label="서식 도구"]');
		const minTop = (formatBar?.getBoundingClientRect().bottom ?? 0) + TOOLBAR_GAP;
		const top = Math.min(Math.max(rect.top - height - TOOLBAR_GAP, minTop), rect.bottom - height);
		const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
		setPosition((previous) => (previous && previous.top === top && previous.left === left ? previous : { top, left }));
	});

	if (!tableKey || typeof window === "undefined") return null;

	return createPortal(
		<div
			ref={toolbarRef}
			role="toolbar"
			aria-label="표 도구"
			style={{ position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999, zIndex: 30 }}
			className="flex items-center gap-0.5 rounded-md border bg-popover/95 p-0.5 text-popover-foreground shadow-sm backdrop-blur"
		>
			{TABLE_TOOL_GROUPS.map((group, index) => (
				<div key={group[0]?.label} className="flex items-center gap-0.5">
					{index > 0 && <Separator orientation="vertical" className="mx-0.5 h-4" />}
					{group.map((item) => (
						<ToolbarButton key={item.label} editor={editor} item={item} />
					))}
				</div>
			))}
		</div>,
		document.body,
	);
}
