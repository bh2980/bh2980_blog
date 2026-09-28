"use client";

import type { Editor, Range } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	Bold,
	Check,
	ChevronDown,
	CodeXml,
	Heading2,
	Heading3,
	Heading4,
	ImageIcon,
	Italic,
	Link2,
	List,
	ListOrdered,
	ListTodo,
	type LucideIcon,
	Minus,
	Pilcrow,
	Quote,
	RemoveFormatting,
	SquareCode,
	Strikethrough,
	Subscript,
	Superscript,
	Table2,
	Underline,
	Unlink,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";
import { deleteBlock, duplicateBlock, moveBlock } from "./block-commands";
import { BlockHandleOverlay } from "./block-handle-overlay";
import { endBlockDrag, findBlockDOM, refineBlock, resolveTargetBlock, startBlockDrag, startMarquee } from "./drag";
import { buildEditorExtensions } from "./extensions";
import { ImageInsertDialog, type ImageInsertion } from "./image-insert-dialog";
import { type InternalLinkItem, insertInternalLink, parseInternalLinkTrigger } from "./internal-link";
import { InternalLinkPopup } from "./internal-link-popup";
import { filterCommands, OPEN_IMAGE_DIALOG_EVENT } from "./slash-command";
import { SlashMenuPopup } from "./slash-menu-popup";
import { TableToolbar } from "./table-toolbar";
import { mdxToTiptap, tiptapToMdx } from "./tiptap-content";
import { ToolbarButton, type ToolbarItem } from "./toolbar-button";
import { TooltipPopover } from "./tooltip-popover";

interface CmsEditorProps {
	content: string;
	onChange: (newContent: string) => void;
	/** 편집 문서의 제목 입력. 서식 도구 아래, 본문 위에 놓는다. */
	titleField?: ReactNode;
	/** 툴바 맨 왼쪽에 놓을 문서 작업 메뉴. */
	toolbarLeading?: ReactNode;
	onCompositionStart?: () => void;
	onCompositionEnd?: () => void;
	/** 예약 잠금·휴지통처럼 편집할 수 없는 상태면 false다. */
	editable?: boolean;
}

type Coords = { top: number; left: number };

const chain = (editor: Editor) => editor.chain().focus();

const TOOLBAR_GROUPS: ToolbarItem[][] = [
	[
		{
			label: "본문",
			icon: Pilcrow,
			isActive: (e) => e.isActive("paragraph"),
			run: (e) => chain(e).setParagraph().run(),
		},
		...([2, 3, 4] as const).map((level) => ({
			label: `H${level}`,
			title: `제목 ${level}`,
			icon: { 2: Heading2, 3: Heading3, 4: Heading4 }[level],
			isActive: (e: Editor) => e.isActive("heading", { level }),
			run: (e: Editor) => chain(e).setHeading({ level }).run(),
		})),
	],
	[
		{
			label: "B",
			title: "굵게",
			icon: Bold,
			isActive: (e) => e.isActive("bold"),
			run: (e) => chain(e).toggleBold().run(),
		},
		{
			label: "i",
			title: "기울임",
			icon: Italic,
			isActive: (e) => e.isActive("italic"),
			run: (e) => chain(e).toggleItalic().run(),
		},
		{
			label: "S",
			title: "취소선",
			icon: Strikethrough,
			isActive: (e) => e.isActive("strike"),
			run: (e) => chain(e).toggleStrike().run(),
		},
		{
			label: "</>",
			title: "인라인 코드",
			icon: CodeXml,
			isActive: (e) => e.isActive("code"),
			run: (e) => chain(e).toggleCode().run(),
		},
		{
			label: "U",
			title: "밑줄",
			icon: Underline,
			isActive: (e) => e.isActive("underline"),
			run: (e) => chain(e).toggleUnderline().run(),
		},
		{
			label: "x²",
			title: "위첨자",
			icon: Superscript,
			isActive: (e) => e.isActive("superscript"),
			run: (e) => chain(e).toggleSuperscript().run(),
		},
		{
			label: "x₂",
			title: "아래첨자",
			icon: Subscript,
			isActive: (e) => e.isActive("subscript"),
			run: (e) => chain(e).toggleSubscript().run(),
		},
	],
	[
		{
			label: "왼쪽",
			title: "왼쪽 정렬",
			icon: AlignLeft,
			isActive: (e) => e.isActive({ textAlign: "left" }),
			run: (e) => chain(e).setTextAlign("left").run(),
		},
		{
			label: "가운데",
			title: "가운데 정렬",
			icon: AlignCenter,
			isActive: (e) => e.isActive({ textAlign: "center" }),
			run: (e) => chain(e).setTextAlign("center").run(),
		},
		{
			label: "오른쪽",
			title: "오른쪽 정렬",
			icon: AlignRight,
			isActive: (e) => e.isActive({ textAlign: "right" }),
			run: (e) => chain(e).setTextAlign("right").run(),
		},
		{ label: "자동", title: "정렬 해제", icon: RemoveFormatting, run: (e) => chain(e).unsetTextAlign().run() },
	],
	[
		{
			label: "• 목록",
			title: "글머리 목록",
			icon: List,
			isActive: (e) => e.isActive("bulletList"),
			run: (e) => chain(e).toggleBulletList().run(),
		},
		{
			label: "1. 목록",
			title: "번호 목록",
			icon: ListOrdered,
			isActive: (e) => e.isActive("orderedList"),
			run: (e) => chain(e).toggleOrderedList().run(),
		},
		{
			label: "☑ 체크",
			title: "체크 목록",
			icon: ListTodo,
			isActive: (e) => e.isActive("taskList"),
			run: (e) => chain(e).toggleTaskList().run(),
		},
		{
			label: "“ 인용",
			title: "인용구",
			icon: Quote,
			isActive: (e) => e.isActive("blockquote"),
			run: (e) => chain(e).toggleBlockquote().run(),
		},
		{
			label: "코드블록",
			icon: SquareCode,
			isActive: (e) => e.isActive("codeBlock"),
			run: (e) => chain(e).toggleCodeBlock().run(),
		},
		{
			label: "표",
			title: "표 삽입",
			icon: Table2,
			run: (e) => chain(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
		},
		{ label: "구분선", icon: Minus, run: (e) => chain(e).setHorizontalRule().run() },
	],
];

const BLOCK_STYLES = TOOLBAR_GROUPS[0] ?? [];
const INLINE_TOOLS = TOOLBAR_GROUPS[1] ?? [];
const ALIGN_TOOLS = TOOLBAR_GROUPS[2] ?? [];
const LIST_STYLES = TOOLBAR_GROUPS[3]?.slice(0, 3) ?? [];
const INSERT_TOOLS = TOOLBAR_GROUPS[3]?.slice(3) ?? [];

function ToolbarDivider() {
	return <span aria-hidden className="mx-1 h-5 w-px shrink-0 self-center bg-border" />;
}

function ToolbarDropdown({
	editor,
	label,
	items,
	icon: Icon,
}: {
	editor: Editor;
	label: string;
	items: ToolbarItem[];
	icon?: LucideIcon;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-8 gap-1 px-2 text-xs"
						aria-label={label}
						disabled={!editor.isEditable}
						onMouseDown={(event) => event.preventDefault()}
					/>
				}
			>
				{Icon && <Icon aria-hidden className="size-4" />}
				{label}
				<ChevronDown aria-hidden className="size-3" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="min-w-36">
				{items.map((item) => {
					const active = item.isActive?.(editor) ?? false;
					return (
						<DropdownMenuItem key={item.label} onClick={() => item.run(editor)}>
							<item.icon aria-hidden className="size-4" />
							<span className="flex-1">{item.title ?? item.label}</span>
							{active && <Check aria-hidden className="size-4" />}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function normalizeLinkHref(value: string): string | null {
	const href = value.trim();
	if (!href || /\s/.test(href)) return null;
	if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")) return href;
	if (/^mailto:[^@\s]+@[^@\s]+$/i.test(href)) return href;
	if (/^https?:\/\//i.test(href)) {
		try {
			return new URL(href).href;
		} catch {
			return null;
		}
	}
	if (/^[^/:?#\s]+\.[^/:?#\s]{2,}(?:[/?#].*)?$/i.test(href)) return `https://${href}`;
	return null;
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

/** 핸들 폭(px)과 블록과의 간격. BlockHandleOverlay가 `left - 32`에 24px 버튼을 둔다. */
const HANDLE_OFFSET = 32;
const HANDLE_WIDTH = 24;

/**
 * 핸들을 붙일 기준점.
 * - 목록 항목은 글머리표를 가리지 않게 목록의 왼쪽(글머리표 바깥)에 붙인다. 들여쓴 항목은 그 들여쓰기에 붙는다.
 * - 테두리가 있는 컨테이너(콜아웃·접기·탭·단 나누기) 안쪽 블록의 핸들이 그 왼쪽 테두리에 걸리면
 *   컨테이너 바깥 핸들 자리로 옮긴다(같은 세로줄에 맞춘다).
 */
const handleAnchor = (block: HTMLElement, rect: DOMRect): Coords => {
	const isListItem = block.tagName === "LI" || block.getAttribute("data-type") === "taskItem";
	const list = isListItem ? block.parentElement : null;
	let left = list ? list.getBoundingClientRect().left : rect.left;
	const framed = block.parentElement?.closest<HTMLElement>("[data-cms-framed]");
	if (framed) {
		const edge = framed.getBoundingClientRect().left;
		const handleLeft = left - HANDLE_OFFSET;
		if (handleLeft <= edge + 1 && handleLeft + HANDLE_WIDTH >= edge - 1) left = edge;
	}
	return { top: rect.top, left };
};

/** 화면에 띄운 핸들과 그 핸들이 옮기는 블록의 위치. */
type HandleSpot = Coords & { pos: number };

const sameSpot = (a: HandleSpot | null, b: HandleSpot) =>
	!!a && a.top === b.top && a.left === b.left && a.pos === b.pos;

export function CmsEditor({
	content,
	onChange,
	titleField,
	toolbarLeading,
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

	const [handleSpot, setHandleSpot] = useState<HandleSpot | null>(null);
	const activeBlockRectRef = useRef<DOMRect | null>(null);
	const activeBlockPosRef = useRef<number | null>(null);
	const activeBlockElRef = useRef<HTMLElement | null>(null);
	const [imageDialog, setImageDialog] = useState<{ file: File | null } | null>(null);
	const [linkDraft, setLinkDraft] = useState<{ from: number; to: number; existing: boolean } | null>(null);
	const [linkHref, setLinkHref] = useState("");
	const [linkText, setLinkText] = useState("");
	const [linkError, setLinkError] = useState<string | null>(null);

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
		extensions: buildEditorExtensions(),
		content: mdxToTiptap(content),
		editorProps: {
			attributes: {
				"aria-label": "본문 편집기",
				class:
					"prose dark:prose-invert max-w-none min-h-full flex-1 p-6 focus:outline-none text-foreground text-base leading-relaxed selection:bg-primary/20 " +
					// 표 열 너비 조절 손잡이(prosemirror-tables columnResizing)
					"[&_.tableWrapper]:overflow-x-auto [&_td]:relative [&_th]:relative [&.resize-cursor]:cursor-col-resize [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-px [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:-bottom-px [&_.column-resize-handle]:w-0.5 [&_.column-resize-handle]:bg-primary " +
					// 단 나누기 경계와 같은 모양: 얇은 선 + 첫 행 위쪽의 작은 손잡이.
					"[&_tr:first-child_.column-resize-handle]:after:absolute [&_tr:first-child_.column-resize-handle]:after:top-0.5 [&_tr:first-child_.column-resize-handle]:after:left-1/2 [&_tr:first-child_.column-resize-handle]:after:h-3 [&_tr:first-child_.column-resize-handle]:after:w-6 [&_tr:first-child_.column-resize-handle]:after:-translate-x-1/2 [&_tr:first-child_.column-resize-handle]:after:rounded-full [&_tr:first-child_.column-resize-handle]:after:border [&_tr:first-child_.column-resize-handle]:after:bg-popover [&_tr:first-child_.column-resize-handle]:after:shadow-sm " +
					// 블록 선택(마키): 줄 뒤에 여백(-inset-1)을 둔 상자를 깔고 글자 선택 표시는 숨긴다. 목록 항목은 글머리표까지 덮는다.
					// 글자 선택(primary 보라)과 헷갈리지 않게 다른 색(하늘)과 테두리로 "블록을 골랐다"는 것을 보여 준다.
					"[&_.cms-block-selected]:relative [&_.cms-block-selected]:isolate [&_.cms-block-selected]:before:pointer-events-none [&_.cms-block-selected]:before:absolute [&_.cms-block-selected]:before:-inset-1 [&_.cms-block-selected]:before:-z-10 [&_.cms-block-selected]:before:rounded-md [&_.cms-block-selected]:before:bg-sky-500/10 [&_.cms-block-selected]:before:ring-1 [&_.cms-block-selected]:before:ring-sky-500/35 dark:[&_.cms-block-selected]:before:bg-sky-400/15 dark:[&_.cms-block-selected]:before:ring-sky-400/40 [&_li.cms-block-selected]:before:-left-7 [&.cms-block-range]:selection:bg-transparent " +
					// 셀을 끌어 여러 칸을 고르면(CellSelection) 고른 칸을 칠한다. 병합할 범위를 눈으로 확인한다.
					"[&_.selectedCell]:bg-primary/15 [&_.selectedCell]:outline-1 [&_.selectedCell]:-outline-offset-1 [&_.selectedCell]:outline-primary/60",
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

	// 선택 위치와 적용된 서식이 바뀌면 드롭다운 이름·활성 표시를 갱신한다(표 조작 도구는 TableToolbar가 따로 구독한다).
	useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current) return "";
			const selection = current.state.selection;
			const active = [...BLOCK_STYLES, ...INLINE_TOOLS, ...ALIGN_TOOLS, ...LIST_STYLES]
				.map((item) => (item.isActive?.(current) ? "1" : "0"))
				.join("");
			return `${active}:${current.isActive("table") ? "table" : ""}:${selection.from}:${selection.to}:${selection instanceof CellSelection}`;
		},
	});
	const blockStyle = editor ? (BLOCK_STYLES.find((item) => item.isActive?.(editor))?.label ?? "본문") : "본문";
	const listStyle = editor ? (LIST_STYLES.find((item) => item.isActive?.(editor))?.title ?? "목록") : "목록";

	const openLinkEditor = () => {
		if (!editor) return;
		const { from, to } = editor.state.selection;
		const existing = editor.isActive("link");
		setLinkDraft({ from, to, existing });
		setLinkHref(existing ? String(editor.getAttributes("link").href ?? "") : "");
		setLinkText(from === to ? "" : editor.state.doc.textBetween(from, to));
		setLinkError(null);
	};

	const submitLink = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!editor || !linkDraft) return;
		const href = normalizeLinkHref(linkHref);
		if (!href) {
			setLinkError("http(s) 주소, 사이트 경로 또는 이메일 주소를 입력하세요.");
			return;
		}
		const command = editor.chain().focus().setTextSelection({ from: linkDraft.from, to: linkDraft.to });
		if (linkDraft.existing) command.extendMarkRange("link").setLink({ href }).run();
		else if (linkDraft.from !== linkDraft.to) command.setLink({ href }).run();
		else
			command
				.insertContent({ type: "text", text: linkText.trim() || href, marks: [{ type: "link", attrs: { href } }] })
				.run();
		setLinkDraft(null);
	};

	const removeLink = () => {
		if (!editor || !linkDraft) return;
		editor
			.chain()
			.focus()
			.setTextSelection({ from: linkDraft.from, to: linkDraft.to })
			.extendMarkRange("link")
			.unsetLink()
			.run();
		setLinkDraft(null);
	};

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
			// 블록에서 왼쪽 핸들로 가는 길(블록 왼쪽 여백, 목록 들여쓰기)에서는 대상을 바꾸지 않는다.
			// 그러지 않으면 목록 항목에서 핸들로 가는 동안 대상이 목록 전체로 바뀐다.
			const active = activeBlockRectRef.current;
			if (active && event.clientX < active.left && event.clientY >= active.top && event.clientY <= active.bottom)
				return;
			const found = findBlockDOM(root, event.target as HTMLElement | null);
			if (!found) return;
			const block = refineBlock(found, event.clientX, event.clientY);
			try {
				const resolved = resolveTargetBlock(editor.view, block);
				if (!resolved) return;
				activeBlockPosRef.current = resolved.pos;
				activeBlockRectRef.current = resolved.rect;
				activeBlockElRef.current = block;
				const spot = { ...handleAnchor(block, resolved.rect), pos: resolved.pos };
				// 같은 자리면 상태를 바꾸지 않는다. 마우스를 움직일 때마다 편집기를 다시 그리면(useEditor가
				// 옵션을 다시 설정한다) 노드 뷰가 갱신되어 표 열 너비 끌기 등이 흔들린다.
				setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
			} catch {
				// DOM이 막 바뀌는 중이면 무시한다.
			}
		},
		[editor],
	);

	// 핸들은 화면 고정 위치에 뜬다. 스크롤하면 블록을 따라가고, 블록이 사라졌으면 숨긴다.
	// 그대로 두면 스크롤 뒤 엉뚱한 블록 옆에 옛 핸들이 남아 같은 항목에 핸들이 두 곳처럼 보인다.
	const hasHandle = handleSpot !== null;
	useEffect(() => {
		if (!hasHandle || !editor) return;
		const follow = () => {
			const element = activeBlockElRef.current;
			const pos = activeBlockPosRef.current;
			if (!element?.isConnected || pos === null) {
				setHandleSpot(null);
				return;
			}
			const rect = element.getBoundingClientRect();
			activeBlockRectRef.current = rect;
			const spot = { ...handleAnchor(element, rect), pos };
			setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
		};
		window.addEventListener("scroll", follow, true);
		window.addEventListener("resize", follow);
		return () => {
			window.removeEventListener("scroll", follow, true);
			window.removeEventListener("resize", follow);
		};
	}, [hasHandle, editor]);

	const handleDragStart = useCallback(
		(pos: number, event: React.DragEvent<HTMLElement>) => {
			if (!editor) return;
			startBlockDrag(editor.view, pos, event);
		},
		[editor],
	);

	const handleDragEnd = useCallback(() => {
		if (!editor) return;
		endBlockDrag(editor.view);
	}, [editor]);

	const withBlock = (pos: number, action: (current: Editor, pos: number) => boolean) => () => {
		if (!editor) return;
		editor.commands.focus();
		action(editor, pos);
	};

	if (!editor) return null;

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: editor shell tracks IME and block hover state
		<div
			className="relative flex min-h-full w-full flex-1 flex-col bg-background"
			data-cms-editor-shell
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
			onMouseDown={(event) => {
				// 본문 바깥 빈 여백에서 누른 채 끌면 마키(네모 영역)로 블록을 고른다. 편집기 안쪽 여백은
				// 블록 선택 플러그인이 맡는다. 서식 도구·제목 입력·버튼 같은 조작 요소와 포털(팝오버)은 제외한다.
				const target = event.target as HTMLElement;
				if (!editable || !event.currentTarget.contains(target) || editor.view.dom.contains(target)) return;
				if (target.closest('input, textarea, button, select, a, [role="toolbar"], [contenteditable="true"]')) return;
				startMarquee(editor.view, event.nativeEvent);
			}}
		>
			<div
				role="toolbar"
				aria-label="서식 도구"
				className="sticky top-0 z-10 w-full overflow-x-auto border-b bg-background/95 backdrop-blur"
			>
				<div className="mx-auto flex min-h-12 w-max min-w-full items-center justify-center gap-1 px-4 py-2">
					{toolbarLeading}
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="size-8 p-0"
									aria-label="이미지 삽입"
									disabled={!editable}
									onClick={() => setImageDialog({ file: null })}
								/>
							}
						>
							<ImageIcon className="size-4" aria-hidden />
						</TooltipTrigger>
						<TooltipContent side="bottom">이미지 삽입</TooltipContent>
					</Tooltip>
					<ToolbarDropdown editor={editor} label={blockStyle} items={BLOCK_STYLES} />
					<ToolbarDivider />
					{INLINE_TOOLS.map((item) => (
						<ToolbarButton key={item.label} editor={editor} item={item} />
					))}
					<TooltipPopover editor={editor} />
					<ToolbarDivider />
					{ALIGN_TOOLS.map((item) => (
						<ToolbarButton key={item.label} editor={editor} item={item} />
					))}
					<ToolbarDivider />
					<ToolbarDropdown editor={editor} label={listStyle} items={LIST_STYLES} icon={List} />
					{INSERT_TOOLS.map((item) => (
						<ToolbarButton key={item.label} editor={editor} item={item} />
					))}
					<Popover open={linkDraft !== null} onOpenChange={(open) => (open ? openLinkEditor() : setLinkDraft(null))}>
						<PopoverTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="size-8 p-0"
									aria-label="링크 삽입·수정"
									title="링크 삽입·수정"
									disabled={!editable}
									onMouseDown={(event) => event.preventDefault()}
								/>
							}
						>
							<Link2 aria-hidden className="size-4" />
						</PopoverTrigger>
						<PopoverContent align="start" className="w-80">
							<form onSubmit={submitLink} className="grid gap-3">
								<p className="font-medium">{linkDraft?.existing ? "링크 수정" : "링크 삽입"}</p>
								{linkDraft && !linkDraft.existing && linkDraft.from === linkDraft.to && (
									<label htmlFor="cms-link-text" className="grid gap-1.5 text-xs">
										표시 텍스트
										<Input
											id="cms-link-text"
											value={linkText}
											onChange={(event) => setLinkText(event.target.value)}
											placeholder="링크 텍스트"
										/>
									</label>
								)}
								<label htmlFor="cms-link-href" className="grid gap-1.5 text-xs">
									주소
									<Input
										id="cms-link-href"
										autoFocus
										value={linkHref}
										onChange={(event) => {
											setLinkHref(event.target.value);
											setLinkError(null);
										}}
										placeholder="https://example.com"
									/>
								</label>
								{linkError && (
									<p role="alert" className="text-destructive text-xs">
										{linkError}
									</p>
								)}
								<div className="flex justify-end gap-2">
									{linkDraft?.existing && (
										<Button type="button" variant="outline" size="sm" onClick={removeLink}>
											<Unlink aria-hidden className="size-4" />
											링크 제거
										</Button>
									)}
									<Button type="submit" size="sm">
										{linkDraft?.existing ? "수정" : "삽입"}
									</Button>
								</div>
							</form>
						</PopoverContent>
					</Popover>
				</div>
			</div>

			{titleField && (
				<div className="mx-auto w-full max-w-3xl border-border/60 border-b px-4 pt-12 pb-5">{titleField}</div>
			)}

			<ImageInsertDialog
				open={imageDialog !== null}
				initialFile={imageDialog?.file ?? null}
				onClose={() => setImageDialog(null)}
				onInsert={insertImage}
			/>

			{/* biome-ignore lint/a11y: canvas click focuses the rich text editor */}
			<div
				className="mx-auto flex min-h-full w-full max-w-3xl flex-1 cursor-text flex-col px-4 py-6"
				onClick={(event) => {
					// 본문 밖 빈 캔버스를 눌렀을 때만 끝으로 옮긴다. NodeView 버튼·팝오버(포털)의 클릭도
					// React 트리를 따라 여기로 올라오므로, 본문 DOM 안이나 캔버스 밖(포털)은 건드리지 않는다.
					const target = event.target as Node;
					if (!event.currentTarget.contains(target) || editor.view.dom.contains(target)) return;
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

			<TableToolbar editor={editor} />

			{handleSpot && editable && (
				<BlockHandleOverlay
					coords={handleSpot}
					onMoveUp={withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, -1))}
					onMoveDown={withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, 1))}
					onDuplicate={withBlock(handleSpot.pos, duplicateBlock)}
					onDelete={() => {
						withBlock(handleSpot.pos, deleteBlock)();
						setHandleSpot(null);
					}}
					onDragStart={(event) => handleDragStart(handleSpot.pos, event)}
					onDragEnd={handleDragEnd}
				/>
			)}
		</div>
	);
}
