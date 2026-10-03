"use client";

import { type FileKind, fileKindOf, fileTypeLabel, formatFileSize } from "@bh2980/cms/client";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { FileArchive, FileText, FileType } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../lib/utils/cn";
import { SELECTED_RING, useEditorEditable } from "./blocks/shared";

const ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

type MediaInfo = { filename: string; byteSize: number | null; mimeType: string | null; status?: string };

/** 에디터의 첨부 파일 카드. 공개 화면 카드와 같은 모양이고, 이름을 바로 고칠 수 있다. */
export function CmsFileNodeView({ node, updateAttributes, selected, editor }: NodeViewProps) {
	const mediaId = typeof node.attrs.mediaId === "string" ? node.attrs.mediaId : "";
	const label = typeof node.attrs.label === "string" ? node.attrs.label : "";
	const [media, setMedia] = useState<MediaInfo | null | "failed">(null);
	const editable = useEditorEditable(editor);

	useEffect(() => {
		if (!mediaId) return;
		let cancelled = false;
		fetch(`/api/cms/v1/media/${encodeURIComponent(mediaId)}`)
			.then(async (response) => {
				if (!response.ok) throw new Error("media_lookup_failed");
				return (await response.json()) as MediaInfo;
			})
			.then((result) => !cancelled && setMedia(result))
			.catch(() => !cancelled && setMedia("failed"));
		return () => {
			cancelled = true;
		};
	}, [mediaId]);

	const info = media && media !== "failed" ? media : null;
	const filename = info?.filename ?? "";
	const Icon = ICONS[fileKindOf(info?.mimeType)];
	const details =
		media === "failed"
			? "파일을 찾을 수 없음"
			: info
				? [fileTypeLabel(filename, info.mimeType), info.byteSize ? formatFileSize(info.byteSize) : null]
						.filter(Boolean)
						.join(" · ")
				: "불러오는 중…";

	return (
		<NodeViewWrapper
			data-file-block
			className={cn(
				"not-prose my-6 flex items-center gap-3 rounded-lg border bg-card px-4 py-3",
				selected && SELECTED_RING,
			)}
		>
			<Icon aria-hidden className="size-8 shrink-0 text-muted-foreground" strokeWidth={1.5} />
			<div className="min-w-0 flex-1">
				<input
					aria-label="보일 이름"
					value={label}
					placeholder={filename || "파일"}
					disabled={!editable}
					// 입력 글자가 에디터 문서로 새지 않게 한다.
					onKeyDown={(event) => event.stopPropagation()}
					onChange={(event) => updateAttributes({ label: event.target.value || null })}
					className="w-full truncate bg-transparent font-medium text-sm outline-none placeholder:text-foreground"
				/>
				<p className={cn("text-muted-foreground text-xs", media === "failed" && "text-destructive")}>{details}</p>
			</div>
		</NodeViewWrapper>
	);
}
