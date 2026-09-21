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
					levels: [1, 2, 3, 4, 5, 6],
				},
			}),
			CmsMdxPreserver,
		],
		content,
		onUpdate: ({ editor }) => {
			if (isInternalUpdateRef.current) return;
			// Simple plain text / html representation
			const html = editor.getHTML();
			onChange(html);
		},
	});

	// Sync external content update if changed outside
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

	return (
		<div
			className="prose dark:prose-invert max-w-none min-h-[400px] p-4 focus:outline-none"
			onCompositionStart={onCompositionStart}
			onCompositionEnd={onCompositionEnd}
		>
			<EditorContent editor={editor} />
		</div>
	);
}
