"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { CmsMdxPreserver } from "./tiptap-schema";

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
		},
		onUpdate: ({ editor }) => {
			if (isInternalUpdateRef.current) return;
			onChange(editor.getHTML());
		},
	});

	useEffect(() => {
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

	if (!editor) return null;

	const setFormat = (fn: (e: any) => any) => (e: React.MouseEvent) => {
		e.preventDefault(); // prevent focus loss
		fn(editor.chain().focus()).run();
	};

	return (
		<div
			className="w-full flex flex-col bg-white dark:bg-neutral-950"
			onCompositionStart={onCompositionStart}
			onCompositionEnd={onCompositionEnd}
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
		</div>
	);
}
