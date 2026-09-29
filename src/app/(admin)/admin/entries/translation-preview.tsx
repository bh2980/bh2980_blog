"use client";

import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** 띠의 최대 폭(px). 글 열보다 넓게 펼쳐 원문과 번역을 같은 폭으로 나란히 놓는다. */
const BAND_MAX_WIDTH = 1200;

const decorationsFor = (
	doc: Parameters<typeof DecorationSet.create>[0],
	ranges: readonly UnitRange[],
	rows: readonly AlignedUnit[],
	mode: PreviewMode,
	selected: number | null,
	bandHost: HTMLElement | null,
) => {
	const seen = new Set<number>();
	const decorations: Decoration[] = [];
	// 고른 단위 자리에 띠를 끼운다. 블록은 그 자리를 띠로 바꾸고(블록은 숨긴다), 머리 줄은 상자 맨 앞에 끼운다.
	const bandRange = selected === null || !bandHost ? undefined : ranges.find((range) => range.index === selected);
	const bandRow = selected === null ? undefined : rows[selected];
	if (bandRange && bandRow && bandHost && bandRange.to <= doc.content.size) {
		const header = bandRow.unit.kind === "header";
		decorations.push(
			Decoration.widget(header ? bandRange.from + 1 : bandRange.to, () => bandHost, {
				side: header ? -1 : 1,
				key: `band-${selected}`,
				ignoreSelection: true,
				// 띠 안의 편집기·버튼 입력을 미리보기(ProseMirror)가 가로채지 않게 한다.
				stopEvent: () => true,
			}),
		);
	}
	for (const range of ranges) {
		// 원문 보존 상자처럼 한 노드를 여러 단위가 가리키면 첫 단위만 단다.
		if (seen.has(range.from)) continue;
		// 문서가 막 바뀌어 자리가 맞지 않으면 건너뛴다(다음 계산에서 다시 단다).
		const node = range.to <= doc.content.size ? doc.nodeAt(range.from) : null;
		if (!node || range.from + node.nodeSize !== range.to) continue;
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
					range.index === selected && bandHost && !header && "cms-tr-editing",
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
	band,
}: {
	sourceDoc: CmsNode;
	rows: readonly AlignedUnit[];
	/** `source`면 모든 블록을 원문으로 보인다(원문으로 보기). */
	mode: PreviewMode;
	selected: number | null;
	onSelect: (index: number) => void;
	/**
	 * 고른 단위 자리에 끼울 번역 띠의 내용. 띠는 글 열보다 넓게(가장 가까운 `data-translation-area` 폭까지,
	 * 최대 1200px) 펼쳐져 상자 안 블록이어도 상자 밖으로 나온다.
	 */
	band?: ReactNode;
}) {
	// 띠를 그릴 DOM 자리. 고른 단위가 바뀔 때마다 새로 만들어 ProseMirror 위젯으로 끼우고 React로 채운다.
	const bandHost = useMemo(() => {
		if (selected === null || typeof document === "undefined") return null;
		const host = document.createElement("div");
		host.className = "cms-tr-band not-prose my-4";
		host.contentEditable = "false";
		return host;
	}, [selected]);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const [extensions] = useState(() => buildEditorExtensions());
	const built = useMemo(
		() =>
			buildWithOwners(
				sourceDoc,
				rows.map((row) => (mode === "source" ? row.unit.source : (row.target ?? row.unit.source))),
			),
		[sourceDoc, rows, mode],
	);
	const withBand = band !== undefined && band !== null ? bandHost : null;
	const stateRef = useRef({ ranges: [] as UnitRange[], rows, mode, selected, bandHost: withBand });
	stateRef.current = { ...stateRef.current, rows, mode, selected, bandHost: withBand };

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
					// 띠로 바꾼 블록은 숨긴다. 번역 화면에서는 접기 상자 안도 늘 펼쳐 보인다.
					"[&_.cms-tr-editing]:hidden [&_[data-cms-container-node=cmsCollapsible]_.hidden]:block",
					// 미리보기는 글 모양만 보인다: 코드 블록의 편집 도구 줄(언어·파일 경로)은 숨긴다. 띠 안 편집기는 그대로 둔다.
					"[&_[data-code-block-wrapper]:not(.cms-tr-band_*)>[data-code-ui]]:hidden",
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
			// 새 문서를 넣는 동안에는 이전 문서의 자리로 표시를 그리지 않는다(범위를 벗어난다).
			stateRef.current.ranges = [];
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
					return decorationsFor(
						state.doc,
						current.ranges,
						current.rows,
						current.mode,
						current.selected,
						current.bandHost,
					);
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
		const dom = withBand ?? (range ? editor.view.nodeDOM(range.from) : null);
		if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "nearest", behavior: "smooth" });
	}, [editor, rows, mode, selected, withBand]);

	// 띠를 글 열 밖까지 넓힌다: 번역 영역 폭 안에서 가운데에 두고, 띠가 든 부모(상자 안일 수 있다)와의 차이만큼 옮긴다.
	useLayoutEffect(() => {
		const host = withBand;
		const area = wrapperRef.current?.closest<HTMLElement>("[data-translation-area]") ?? wrapperRef.current;
		if (!host || !area) return;
		const place = () => {
			const areaRect = area.getBoundingClientRect();
			const style = getComputedStyle(area);
			const inner = areaRect.width - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
			const width = Math.max(0, Math.min(BAND_MAX_WIDTH, inner));
			host.style.width = `${width}px`;
			host.style.marginLeft = "0px";
			const naturalLeft = host.getBoundingClientRect().left;
			const targetLeft = areaRect.left + Number.parseFloat(style.paddingLeft) + (inner - width) / 2;
			host.style.marginLeft = `${targetLeft - naturalLeft}px`;
		};
		place();
		const observer = new ResizeObserver(place);
		observer.observe(area);
		// 띠는 위젯으로 문서에 들어간 뒤에야 제자리를 잴 수 있다. 크기가 생기면 다시 잰다.
		observer.observe(host);
		return () => observer.disconnect();
	});

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: 블록 고르기는 패널의 이전·다음 버튼과 키보드로도 한다
		// biome-ignore lint/a11y/noStaticElementInteractions: 읽기 전용 문서 위의 블록 고르기
		<div
			ref={wrapperRef}
			className="min-w-0"
			onClick={(event) => {
				// 띠 안의 누름은 띠가 처리한다(띠를 품은 상자를 고르지 않게).
				if ((event.target as HTMLElement).closest(".cms-tr-band")) return;
				const target = (event.target as HTMLElement).closest(`[${UNIT_ATTR}]`);
				const index = Number(target?.getAttribute(UNIT_ATTR));
				if (target && Number.isInteger(index)) onSelect(index);
			}}
		>
			<EditorContent editor={editor} />
			{withBand && createPortal(band, withBand)}
		</div>
	);
}
