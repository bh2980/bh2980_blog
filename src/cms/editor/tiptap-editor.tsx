"use client";

import type { Editor, Range } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ImageIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";
import { CmsBlockKeymap, deleteBlock, duplicateBlock, moveBlock } from "./block-commands";
import { BlockHandleOverlay } from "./block-handle-overlay";
import { BLOCK_NODE_VIEWS } from "./block-views";
import { ImageInsertDialog, type ImageInsertion } from "./image-insert-dialog";
import { type InternalLinkItem, insertInternalLink, parseInternalLinkTrigger } from "./internal-link";
import { InternalLinkPopup } from "./internal-link-popup";
import { filterCommands, OPEN_IMAGE_DIALOG_EVENT } from "./slash-command";
import { SlashMenuPopup } from "./slash-menu-popup";
import { mdxToTiptap, tiptapToMdx } from "./tiptap-content";
import { CMS_SCHEMA_EXTENSIONS } from "./tiptap-schema";

interface CmsEditorProps {
	content: string;
	onChange: (newContent: string) => void;
	onCompositionStart?: () => void;
	onCompositionEnd?: () => void;
	/** 예약 잠금·휴지통처럼 편집할 수 없는 상태면 false다. */
	editable?: boolean;
}

type Coords = { top: number; left: number };

interface ToolbarItem {
	label: string;
	title?: string;
	className?: string;
	isActive?: (editor: Editor) => boolean;
	run: (editor: Editor) => void;
}

const chain = (editor: Editor) => editor.chain().focus();

const TOOLBAR_GROUPS: ToolbarItem[][] = [
	[
		{ label: "본문", isActive: (e) => e.isActive("paragraph"), run: (e) => chain(e).setParagraph().run() },
		...([2, 3, 4] as const).map((level) => ({
			label: `H${level}`,
			title: `제목 ${level}`,
			isActive: (e: Editor) => e.isActive("heading", { level }),
			run: (e: Editor) => chain(e).toggleHeading({ level }).run(),
		})),
	],
	[
		{
			label: "B",
			title: "굵게",
			className: "font-bold",
			isActive: (e) => e.isActive("bold"),
			run: (e) => chain(e).toggleBold().run(),
		},
		{
			label: "i",
			title: "기울임",
			className: "italic",
			isActive: (e) => e.isActive("italic"),
			run: (e) => chain(e).toggleItalic().run(),
		},
		{
			label: "S",
			title: "취소선",
			className: "line-through",
			isActive: (e) => e.isActive("strike"),
			run: (e) => chain(e).toggleStrike().run(),
		},
		{
			label: "</>",
			title: "인라인 코드",
			className: "font-mono",
			isActive: (e) => e.isActive("code"),
			run: (e) => chain(e).toggleCode().run(),
		},
		{
			label: "U",
			title: "밑줄",
			className: "underline",
			isActive: (e) => e.isActive("underline"),
			run: (e) => chain(e).toggleUnderline().run(),
		},
		{
			label: "x²",
			title: "위첨자",
			isActive: (e) => e.isActive("superscript"),
			run: (e) => chain(e).toggleSuperscript().run(),
		},
		{
			label: "x₂",
			title: "아래첨자",
			isActive: (e) => e.isActive("subscript"),
			run: (e) => chain(e).toggleSubscript().run(),
		},
	],
	[
		{
			label: "왼쪽",
			title: "왼쪽 정렬",
			isActive: (e) => e.isActive({ textAlign: "left" }),
			run: (e) => chain(e).setTextAlign("left").run(),
		},
		{
			label: "가운데",
			title: "가운데 정렬",
			isActive: (e) => e.isActive({ textAlign: "center" }),
			run: (e) => chain(e).setTextAlign("center").run(),
		},
		{
			label: "오른쪽",
			title: "오른쪽 정렬",
			isActive: (e) => e.isActive({ textAlign: "right" }),
			run: (e) => chain(e).setTextAlign("right").run(),
		},
		{ label: "자동", title: "정렬 해제", run: (e) => chain(e).unsetTextAlign().run() },
	],
	[
		{
			label: "• 목록",
			title: "글머리 목록",
			isActive: (e) => e.isActive("bulletList"),
			run: (e) => chain(e).toggleBulletList().run(),
		},
		{
			label: "1. 목록",
			title: "번호 목록",
			isActive: (e) => e.isActive("orderedList"),
			run: (e) => chain(e).toggleOrderedList().run(),
		},
		{
			label: "☑ 체크",
			title: "체크 목록",
			isActive: (e) => e.isActive("taskList"),
			run: (e) => chain(e).toggleTaskList().run(),
		},
		{
			label: "“ 인용",
			title: "인용구",
			isActive: (e) => e.isActive("blockquote"),
			run: (e) => chain(e).toggleBlockquote().run(),
		},
		{
			label: "코드블록",
			className: "font-mono",
			isActive: (e) => e.isActive("codeBlock"),
			run: (e) => chain(e).toggleCodeBlock().run(),
		},
		{
			label: "표",
			title: "표 삽입",
			run: (e) => chain(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
		},
		{ label: "구분선", run: (e) => chain(e).setHorizontalRule().run() },
	],
];

/** 표 안에 있을 때만 보이는 행·열 도구(§4.1). 셀 병합은 v1 범위가 아니다. */
const TABLE_TOOLS: ToolbarItem[] = [
	{ label: "↑행", title: "위에 행 추가", run: (e) => chain(e).addRowBefore().run() },
	{ label: "↓행", title: "아래에 행 추가", run: (e) => chain(e).addRowAfter().run() },
	{ label: "←열", title: "왼쪽에 열 추가", run: (e) => chain(e).addColumnBefore().run() },
	{ label: "→열", title: "오른쪽에 열 추가", run: (e) => chain(e).addColumnAfter().run() },
	{ label: "행 삭제", run: (e) => chain(e).deleteRow().run() },
	{ label: "열 삭제", run: (e) => chain(e).deleteColumn().run() },
	{ label: "표 삭제", className: "text-destructive", run: (e) => chain(e).deleteTable().run() },
];

function ToolbarButton({ editor, item }: { editor: Editor; item: ToolbarItem }) {
	const active = item.isActive?.(editor) ?? false;
	const label = item.title ?? item.label;
	const common = {
		"aria-label": label,
		disabled: !editor.isEditable,
		// 버튼 클릭이 편집기 선택을 빼앗지 않게 한다.
		onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
		className: cn("h-7 min-w-7 px-2 text-xs", item.className),
	};
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					item.isActive ? (
						<Toggle size="sm" pressed={active} onPressedChange={() => item.run(editor)} {...common} />
					) : (
						<Button type="button" variant="ghost" size="sm" onClick={() => item.run(editor)} {...common} />
					)
				}
			>
				{item.label}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}

async function searchLinkTargets(query: string): Promise<InternalLinkItem[]> {
	const search = async (collection: "post" | "memo") => {
		const params = new URLSearchParams({ collection, pageSize: "25" });
		if (query) params.set("search", query);
		for (const status of ["draft", "published"]) params.append("status", status);
		const res = await fetch(`/api/cms/v1/entries?${params.toString()}`);
		if (!res.ok) return [];
		const data = (await res.json()) as {
			items: { id: string; collection: string; title: string | null; slug: string | null; status: string }[];
		};
		return data.items.map((item) => ({
			id: item.id,
			collection: item.collection,
			title: item.title || "제목 없음",
			slug: item.slug ?? "",
			status: item.status,
		}));
	};
	const [posts, memos] = await Promise.all([search("post"), search("memo")]);
	return [...posts, ...memos].slice(0, 20);
}

export function CmsEditor({
	content,
	onChange,
	onCompositionStart,
	onCompositionEnd,
	editable = true,
}: CmsEditorProps) {
	const isInternalUpdateRef = useRef(false);
	const isComposingRef = useRef(false);
	const editorRef = useRef<Editor | null>(null);

	const [slash, setSlash] = useState<{ query: string; index: number; coords: Coords } | null>(null);
	const slashRangeRef = useRef<Range | null>(null);
	const slashRef = useRef(slash);
	slashRef.current = slash;

	const [link, setLink] = useState<{ query: string; index: number; coords: Coords } | null>(null);
	const [linkItems, setLinkItems] = useState<InternalLinkItem[]>([]);
	const [isLinkLoading, setIsLinkLoading] = useState(false);
	const linkRangeRef = useRef<Range | null>(null);
	const linkRef = useRef(link);
	linkRef.current = link;
	const linkItemsRef = useRef(linkItems);
	linkItemsRef.current = linkItems;

	const [handleCoords, setHandleCoords] = useState<Coords | null>(null);
	const activeBlockPosRef = useRef<number | null>(null);
	const [imageDialog, setImageDialog] = useState<{ file: File | null } | null>(null);

	const syncTriggerPopup = (current: Editor) => {
		if (isComposingRef.current) return;
		const { from } = current.state.selection;
		const textBefore = current.state.doc.textBetween(Math.max(0, from - 50), from, "\n", "\0");

		const linkMatch = parseInternalLinkTrigger(textBefore);
		if (linkMatch.active) {
			linkRangeRef.current = { from: from - linkMatch.query.length - 2, to: from };
			setLink({ query: linkMatch.query, index: 0, coords: current.view.coordsAtPos(from) });
			setSlash(null);
			return;
		}
		setLink(null);

		// `/` 메뉴는 빈 문단의 시작에서만 연다(§4.2). 문장 안의 경로(`a/b`)를 명령으로 오인하지 않는다.
		const slashMatch = textBefore.match(/(?:^|\n)\/([^\s/]*)$/);
		if (!slashMatch || current.isActive("codeBlock")) {
			setSlash(null);
			return;
		}
		const query = slashMatch[1] ?? "";
		slashRangeRef.current = { from: from - query.length - 1, to: from };
		setSlash({ query, index: 0, coords: current.view.coordsAtPos(from) });
	};

	const chooseLink = (item: InternalLinkItem) => {
		const current = editorRef.current;
		if (!current || !linkRangeRef.current) return;
		insertInternalLink(current, linkRangeRef.current, item);
		setLink(null);
	};

	const editor = useEditor({
		immediatelyRender: false,
		editable,
		extensions: [
			StarterKit.configure({
				// 본문 삽입은 H2부터지만(§4.1) 이전 글의 H1·H5·H6도 원래 수준으로 보여 준다.
				heading: { levels: [1, 2, 3, 4, 5, 6] },
				// `meta`를 보존하는 CmsCodeBlock을 쓴다(CMS_SCHEMA_EXTENSIONS).
				codeBlock: false,
				link: { openOnClick: false },
			}),
			...CMS_SCHEMA_EXTENSIONS,
			...Object.values(BLOCK_NODE_VIEWS),
			CmsBlockKeymap,
		],
		content: mdxToTiptap(content),
		editorProps: {
			attributes: {
				"aria-label": "본문 편집기",
				class:
					"prose dark:prose-invert max-w-none min-h-full flex-1 p-6 focus:outline-none text-foreground text-base leading-relaxed selection:bg-primary/20",
			},
			handleKeyDown: (view, event) => {
				// 한글 IME 조합 중에는 메뉴 탐색·확정을 처리하지 않는다(§4.2).
				if (view.composing || event.isComposing || event.keyCode === 229) return false;

				const openLink = linkRef.current;
				if (openLink) {
					const items = linkItemsRef.current;
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						const step = event.key === "ArrowDown" ? 1 : -1;
						setLink({ ...openLink, index: items.length ? (openLink.index + step + items.length) % items.length : 0 });
						return true;
					}
					if (event.key === "Enter") {
						const selected = items[openLink.index];
						if (!selected) {
							setLink(null);
							return false;
						}
						event.preventDefault();
						chooseLink(selected);
						return true;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setLink(null);
						return true;
					}
				}

				const openSlash = slashRef.current;
				if (openSlash) {
					const filtered = filterCommands(openSlash.query);
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						const step = event.key === "ArrowDown" ? 1 : -1;
						const size = Math.max(1, filtered.length);
						setSlash({ ...openSlash, index: (openSlash.index + step + size) % size });
						return true;
					}
					if (event.key === "Enter") {
						const command = filtered[openSlash.index];
						if (!command || !slashRangeRef.current || !editorRef.current) {
							setSlash(null);
							return false;
						}
						event.preventDefault();
						command.action(editorRef.current, slashRangeRef.current);
						setSlash(null);
						return true;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setSlash(null);
						return true;
					}
				}
				return false;
			},
		},
		onUpdate: ({ editor: current }) => {
			if (isInternalUpdateRef.current) return;
			onChange(tiptapToMdx(current.getJSON()));
			syncTriggerPopup(current);
		},
		onSelectionUpdate: ({ editor: current }) => syncTriggerPopup(current),
	});

	useEffect(() => {
		editorRef.current = editor;
		if (!editor) return;
		// 비교 기준은 저장 문자열(MDX)이다 — Tiptap JSON 객체 비교는 순서 때문에 깨진다.
		if (tiptapToMdx(editor.getJSON()) !== content) {
			isInternalUpdateRef.current = true;
			editor.commands.setContent(mdxToTiptap(content), { emitUpdate: false });
			isInternalUpdateRef.current = false;
		}
	}, [content, editor]);

	useEffect(() => {
		editor?.setEditable(editable);
	}, [editable, editor]);

	const linkQuery = link?.query;
	useEffect(() => {
		if (linkQuery === undefined) return;
		let cancelled = false;
		setIsLinkLoading(true);
		const timer = setTimeout(() => {
			searchLinkTargets(linkQuery)
				.then((items) => {
					if (!cancelled) setLinkItems(items);
				})
				.catch(() => {
					if (!cancelled) setLinkItems([]);
				})
				.finally(() => {
					if (!cancelled) setIsLinkLoading(false);
				});
		}, 200);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [linkQuery]);

	useEffect(() => {
		const open = () => setImageDialog({ file: null });
		window.addEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
		return () => window.removeEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
	}, []);

	const insertImage = useCallback(
		(image: ImageInsertion) => {
			editor
				?.chain()
				.focus()
				.insertContent({
					type: "image",
					// 등록 미디어는 `mediaId`만 저장한다. 공개 주소는 렌더러가 해석한다(§4.4, §7.1).
					attrs: {
						mediaId: image.mediaId,
						alt: image.alt,
						decorative: image.decorative || null,
						caption: image.caption,
						width: "100%",
						align: "center",
					},
				})
				.run();
			setImageDialog(null);
		},
		[editor],
	);

	const imageFileFrom = (source: DataTransferItemList | FileList | null): File | null => {
		if (!source) return null;
		for (let i = 0; i < source.length; i++) {
			const entry = source[i];
			const file = entry instanceof File ? entry : entry?.kind === "file" ? entry.getAsFile() : null;
			if (file?.type.startsWith("image/")) return file;
		}
		return null;
	};

	const handleMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!editor) return;
			const root = editor.view.dom;
			let block = event.target as HTMLElement | null;
			while (block && block.parentElement !== root) block = block.parentElement;
			if (!block) return;
			try {
				activeBlockPosRef.current = editor.view.posAtDOM(block, 0);
				const rect = block.getBoundingClientRect();
				setHandleCoords({ top: rect.top, left: rect.left });
			} catch {
				// DOM이 막 바뀌는 중이면 무시한다.
			}
		},
		[editor],
	);

	const withActiveBlock = (action: (current: Editor, pos: number) => boolean) => () => {
		if (!editor || activeBlockPosRef.current === null) return;
		editor.commands.focus();
		action(editor, activeBlockPosRef.current);
	};

	if (!editor) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: editor shell tracks IME and block hover state
		<div
			className="relative flex min-h-full w-full flex-1 flex-col bg-background"
			onCompositionStart={() => {
				isComposingRef.current = true;
				onCompositionStart?.();
			}}
			onCompositionEnd={() => {
				isComposingRef.current = false;
				syncTriggerPopup(editor);
				onCompositionEnd?.();
			}}
			onMouseMove={handleMouseMove}
		>
			<div
				role="toolbar"
				aria-label="서식 도구"
				className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 px-4 py-2 backdrop-blur"
			>
				{TOOLBAR_GROUPS.map((group, index) => (
					<div key={group[0]?.label} className="flex items-center gap-1">
						{index > 0 && <Separator orientation="vertical" className="mx-1 data-vertical:h-4" />}
						{group.map((item) => (
							<ToolbarButton key={item.label} editor={editor} item={item} />
						))}
					</div>
				))}
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 px-2 text-xs"
					disabled={!editable}
					onClick={() => setImageDialog({ file: null })}
				>
					<ImageIcon aria-hidden />
					이미지
				</Button>
				{editor.isActive("table") && (
					<fieldset className="flex items-center gap-1 border-0 p-0" aria-label="표 도구">
						<Separator orientation="vertical" className="mx-1 data-vertical:h-4" />
						{TABLE_TOOLS.map((item) => (
							<ToolbarButton key={item.label} editor={editor} item={item} />
						))}
					</fieldset>
				)}
			</div>

			<ImageInsertDialog
				open={imageDialog !== null}
				initialFile={imageDialog?.file ?? null}
				onClose={() => setImageDialog(null)}
				onInsert={insertImage}
			/>

			{/* biome-ignore lint/a11y: canvas click focuses the rich text editor */}
			<div
				className="mx-auto flex min-h-full w-full max-w-3xl flex-1 cursor-text flex-col px-4 py-6"
				onClick={() => {
					if (!editor.isFocused) editor.chain().focus("end").run();
				}}
				onPaste={(event) => {
					const file = imageFileFrom(event.clipboardData.items);
					if (file && editable) {
						event.preventDefault();
						setImageDialog({ file });
					}
				}}
				onDrop={(event) => {
					const file = imageFileFrom(event.dataTransfer.files);
					if (file && editable) {
						event.preventDefault();
						setImageDialog({ file });
					}
				}}
				onDragOver={(event) => event.preventDefault()}
			>
				<EditorContent
					editor={editor}
					className="flex min-h-full flex-1 flex-col [&>.ProseMirror]:min-h-[calc(100vh-240px)] [&>.ProseMirror]:flex-1"
				/>
			</div>

			{slash && (
				<SlashMenuPopup
					items={filterCommands(slash.query)}
					coords={slash.coords}
					selectedIndex={slash.index}
					onSelect={(command) => {
						if (slashRangeRef.current) command.action(editor, slashRangeRef.current);
						setSlash(null);
					}}
					onClose={() => {
						setSlash(null);
						editor.chain().focus().run();
					}}
				/>
			)}

			{link && (
				<InternalLinkPopup
					items={linkItems}
					isLoading={isLinkLoading}
					coords={link.coords}
					selectedIndex={link.index}
					onSelect={chooseLink}
					onClose={() => {
						setLink(null);
						editor.chain().focus().run();
					}}
				/>
			)}

			{handleCoords && editable && (
				<BlockHandleOverlay
					coords={handleCoords}
					onMoveUp={withActiveBlock((current, pos) => moveBlock(current, pos, -1))}
					onMoveDown={withActiveBlock((current, pos) => moveBlock(current, pos, 1))}
					onDuplicate={withActiveBlock(duplicateBlock)}
					onDelete={() => {
						withActiveBlock(deleteBlock)();
						setHandleCoords(null);
					}}
				/>
			)}
		</div>
	);
}
