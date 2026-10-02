"use client";

import { isImageMime } from "@bh2980/cms/core/api";
import { fileTypeLabel, formatFileSize } from "@bh2980/cms/core/file-display";
import { Copy, ExternalLink, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { formatBytes } from "@/cms/editor/upload-helper";
import { type SlotRequest, SlotScope } from "@/cms/slots/slots";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/cn";
import { copyText, type MediaItem, withExtension } from "./media-item";
import { MediaThumb } from "./media-views";

/** 상세의 한 묶음. 제목은 작게, 내용은 그 아래에 둔다. */
function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3 border-t px-4 py-4">
			<h3 className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">{title}</h3>
			{children}
		</section>
	);
}

/** 항목 이름을 위에, 값을 아래에 둔다. 긴 값(ID·파일 이름)이 이름 칸을 밀어내지 않는다. */
function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="space-y-0.5">
			<dt className="text-[11px] text-muted-foreground">{label}</dt>
			<dd className="break-all">{children}</dd>
		</div>
	);
}

/**
 * 미디어 상세(§7.3). 바둑판·목록 어느 보기에서 골라도 오른쪽에 열린다.
 * 위에서부터 미리보기 → 바로 쓰는 작업(주소·ID 복사, 열기) → 정보 → 기본 설명(이미지) → 사용처 → 삭제 순이다.
 * 이름·기본 설명은 AI 자리(파일 이름·대체 텍스트·캡션 추천)를 둔다.
 */
export function MediaDetailPanel({
	media,
	className,
	onClose,
	onSaveDefaults,
	onRename,
	onRequestDelete,
}: {
	media: MediaItem;
	className?: string;
	onClose: () => void;
	onSaveDefaults: (defaults: { alt: string; caption: string }) => void;
	onRename: (filename: string) => void;
	onRequestDelete: () => void;
}) {
	const altId = useId();
	const captionId = useId();
	const [draft, setDraft] = useState({ alt: media.defaultAlt, caption: media.defaultCaption });
	const isImage = isImageMime(media.mimeType);

	/** 미디어 파일 자리. 이미지 내용을 보고 이름·기본 설명을 추천한다. */
	const slot = (target: "filename" | "defaultAlt" | "defaultCaption", apply: (value: string) => void): SlotRequest => ({
		slot: "media",
		target,
		scope: media.id,
		disabled: media.status !== "ready" || !isImage,
		getContext: () => ({
			mediaId: media.id,
			filename: media.filename,
			current: target === "filename" ? media.filename : target === "defaultAlt" ? draft.alt : draft.caption,
		}),
		apply,
	});

	return (
		<aside aria-label="미디어 상세" className={cn("flex h-full flex-col border-l bg-background text-xs", className)}>
			<div className="flex h-11 shrink-0 items-center gap-2 border-b pr-2 pl-4">
				<h2 className="min-w-0 flex-1 truncate font-medium text-sm" title={media.filename}>
					{media.filename}
				</h2>
				<Button type="button" variant="ghost" size="icon-sm" aria-label="상세 닫기" onClick={onClose}>
					<X aria-hidden className="size-4" />
				</Button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="space-y-3 p-4">
					<div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border bg-muted/50">
						{isImage && media.publicUrl ? (
							// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
							<img src={media.publicUrl} alt="" className="max-h-full max-w-full object-contain" />
						) : (
							<span className="flex flex-col items-center gap-2 text-muted-foreground">
								<MediaThumb media={media} iconClassName="size-12" />
								<span className="font-medium">{fileTypeLabel(media.filename, media.mimeType)}</span>
							</span>
						)}
					</div>
					<div className="flex flex-wrap gap-1.5">
						{media.publicUrl && (
							<>
								<Button
									type="button"
									variant="outline"
									size="xs"
									onClick={() => void copyText(media.publicUrl as string, "주소를 복사했습니다.")}
								>
									<Copy aria-hidden />
									주소 복사
								</Button>
								<a
									href={media.publicUrl}
									target="_blank"
									rel="noopener noreferrer"
									className={buttonVariants({ variant: "outline", size: "xs" })}
								>
									<ExternalLink aria-hidden />
									열기
								</a>
							</>
						)}
						<Button
							type="button"
							variant="outline"
							size="xs"
							aria-label="미디어 ID 복사"
							onClick={() => void copyText(media.id, "미디어 ID를 복사했습니다.")}
						>
							<Copy aria-hidden />
							ID 복사
						</Button>
					</div>
				</div>

				<Section title="정보">
					<dl className="space-y-3">
						<SlotScope
							key={`filename-${media.id}`}
							request={slot("filename", (stem) => onRename(withExtension(stem, media.filename)))}
						>
							{({ trigger, panel }) => (
								<div className="space-y-1">
									<div className="flex items-start gap-1">
										<div className="min-w-0 flex-1">
											<Row label="파일 이름">{media.filename}</Row>
										</div>
										{isImage && trigger}
									</div>
									{panel}
								</div>
							)}
						</SlotScope>
						<Row label="형식">{isImage ? (media.mimeType ?? "—") : fileTypeLabel(media.filename, media.mimeType)}</Row>
						{isImage ? (
							<Row label="공개용">
								{media.width}×{media.height} · {formatBytes(media.byteSize ?? 0)}
							</Row>
						) : (
							<Row label="크기">{formatFileSize(media.byteSize ?? 0)}</Row>
						)}
						{isImage && media.original && (
							<Row label="원본">
								{media.original.width}×{media.original.height} · {formatBytes(media.original.byteSize ?? 0)} ·{" "}
								{media.original.mimeType}
							</Row>
						)}
						<Row label="올린 날짜">{new Date(media.createdAt).toLocaleString("ko-KR")}</Row>
						<Row label="미디어 ID">
							<code className="text-[11px]">{media.id}</code>
						</Row>
					</dl>
				</Section>

				{isImage && (
					<Section title="기본 설명">
						<p className="text-muted-foreground">본문에 넣을 때 복사되는 값입니다. 이미 쓴 본문은 바뀌지 않습니다.</p>
						<form
							className="space-y-3"
							onSubmit={(event) => {
								event.preventDefault();
								onSaveDefaults(draft);
							}}
						>
							<SlotScope
								key={`alt-${media.id}`}
								request={slot("defaultAlt", (alt) => setDraft((current) => ({ ...current, alt })))}
							>
								{({ trigger, panel }) => (
									<Field>
										<div className="flex items-center justify-between gap-2">
											<FieldLabel htmlFor={altId}>기본 대체 텍스트</FieldLabel>
											{trigger}
										</div>
										<Input
											id={altId}
											value={draft.alt}
											onChange={(event) => setDraft({ ...draft, alt: event.target.value })}
											className="h-8 text-xs md:text-xs"
										/>
										{panel}
									</Field>
								)}
							</SlotScope>
							<SlotScope
								key={`caption-${media.id}`}
								request={slot("defaultCaption", (caption) => setDraft((current) => ({ ...current, caption })))}
							>
								{({ trigger, panel }) => (
									<Field>
										<div className="flex items-center justify-between gap-2">
											<FieldLabel htmlFor={captionId}>기본 캡션</FieldLabel>
											{trigger}
										</div>
										<Input
											id={captionId}
											value={draft.caption}
											onChange={(event) => setDraft({ ...draft, caption: event.target.value })}
											className="h-8 text-xs md:text-xs"
										/>
										{panel}
									</Field>
								)}
							</SlotScope>
							<Button type="submit" size="sm" variant="outline" disabled={media.status !== "ready"}>
								기본값 저장
							</Button>
						</form>
					</Section>
				)}

				<Section title={`사용처 ${media.referencesCount}`}>
					{media.referencesCount === 0 ? (
						<p className="text-muted-foreground">초안·공개본에서 쓰이지 않습니다.</p>
					) : (
						<ul className="space-y-1">
							{media.references.map((reference) => (
								<li key={`${reference.entryId}-${reference.state}`}>
									<a
										href={`/admin/entries/${reference.entryId}/edit`}
										className="block truncate rounded-md border px-2 py-1.5 hover:bg-accent"
									>
										{reference.title || "(제목 없음)"} · {reference.state === "published" ? "공개본" : "초안"}
									</a>
								</li>
							))}
						</ul>
					)}
				</Section>
			</div>

			<div className="shrink-0 space-y-1.5 border-t px-4 py-3">
				<Button
					type="button"
					variant="destructive"
					size="sm"
					className="w-full"
					disabled={media.referencesCount > 0}
					onClick={onRequestDelete}
				>
					{media.status === "deleting" ? "삭제 다시 시도" : "삭제"}
				</Button>
				{media.referencesCount > 0 && (
					<p className="text-center text-[11px] text-muted-foreground">쓰이는 파일은 지울 수 없습니다.</p>
				)}
			</div>
		</aside>
	);
}
