"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, useCallback } from "react";
import { CmsMdxPreserver } from "./tiptap-schema";
import { filterCommands, type SlashCommandItem } from "./slash-command";
import { SlashMenuPopup } from "./slash-menu-popup";
import { BlockHandleOverlay } from "./block-handle-overlay";
import { parseInternalLinkTrigger, formatContentLinkMdx, type InternalLinkItem } from "./internal-link";
import { InternalLinkPopup } from "./internal-link-popup";

interface CmsEditorProps {
	content: string;
	onChange: (newContent: string) => void;
	onCompositionStart?: () => void;
	onCompositionEnd?: () => void;
	editable?: boolean;
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

	// Slash Menu State
	const [slashOpen, setSlashOpen] = useState(false);
	const [slashCoords, setSlashCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
	const [slashQuery, setSlashQuery] = useState("");
	const [slashIndex, setSlashIndex] = useState(0);
	const slashRangeRef = useRef<{ from: number; to: number } | null>(null);
	const slashOpenRef = useRef(slashOpen);
	slashOpenRef.current = slashOpen;
	const slashQueryRef = useRef(slashQuery);
	slashQueryRef.current = slashQuery;
	const slashIndexRef = useRef(slashIndex);
	slashIndexRef.current = slashIndex;

	// Block Handle State
	const [handleCoords, setHandleCoords] = useState<{ top: number; left: number } | null>(null);
	const activeBlockPosRef = useRef<number | null>(null);

	// Internal Link ([[) State
	const [linkOpen, setLinkOpen] = useState(false);
	const [linkCoords, setLinkCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
	const [linkQuery, setLinkQuery] = useState("");
	const [linkIndex, setLinkIndex] = useState(0);
	const [linkItems, setLinkItems] = useState<InternalLinkItem[]>([]);
	const [isLinkLoading, setIsLinkLoading] = useState(false);
	const linkRangeRef = useRef<{ from: number; to: number } | null>(null);
	const linkOpenRef = useRef(linkOpen);
	linkOpenRef.current = linkOpen;
	const linkItemsRef = useRef<InternalLinkItem[]>([]);
	linkItemsRef.current = linkItems;
	const linkIndexRef = useRef(linkIndex);
	linkIndexRef.current = linkIndex;

	const editorRef = useRef<any>(null);

	const editor = useEditor({
		immediatelyRender: false,
		editable,
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
			}),
			CmsMdxPreserver,
		],
		content,
		editorProps: {
			attributes: {
				class:
					"prose dark:prose-invert max-w-none min-h-[550px] p-6 focus:outline-none text-neutral-800 dark:text-neutral-200 text-base leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/40",
			},
			handleKeyDown: (view, event) => {
				// Korean IME safeguard: do not process navigation keys while composing
				if (view.composing || event.isComposing || event.keyCode === 229) {
					return false;
				}

				if (linkOpenRef.current) {
					const items = linkItemsRef.current;
					if (event.key === "ArrowDown") {
						event.preventDefault();
						setLinkIndex((prev) => (items.length > 0 ? (prev + 1) % items.length : 0));
						return true;
					}
					if (event.key === "ArrowUp") {
						event.preventDefault();
						setLinkIndex((prev) => (items.length > 0 ? (prev - 1 + items.length) % items.length : 0));
						return true;
					}
					if (event.key === "Enter") {
						const selected = items[linkIndexRef.current];
						if (selected && linkRangeRef.current && view) {
							event.preventDefault();
							const formatted = formatContentLinkMdx(selected);
							const { tr } = view.state;
							tr.delete(linkRangeRef.current.from, linkRangeRef.current.to);
							tr.insertText(formatted);
							view.dispatch(tr);
							setLinkOpen(false);
							return true;
						}
						// No item matched: close popup and let default Enter key through
						setLinkOpen(false);
						return false;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setLinkOpen(false);
						return true;
					}
				}

				if (slashOpenRef.current) {
					const filtered = filterCommands(slashQueryRef.current);

					if (event.key === "ArrowDown") {
						event.preventDefault();
						setSlashIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
						return true;
					}
					if (event.key === "ArrowUp") {
						event.preventDefault();
						setSlashIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
						return true;
					}
					if (event.key === "Enter") {
						const cmd = filtered[slashIndexRef.current];
						if (cmd && slashRangeRef.current && editorRef.current) {
							event.preventDefault();
							cmd.action(editorRef.current, slashRangeRef.current);
							setSlashOpen(false);
							return true;
						}
						// No command matched: close popup and let default Enter key through
						setSlashOpen(false);
						return false;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setSlashOpen(false);
						return true;
					}
				}
				return false;
			},
		},
		onUpdate: ({ editor }) => {
			if (isInternalUpdateRef.current) return;
			onChange(editor.getHTML());

			// Check slash & internal link trigger condition
			if (!isComposingRef.current) {
				const { from } = editor.state.selection;
				const textBefore = editor.state.doc.textBetween(Math.max(0, from - 50), from, "\n", "\0");

				// 1. Check Internal Link [[
				const linkMatch = parseInternalLinkTrigger(textBefore);
				if (linkMatch.active) {
					const triggerPos = from - linkMatch.query.length - 2;
					linkRangeRef.current = { from: triggerPos, to: from };
					setLinkQuery(linkMatch.query);
					setLinkIndex(0);

					const coords = editor.view.coordsAtPos(from);
					setLinkCoords({ top: coords.top, left: coords.left });
					setLinkOpen(true);
					setSlashOpen(false);
					return;
				} else {
					setLinkOpen(false);
				}

				// 2. Check Slash Command /
				const slashMatch = textBefore.match(/(?:^|\s)\/([^\s]*)$/);
				if (slashMatch) {
					const query = slashMatch[1] || "";
					const slashPos = from - query.length - 1;
					slashRangeRef.current = { from: slashPos, to: from };
					setSlashQuery(query);
					setSlashIndex(0);

					const coords = editor.view.coordsAtPos(from);
					setSlashCoords({ top: coords.top, left: coords.left });
					setSlashOpen(true);
				} else {
					setSlashOpen(false);
				}
			}
		},
	});

	useEffect(() => {
		editorRef.current = editor;
		if (!editor) return;
		if (editor.getHTML() !== content) {
			isInternalUpdateRef.current = true;
			editor.commands.setContent(content, { emitUpdate: false });
			isInternalUpdateRef.current = false;
		}
	}, [content, editor]);

	useEffect(() => {
		if (!editor) return;
		editor.setEditable(editable);
	}, [editable, editor]);

	// Query internal link items from API
	useEffect(() => {
		if (!linkOpen) return;
		let isMounted = true;
		async function search() {
			setIsLinkLoading(true);
			try {
				const params = new URLSearchParams();
				params.set("collection", "post");
				if (linkQuery) params.set("search", linkQuery);
				params.set("pageSize", "10");

				const res = await fetch(`/api/cms/v1/entries?${params.toString()}`);
				if (res.ok && isMounted) {
					const data = await res.json();
					const mapped = data.items.map((i: any) => ({
						id: i.id,
						collection: i.collection,
						title: i.title || "제목 없음",
						slug: i.slug || "",
					}));
					setLinkItems(mapped);
					linkItemsRef.current = mapped;
					setLinkIndex(0);
				}
			} catch {
				// Ignore
			} finally {
				if (isMounted) setIsLinkLoading(false);
			}
		}
		search();
		return () => {
			isMounted = false;
		};
	}, [linkOpen, linkQuery]);

	// Hover-based Block Handle Detection
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!editor) return;
			const target = e.target as HTMLElement;
			const blockEl = target.closest(
				".prose > p, .prose > h1, .prose > h2, .prose > h3, .prose > blockquote, .prose > pre, .prose > ul, .prose > ol, .prose > hr",
			) as HTMLElement | null;

			if (blockEl && editor.view.dom.contains(blockEl)) {
				try {
					const pos = editor.view.posAtDOM(blockEl, 0);
					activeBlockPosRef.current = pos;
					const rect = blockEl.getBoundingClientRect();
					setHandleCoords({ top: rect.top, left: rect.left });
				} catch {
					// Ignore transient DOM resolution error
				}
			}
		},
		[editor],
	);

	// Block Action Handlers
	const handleMoveUp = () => {
		if (!editor || activeBlockPosRef.current === null) return;
		const pos = activeBlockPosRef.current;
		const $pos = editor.state.doc.resolve(pos);
		const node = $pos.nodeAfter || $pos.parent;
		if (!node) return;

		const prevPos = $pos.before();
		if (prevPos <= 0) return;

		editor
			.chain()
			.focus()
			.command(({ tr, dispatch }) => {
				if (dispatch) {
					// Swap with previous node
					const nodeSize = node.nodeSize;
					const slice = tr.doc.slice(pos, pos + nodeSize);
					tr.delete(pos, pos + nodeSize);
					tr.insert(prevPos, slice.content);
				}
				return true;
			})
			.run();
	};

	const handleMoveDown = () => {
		if (!editor || activeBlockPosRef.current === null) return;
		const pos = activeBlockPosRef.current;
		const $pos = editor.state.doc.resolve(pos);
		const node = $pos.nodeAfter || $pos.parent;
		if (!node) return;

		const nextPos = pos + node.nodeSize;
		if (nextPos >= editor.state.doc.content.size) return;

		editor
			.chain()
			.focus()
			.command(({ tr, dispatch }) => {
				if (dispatch) {
					const nodeSize = node.nodeSize;
					const slice = tr.doc.slice(pos, pos + nodeSize);
					tr.delete(pos, pos + nodeSize);
					// Insert after next node
					const $next = tr.doc.resolve(pos);
					const nextNodeSize = ($next.nodeAfter || $next.parent).nodeSize;
					tr.insert(pos + nextNodeSize, slice.content);
				}
				return true;
			})
			.run();
	};

	const handleDuplicate = () => {
		if (!editor || activeBlockPosRef.current === null) return;
		const pos = activeBlockPosRef.current;
		const $pos = editor.state.doc.resolve(pos);
		const node = $pos.nodeAfter || $pos.parent;
		if (!node) return;

		editor
			.chain()
			.focus()
			.command(({ tr, dispatch }) => {
				if (dispatch) {
					const nextPos = pos + node.nodeSize;
					tr.insert(nextPos, node.copy(node.content));
				}
				return true;
			})
			.run();
	};

	const handleDeleteBlock = () => {
		if (!editor || activeBlockPosRef.current === null) return;
		const pos = activeBlockPosRef.current;
		const $pos = editor.state.doc.resolve(pos);
		const node = $pos.nodeAfter || $pos.parent;
		if (!node) return;

		editor
			.chain()
			.focus()
			.command(({ tr, dispatch }) => {
				if (dispatch) {
					tr.delete(pos, pos + node.nodeSize);
				}
				return true;
			})
			.run();
		setHandleCoords(null);
	};

	if (!editor) return null;

	const setFormat = (fn: (e: any) => any) => (e: React.MouseEvent) => {
		e.preventDefault();
		fn(editor.chain().focus()).run();
	};

	return (
		<div
			className="w-full flex flex-col bg-white dark:bg-neutral-950 relative"
			onCompositionStart={() => {
				isComposingRef.current = true;
				if (onCompositionStart) onCompositionStart();
			}}
			onCompositionEnd={() => {
				isComposingRef.current = false;
				if (onCompositionEnd) onCompositionEnd();
			}}
			onMouseMove={handleMouseMove}
		>
			{/* Fixed Sticky Rich Formatting Toolbar */}
			<div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur px-4 py-2">
				{/* Block Types */}
				<button
					type="button"
					onMouseDown={setFormat((c) => c.setParagraph())}
					className={`px-2.5 py-1 text-xs font-medium rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("paragraph") ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					본문
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleHeading({ level: 1 }))}
					className={`px-2 py-1 text-xs font-medium rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("heading", { level: 1 }) ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					H1
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleHeading({ level: 2 }))}
					className={`px-2 py-1 text-xs font-medium rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("heading", { level: 2 }) ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					H2
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleHeading({ level: 3 }))}
					className={`px-2 py-1 text-xs font-medium rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("heading", { level: 3 }) ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					H3
				</button>

				<div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-1" />

				{/* Inlines */}
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleBold())}
					className={`px-2 py-1 text-xs font-bold rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("bold") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					B
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleItalic())}
					className={`px-2 py-1 text-xs italic rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("italic") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					i
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleStrike())}
					className={`px-2 py-1 text-xs line-through rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("strike") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					S
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleCode())}
					className={`px-2 py-1 text-xs font-mono rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("code") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					{"</>"}
				</button>

				<div className="w-[1px] h-4 bg-neutral-200 dark:border-neutral-800 mx-1" />

				{/* Lists & Blocks */}
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleBulletList())}
					className={`px-2 py-1 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("bulletList") ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					• 목록
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleOrderedList())}
					className={`px-2 py-1 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("orderedList") ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					1. 순서목록
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleBlockquote())}
					className={`px-2 py-1 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("blockquote") ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					“ 인용구
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleCodeBlock())}
					className={`px-2 py-1 text-xs font-mono rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ${
						editor.isActive("codeBlock") ? "bg-neutral-200 dark:bg-neutral-800 font-bold" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					코드블록
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.setHorizontalRule())}
					className="px-2 py-1 text-xs rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition text-neutral-600 dark:text-neutral-400"
				>
					구분선
				</button>
			</div>

			{/* Borderless Canvas Area */}
			<div className="flex-1 w-full max-w-3xl mx-auto py-4">
				<EditorContent editor={editor} />
			</div>

			{/* Slash Command Popup Portal */}
			{slashOpen && (
				<SlashMenuPopup
					items={filterCommands(slashQuery)}
					coords={slashCoords}
					selectedIndex={slashIndex}
					onSelect={(cmd) => {
						if (slashRangeRef.current) {
							cmd.action(editor, slashRangeRef.current);
							setSlashOpen(false);
						}
					}}
				/>
			)}

			{/* Internal Link Popup Portal */}
			{linkOpen && (
				<InternalLinkPopup
					items={linkItems}
					isLoading={isLinkLoading}
					coords={linkCoords}
					selectedIndex={linkIndex}
					onSelect={(item) => {
						if (linkRangeRef.current) {
							const formatted = formatContentLinkMdx(item);
							editor
								.chain()
								.focus()
								.deleteRange(linkRangeRef.current)
								.insertContent(formatted)
								.run();
							setLinkOpen(false);
						}
					}}
					onClose={() => setLinkOpen(false)}
				/>
			)}

			{/* Block Handle Floating Overlay */}
			{handleCoords && (
				<BlockHandleOverlay
					coords={handleCoords}
					onMoveUp={handleMoveUp}
					onMoveDown={handleMoveDown}
					onDuplicate={handleDuplicate}
					onDelete={handleDeleteBlock}
				/>
			)}
		</div>
	);
}
