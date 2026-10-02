import { type FileKind, fileKindOf, fileTypeLabel, formatFileSize } from "@bh2980/cms/core/file-display";
import type { ImageResolver } from "@bh2980/cms/mdx/image-src";
import { Download, FileArchive, FileText, FileType } from "lucide-react";

const ICONS: Record<FileKind, typeof FileText> = { pdf: FileType, archive: FileArchive, text: FileText };

/**
 * 첨부 파일 카드(`::file{mediaId label}`, v3). 주소는 호출자가 주입한 resolver가 해석한다(이미지와 같다).
 * 해석하지 못하면 이름만 보이고 내려받기는 없다.
 */
export function CmsFile({
	mediaId,
	label,
	resolve,
	downloadLabel,
	unavailableLabel,
}: {
	mediaId?: string;
	label?: string;
	resolve?: ImageResolver;
	downloadLabel: string;
	unavailableLabel: string;
}) {
	const resolved = mediaId && resolve ? resolve({ mediaId }) : null;
	const ok = resolved && "url" in resolved ? resolved : null;
	const filename = ok?.file?.filename ?? label ?? "";
	const name = label?.trim() || filename || unavailableLabel;
	const mimeType = ok?.file?.mimeType ?? null;
	const Icon = ICONS[fileKindOf(mimeType)];
	const details = ok
		? [fileTypeLabel(filename, mimeType), ok.file?.byteSize ? formatFileSize(ok.file.byteSize) : null]
				.filter(Boolean)
				.join(" · ")
		: unavailableLabel;

	return (
		<div className="not-prose my-6 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-card-foreground">
			<Icon aria-hidden className="size-8 shrink-0 text-muted-foreground" strokeWidth={1.5} />
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">{name}</p>
				<p className="text-muted-foreground text-xs">{details}</p>
			</div>
			{ok && (
				<a
					href={ok.url}
					download={filename || undefined}
					aria-label={`${name} ${downloadLabel}`}
					className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 font-medium text-xs transition-colors hover:bg-muted"
				>
					<Download aria-hidden className="size-3.5" />
					{downloadLabel}
				</a>
			)}
		</div>
	);
}
