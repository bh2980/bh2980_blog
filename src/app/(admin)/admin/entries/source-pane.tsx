"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { useState } from "react";
import { buildEditorExtensions } from "@/cms/editor/extensions";
import { mdxToTiptap } from "@/cms/editor/tiptap-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const PROSE =
	"prose dark:prose-invert max-w-none text-base text-foreground leading-relaxed focus:outline-none " +
	// 읽기 전용: 코드 블록 도구 줄은 숨기고, 접기 상자는 늘 펼쳐 보인다.
	"[&_[data-code-ui]]:hidden [&_[data-cms-container-node=cmsCollapsible]_.hidden]:block";

function PreviewEditor({ mdx, label }: { mdx: string; label: string }) {
	const [extensions] = useState(() => buildEditorExtensions());
	const editor = useEditor({
		immediatelyRender: false,
		editable: false,
		extensions,
		content: mdxToTiptap(mdx),
		editorProps: { attributes: { "aria-label": label, class: PROSE } },
	});
	return <EditorContent editor={editor} />;
}

/** 읽기 전용 MDX 미리보기. 글 모양 그대로 그린다. 내용이 바뀌면 편집기를 새로 만든다. */
export function MdxPreview({ mdx, label = "미리보기" }: { mdx: string; label?: string }) {
	return <PreviewEditor key={mdx} mdx={mdx} label={label} />;
}

/** 번역본 옆에 놓는 원문 전체(v3). 번역 편집기와 따로 스크롤한다. */
export function SourcePane({
	mdx,
	locale,
	onClose,
	className,
}: {
	mdx: string;
	locale: string;
	onClose: () => void;
	className?: string;
}) {
	return (
		<aside
			aria-label="원문 창"
			className={cn("flex h-full min-w-0 flex-col overflow-y-auto border-r bg-background", className)}
		>
			<div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
				<h2 className="flex-1 font-medium text-sm">{locale.toUpperCase()} 원문</h2>
				<Button type="button" size="icon-sm" variant="ghost" aria-label="원문 닫기" onClick={onClose}>
					<X aria-hidden className="size-4" />
				</Button>
			</div>
			<div className="px-6 pt-8 pb-[35vh]">
				<MdxPreview mdx={mdx} label="원문 본문" />
			</div>
		</aside>
	);
}
