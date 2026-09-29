"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import { X } from "lucide-react";
import { type Ref, useState } from "react";
import { buildEditorExtensions } from "@/cms/editor/extensions";
import { mdxToTiptap } from "@/cms/editor/tiptap-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

const PROSE =
	"prose dark:prose-invert max-w-none text-base text-foreground leading-relaxed focus:outline-none " +
	// 읽기 전용: 코드 블록 도구 줄은 숨기고, 접기 상자는 늘 펼쳐 보인다.
	"[&_[data-code-ui]]:hidden [&_[data-cms-container-node=cmsCollapsible]_.hidden]:block " +
	// 번역 편집기에서 커서가 있는 블록에 대응하는 원문 블록(source-sync).
	"[&_.cms-source-active]:rounded-sm [&_.cms-source-active]:bg-primary/5 [&_.cms-source-active]:shadow-[inset_2px_0_0_0_var(--color-primary)]";

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
	title,
	onClose,
	className,
	ref,
}: {
	mdx: string;
	locale: string;
	/** 원문 제목. 번역 편집기의 제목 자리와 같게 본문 위에 크게 보인다. */
	title: string;
	onClose: () => void;
	className?: string;
	/** 스크롤하는 요소. 편집기와 스크롤을 잇는 데 쓴다. */
	ref?: Ref<HTMLElement>;
}) {
	return (
		<aside
			ref={ref}
			aria-label="원문 창"
			className={cn("flex h-full min-w-0 flex-col overflow-y-auto border-r bg-background", className)}
		>
			<div
				data-source-header
				className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur"
			>
				<h2 className="flex-1 font-medium text-sm">{locale.toUpperCase()} 원문</h2>
				<Button type="button" size="icon-sm" variant="ghost" aria-label="원문 닫기" onClick={onClose}>
					<X aria-hidden className="size-4" />
				</Button>
			</div>
			<h1
				className={cn(
					"px-6 pt-12 pb-5 font-semibold text-[34px] leading-tight tracking-tight",
					!title && "text-muted-foreground/40",
				)}
			>
				{title || "제목 없는 글"}
			</h1>
			<div className="px-6 pt-6 pb-[35vh]">
				<MdxPreview mdx={mdx} label="원문 본문" />
			</div>
		</aside>
	);
}
