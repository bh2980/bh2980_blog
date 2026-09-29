"use client";

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { type AlignedUnit, buildWithOwners } from "@/cms/core/translation/units";
import { buildEditorExtensions } from "@/cms/editor/extensions";
import { cmsNodeToTiptap } from "@/cms/editor/tiptap-content";
import { type UnitRange, unitRanges } from "@/cms/editor/translation/unit-ranges";
import type { CmsNode } from "@/cms/mdx";
import { cn } from "@/utils/cn";

export type PreviewMode = "translation" | "source";

const UNIT_ATTR = "data-translation-unit";
const decorationsKey = new PluginKey<DecorationSet>("cmsTranslationPreview");

/** 단위 상태별 표시. 미번역은 원문을 흐리게, 원문 변경은 노란 바탕, 고치는 중인 블록은 테두리. */
const STATUS_CLASS: Record<AlignedUnit["status"], string> = {
	translated: "cms-tr-translated",
	untranslated: "cms-tr-untranslated",
	changed: "cms-tr-changed",
};

const decorationsFor = (
	doc: Parameters<typeof DecorationSet.create>[0],
	ranges: readonly UnitRange[],
	rows: readonly AlignedUnit[],
	mode: PreviewMode,
	selected: number | null,
) => {
	const seen = new Set<number>();
	const decorations: Decoration[] = [];
	for (const range of ranges) {
		// 원문 보존 상자처럼 한 노드를 여러 단위가 가리키면 첫 단위만 단다.
		if (seen.has(range.from)) continue;
		seen.add(range.from);
		const row = rows[range.index];
		if (!row) continue;
		const header = row.unit.kind === "header";
		decorations.push(
			Decoration.node(range.from, range.to, {
				[UNIT_ATTR]: String(range.index),
				class: cn(
					"cms-tr-unit",
					// 머리 줄 상태는 상자 전체를 칠하지 않는다(안쪽 블록 상태와 섞인다).
					mode === "translation" && !header && STATUS_CLASS[row.status],
					range.index === selected && "cms-tr-selected",
				),
			}),
		);
	}
	return DecorationSet.create(doc, decorations);
};

/**
 * 번역 모드의 미리보기(v3 §4.2). 실제 글 모양의 읽기 전용 문서로, 번역한 블록은 번역문, 미번역 블록은 원문을
 * 흐리게 보인다. 블록을 누르면 그 단위를 고른다(`onSelect`). 상자 제목·탭 이름 자리를 누르면 머리 줄을 고른다.
 */
export function TranslationPreview({
	sourceDoc,
	rows,
	mode,
	selected,
	onSelect,
}: {
	sourceDoc: CmsNode;
	rows: readonly AlignedUnit[];
	/** `source`면 모든 블록을 원문으로 보인다(원문으로 보기). */
	mode: PreviewMode;
	selected: number | null;
	onSelect: (index: number) => void;
}) {
	const [extensions] = useState(() => buildEditorExtensions());
	const built = useMemo(
		() =>
			buildWithOwners(
				sourceDoc,
				rows.map((row) => (mode === "source" ? row.unit.source : (row.target ?? row.unit.source))),
			),
		[sourceDoc, rows, mode],
	);
	const stateRef = useRef({ ranges: [] as UnitRange[], rows, mode, selected });
	stateRef.current = { ...stateRef.current, rows, mode, selected };

	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		extensions,
		content: cmsNodeToTiptap(built.doc),
		editorProps: {
			attributes: {
				"aria-label": "번역 미리보기",
				class: cn(
					"prose dark:prose-invert max-w-none text-base text-foreground leading-relaxed focus:outline-none",
					"[&_.cms-tr-unit]:cursor-pointer [&_.cms-tr-unit]:rounded-sm [&_.cms-tr-unit]:transition-colors",
					"[&_.cms-tr-unit:hover]:bg-muted/60",
					"[&_.cms-tr-untranslated]:opacity-55 [&_.cms-tr-untranslated]:outline-1 [&_.cms-tr-untranslated]:outline-dashed [&_.cms-tr-untranslated]:outline-offset-4 [&_.cms-tr-untranslated]:outline-muted-foreground/40",
					"[&_.cms-tr-changed]:bg-amber-500/10 [&_.cms-tr-changed]:outline-1 [&_.cms-tr-changed]:outline-offset-4 [&_.cms-tr-changed]:outline-amber-500/50",
					"[&_.cms-tr-selected]:opacity-100 [&_.cms-tr-selected]:outline-2 [&_.cms-tr-selected]:outline-solid [&_.cms-tr-selected]:outline-offset-4 [&_.cms-tr-selected]:outline-primary",
				),
			},
		},
	});

	// 미리보기 문서가 바뀌면 다시 채우고 단위 자리를 다시 잰다. 노드 뷰를 React로 그리므로 다음 틱에 바꾼다.
	useEffect(() => {
		if (!editor) return;
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled || editor.isDestroyed) return;
			editor.commands.setContent(cmsNodeToTiptap(built.doc), { emitUpdate: false });
			stateRef.current.ranges = unitRanges(editor.state.doc, built.doc, built.owners);
			editor.view.dispatch(editor.state.tr.setMeta(decorationsKey, true));
		});
		return () => {
			cancelled = true;
		};
	}, [editor, built]);

	useEffect(() => {
		if (!editor) return;
		const plugin = new Plugin({
			key: decorationsKey,
			props: {
				decorations: (state) => {
					const current = stateRef.current;
					return decorationsFor(state.doc, current.ranges, current.rows, current.mode, current.selected);
				},
			},
		});
		editor.registerPlugin(plugin);
		return () => {
			if (!editor.isDestroyed) editor.unregisterPlugin(decorationsKey);
		};
	}, [editor]);

	// 상태·고른 단위가 바뀌면 표시를 다시 그리고, 고른 블록이 보이게 옮긴다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: 줄 상태·보기는 stateRef로 읽지만 바뀔 때 다시 그려야 한다
	useEffect(() => {
		if (!editor || editor.isDestroyed) return;
		editor.view.dispatch(editor.state.tr.setMeta(decorationsKey, true));
		if (selected === null) return;
		const range = stateRef.current.ranges.find((item) => item.index === selected);
		const dom = range ? editor.view.nodeDOM(range.from) : null;
		if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [editor, rows, mode, selected]);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: 블록 고르기는 패널의 이전·다음 버튼과 키보드로도 한다
		// biome-ignore lint/a11y/noStaticElementInteractions: 읽기 전용 문서 위의 블록 고르기
		<div
			className="min-w-0"
			onClick={(event) => {
				const target = (event.target as HTMLElement).closest(`[${UNIT_ATTR}]`);
				const index = Number(target?.getAttribute(UNIT_ATTR));
				if (target && Number.isInteger(index)) onSelect(index);
			}}
		>
			<EditorContent editor={editor} />
		</div>
	);
}
