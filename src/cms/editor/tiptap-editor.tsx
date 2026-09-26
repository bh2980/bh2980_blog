"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ImageIcon, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { BlockHandleOverlay } from "./block-handle-overlay";
import { CmsImageNode } from "./image-node";
import { formatContentLinkMdx, type InternalLinkItem, parseInternalLinkTrigger } from "./internal-link";
import { InternalLinkPopup } from "./internal-link-popup";
import { filterCommands, type SlashCommandItem } from "./slash-command";
import { SlashMenuPopup } from "./slash-menu-popup";
import { mdxToTiptap, tiptapToMdx } from "./tiptap-content";
import { CMS_SCHEMA_EXTENSIONS } from "./tiptap-schema";
import { uploadImageFile } from "./upload-helper";

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

	// Image Uploading State
	const [isUploadingImage, setIsUploadingImage] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [pendingImage, setPendingImage] = useState<File | null>(null);
	const [imageAlt, setImageAlt] = useState("");
	const [isDecorativeImage, setIsDecorativeImage] = useState(false);
	const [imageUploadError, setImageUploadError] = useState<string | null>(null);

	const syncTriggerPopup = (currentEditor: Editor) => {
		if (isComposingRef.current) return;
		const { from } = currentEditor.state.selection;
		const textBefore = currentEditor.state.doc.textBetween(Math.max(0, from - 50), from, "\n", "\0");

		const linkMatch = parseInternalLinkTrigger(textBefore);
		if (linkMatch.active) {
			const triggerPos = from - linkMatch.query.length - 2;
			linkRangeRef.current = { from: triggerPos, to: from };
			setLinkQuery(linkMatch.query);
			setLinkIndex(0);
			const coords = currentEditor.view.coordsAtPos(from);
			setLinkCoords({ top: coords.top, left: coords.left });
			setLinkOpen(true);
			setSlashOpen(false);
			return;
		}

		setLinkOpen(false);
		const slashMatch = textBefore.match(/(?:^|\s)\/([^\s]*)$/);
		if (!slashMatch) {
			setSlashOpen(false);
			return;
		}

		const query = slashMatch[1] || "";
		const slashPos = from - query.length - 1;
		slashRangeRef.current = { from: slashPos, to: from };
		setSlashQuery(query);
		setSlashIndex(0);
		const coords = currentEditor.view.coordsAtPos(from);
		setSlashCoords({ top: coords.top, left: coords.left });
		setSlashOpen(true);
	};

	const editor = useEditor({
		immediatelyRender: false,
		editable,
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3],
				},
				// `meta`를 보존하는 CmsCodeBlock을 쓴다(스키마의 CMS_SCHEMA_EXTENSIONS).
				codeBlock: false,
			}),
			...CMS_SCHEMA_EXTENSIONS,
			CmsImageNode,
		],
		content: mdxToTiptap(content),
		editorProps: {
			attributes: {
				class:
					"prose dark:prose-invert max-w-none min-h-full flex-1 p-6 focus:outline-none text-neutral-800 dark:text-neutral-200 text-base leading-relaxed selection:bg-blue-100 dark:selection:bg-blue-900/40",
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
			onChange(tiptapToMdx(editor.getJSON()));

			// Refresh after compositionend too, since IMEs may not emit a final update.
			syncTriggerPopup(editor);
		},
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

	// Confirm image meaning before any new editor insertion.
	const handleUploadImage = useCallback(
		(file: File) => {
			if (!editor?.isEditable) return;
			setImageUploadError(null);
			setImageAlt("");
			setIsDecorativeImage(false);
			setPendingImage(file);
		},
		[editor],
	);

	const confirmImageUpload = useCallback(async () => {
		if (!editor || !pendingImage || (!isDecorativeImage && !imageAlt.trim())) return;
		setIsUploadingImage(true);
		setUploadProgress(0);
		setImageUploadError(null);
		try {
			const uploaded = await uploadImageFile(pendingImage, setUploadProgress);
			editor
				.chain()
				.focus()
				.insertContent({
					type: "image",
					attrs: {
						mediaId: uploaded.mediaId,
						src: uploaded.publicUrl,
						alt: isDecorativeImage ? "" : imageAlt.trim(),
						decorative: isDecorativeImage,
						width: "100%",
						align: "center",
					},
				})
				.run();
			setPendingImage(null);
		} catch (err) {
			setImageUploadError(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
		} finally {
			setIsUploadingImage(false);
			setUploadProgress(0);
		}
	}, [editor, imageAlt, isDecorativeImage, pendingImage]);

	// Listen to custom upload events (e.g. from slash command)
	useEffect(() => {
		const listener = (e: Event) => {
			const custom = e as CustomEvent<{ file: File }>;
			if (custom.detail?.file) {
				handleUploadImage(custom.detail.file);
			}
		};
		window.addEventListener("cms:upload-image", listener);
		return () => window.removeEventListener("cms:upload-image", listener);
	}, [handleUploadImage]);

	// Drag & Drop and Paste Handlers
	const handlePaste = useCallback(
		(e: React.ClipboardEvent<HTMLDivElement>) => {
			const items = e.clipboardData.items;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item.type.startsWith("image/")) {
					const file = item.getAsFile();
					if (file) {
						e.preventDefault();
						handleUploadImage(file);
						return;
					}
				}
			}
		},
		[handleUploadImage],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			const files = e.dataTransfer.files;
			if (files.length > 0) {
				for (let i = 0; i < files.length; i++) {
					const file = files[i];
					if (file.type.startsWith("image/")) {
						e.preventDefault();
						handleUploadImage(file);
						return;
					}
				}
			}
		},
		[handleUploadImage],
	);

	// Hover-based Block Handle Detection
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!editor) return;
			const target = e.target as HTMLElement;
			const blockEl = target.closest(
				".prose > p, .prose > h1, .prose > h2, .prose > h3, .prose > blockquote, .prose > pre, .prose > ul, .prose > ol, .prose > hr, .prose > figure",
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
		// biome-ignore lint/a11y/noStaticElementInteractions: editor shell tracks IME and drag state
		<div
			className="relative flex min-h-full w-full flex-1 flex-col bg-white dark:bg-neutral-950"
			onCompositionStart={() => {
				isComposingRef.current = true;
				if (onCompositionStart) onCompositionStart();
			}}
			onCompositionEnd={() => {
				isComposingRef.current = false;
				if (editor) syncTriggerPopup(editor);
				if (onCompositionEnd) onCompositionEnd();
			}}
			onMouseMove={handleMouseMove}
		>
			{/* Fixed Sticky Rich Formatting Toolbar */}
			<div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 border-neutral-200 border-b bg-white/95 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
				{/* Block Types */}
				<button
					type="button"
					onMouseDown={setFormat((c) => c.setParagraph())}
					className={`rounded px-2.5 py-1 font-medium text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("paragraph")
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					본문
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleHeading({ level: 1 }))}
					className={`rounded px-2 py-1 font-medium text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("heading", { level: 1 })
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					H1
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleHeading({ level: 2 }))}
					className={`rounded px-2 py-1 font-medium text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("heading", { level: 2 })
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					H2
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleHeading({ level: 3 }))}
					className={`rounded px-2 py-1 font-medium text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("heading", { level: 3 })
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					H3
				</button>

				<div className="mx-1 h-4 w-[1px] bg-neutral-200 dark:border-neutral-800" />

				{/* Inlines */}
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleBold())}
					className={`rounded px-2 py-1 font-bold text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("bold") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					B
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleItalic())}
					className={`rounded px-2 py-1 text-xs italic transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("italic") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					i
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleStrike())}
					className={`rounded px-2 py-1 text-xs line-through transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("strike") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					S
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleCode())}
					className={`rounded px-2 py-1 font-mono text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("code") ? "bg-neutral-200 dark:bg-neutral-800" : "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					{"</>"}
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleUnderline())}
					className={`rounded px-2 py-1 text-xs underline transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("underline")
							? "bg-neutral-200 dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					U
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleSuperscript())}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("superscript")
							? "bg-neutral-200 dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					x²
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleSubscript())}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("subscript")
							? "bg-neutral-200 dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					x₂
				</button>

				<div className="mx-1 h-4 w-[1px] bg-neutral-200 dark:border-neutral-800" />

				{/* 정렬 (:::text-align) */}
				<button
					type="button"
					onMouseDown={setFormat((c) => c.setTextAlign("left"))}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive({ textAlign: "left" })
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					왼쪽
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.setTextAlign("center"))}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive({ textAlign: "center" })
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					가운데
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.setTextAlign("right"))}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive({ textAlign: "right" })
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					오른쪽
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.unsetTextAlign())}
					className="rounded px-2 py-1 text-neutral-600 text-xs transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
				>
					자동
				</button>

				<div className="mx-1 h-4 w-[1px] bg-neutral-200 dark:border-neutral-800" />

				{/* Lists & Blocks */}
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleBulletList())}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("bulletList")
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					• 목록
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleOrderedList())}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("orderedList")
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					1. 순서목록
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleBlockquote())}
					className={`rounded px-2 py-1 text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("blockquote")
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					“ 인용구
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.toggleCodeBlock())}
					className={`rounded px-2 py-1 font-mono text-xs transition hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
						editor.isActive("codeBlock")
							? "bg-neutral-200 font-bold dark:bg-neutral-800"
							: "text-neutral-600 dark:text-neutral-400"
					}`}
				>
					코드블록
				</button>
				<button
					type="button"
					onMouseDown={setFormat((c) => c.setHorizontalRule())}
					className="rounded px-2 py-1 text-neutral-600 text-xs transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
				>
					구분선
				</button>
				<button
					type="button"
					onMouseDown={(e) => {
						e.preventDefault();
						const input = document.createElement("input");
						input.type = "file";
						input.accept = "image/jpeg,image/png,image/webp,image/gif,image/avif";
						input.onchange = () => {
							const file = input.files?.[0];
							if (file) handleUploadImage(file);
						};
						input.click();
					}}
					className="flex items-center gap-1 rounded px-2 py-1 text-neutral-600 text-xs transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
				>
					<ImageIcon className="h-3.5 w-3.5" />
					이미지
				</button>
			</div>

			<Dialog open={Boolean(pendingImage)} onOpenChange={(open) => !open && !isUploadingImage && setPendingImage(null)}>
				<DialogContent className="max-w-md" showCloseButton={!isUploadingImage}>
					<DialogHeader>
						<DialogTitle>이미지 대체 텍스트</DialogTitle>
						<DialogDescription>
							{pendingImage?.name} 이미지에 설명을 입력하거나 장식 이미지로 표시하세요.
						</DialogDescription>
					</DialogHeader>
					<label htmlFor="image-alt" className="font-medium text-sm">
						대체 텍스트
					</label>
					<input
						id="image-alt"
						aria-invalid={Boolean(imageUploadError) || undefined}
						aria-describedby={imageUploadError ? "image-alt-error" : undefined}
						value={imageAlt}
						disabled={isDecorativeImage}
						aria-required={!isDecorativeImage}
						onChange={(event) => setImageAlt(event.target.value)}
						className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
					/>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={isDecorativeImage}
							onChange={(event) => setIsDecorativeImage(event.target.checked)}
						/>
						장식 이미지 (스크린 리더에서 생략)
					</label>
					{imageUploadError && (
						<p id="image-alt-error" role="alert" className="text-destructive text-sm">
							이미지 업로드 실패: {imageUploadError}
						</p>
					)}
					<DialogFooter>
						<button
							type="button"
							disabled={isUploadingImage}
							onClick={() => setPendingImage(null)}
							className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
						>
							취소
						</button>
						<button
							type="button"
							disabled={isUploadingImage || (!isDecorativeImage && !imageAlt.trim())}
							onClick={confirmImageUpload}
							className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
						>
							업로드 및 삽입
						</button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Image Uploading Progress Bar */}
			{isUploadingImage && (
				<div className="flex items-center gap-3 border-blue-200 border-b bg-blue-50 px-4 py-1.5 text-blue-700 text-xs dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					<span>이미지 업로드 중... {uploadProgress}%</span>
					<div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-900">
						<div className="h-full bg-blue-600 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
					</div>
				</div>
			)}

			{/* Borderless Canvas Area */}
			{/* biome-ignore lint/a11y: editor canvas click focuses the rich text editor */}
			<div
				className="mx-auto flex min-h-full w-full max-w-3xl flex-1 cursor-text flex-col px-4 py-6"
				onClick={() => {
					if (editor && !editor.isFocused) {
						editor.chain().focus("end").run();
					}
				}}
				onPaste={handlePaste}
				onDrop={handleDrop}
				onDragOver={(e) => e.preventDefault()}
			>
				<EditorContent
					editor={editor}
					className="flex min-h-full flex-1 flex-col [&>.ProseMirror]:min-h-[calc(100vh-240px)] [&>.ProseMirror]:flex-1"
				/>
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
					onClose={() => {
						setSlashOpen(false);
						editor.chain().focus().run();
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
							editor.chain().focus().deleteRange(linkRangeRef.current).insertContent(formatted).run();
							setLinkOpen(false);
						}
					}}
					onClose={() => {
						setLinkOpen(false);
						editor.chain().focus().run();
					}}
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
