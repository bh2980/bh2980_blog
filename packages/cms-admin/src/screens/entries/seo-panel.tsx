"use client";

import {
	contentPath,
	DEFAULT_LOCALE,
	isCollection,
	isLocale,
	localizePath,
	SITE_NAME,
	schemaOf,
} from "@bh2980/cms/client";
import { ChevronRight, ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ImageInsertDialog } from "../../editor/image-insert-dialog";
import { cn } from "../../lib/utils/cn";
import type { SlotRequest } from "../../slots/slots";
import { Button } from "../../ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../ui/collapsible";
import { Input } from "../../ui/input";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";
import { cmsFetch } from "../admin-api";
import type { CmsIssue } from "../api-error-message";
import type { EntryData, EntryForm, EntryFormPatch } from "./entry-form";
import { FieldRow } from "./schema-fields";

/** 검색 결과에서 잘리지 않는 대략의 길이(Strapi·Yoast 등이 쓰는 기준). */
const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 155;

const text = (value: unknown) => (typeof value === "string" ? value : "");

function Counter({ length, limit }: { length: number; limit: number }) {
	return (
		<span
			className={cn(
				"text-[11px] text-muted-foreground tabular-nums",
				length > limit && "text-amber-600 dark:text-amber-400",
			)}
		>
			{length}/{limit}
		</span>
	);
}

/** 미디어 ID의 공개 주소. 없거나 불러오지 못하면 `null`. */
function useMediaUrl(mediaId: string, known: Record<string, string | null>) {
	const [urls, setUrls] = useState<Record<string, string | null>>({});
	const cached = known[mediaId] ?? urls[mediaId];
	useEffect(() => {
		if (!mediaId || cached !== undefined) return;
		let cancelled = false;
		cmsFetch<{ publicUrl: string | null }>(`/api/cms/v1/media/${mediaId}`)
			.then((media) => !cancelled && setUrls((current) => ({ ...current, [mediaId]: media.publicUrl })))
			.catch(() => !cancelled && setUrls((current) => ({ ...current, [mediaId]: null })));
		return () => {
			cancelled = true;
		};
	}, [mediaId, cached]);
	return mediaId ? (cached ?? null) : null;
}

interface SeoPanelProps {
	collection: string;
	form: EntryForm;
	entry: EntryData | null;
	disabled: boolean;
	issues?: readonly CmsIssue[];
	onChange: (patch: EntryFormPatch) => void;
}

/**
 * 편집 화면 속성 칸의 SEO 탭(v3). 검색 결과 미리보기와 검색 제목·설명·공유 이미지·검색 노출·원본 주소.
 * 비운 칸은 공개 화면이 쓸 값(글 제목·요약·자동 카드)을 흐리게 보여 준다.
 */
export function SeoPanel({ collection, form, entry, disabled, issues = [], onChange }: SeoPanelProps) {
	const [picking, setPicking] = useState(false);
	const [pickedUrls, setPickedUrls] = useState<Record<string, string | null>>({});
	const issueFor = (path: string) => issues.find((issue) => issue.path === path);
	/** 스키마가 필수로 정한 SEO 필드. 속성 탭과 같이 라벨 옆에 별표를 단다. */
	const requiredOf = (name: string) => {
		const field = isCollection(collection) ? schemaOf(collection).fields[name] : undefined;
		return Boolean(field && "required" in field && field.required);
	};

	const seoTitle = text(form.seoTitle);
	const seoDescription = text(form.seoDescription);
	const ogImageId = text(form.ogImageId);
	const canonicalUrl = text(form.canonicalUrl);
	// 검색 노출은 언어마다 따로 두지 않는다. 번역본은 원문 값을 보여 주기만 한다.
	const robotsLocked = Boolean(entry?.source);
	const noindex = text(robotsLocked ? entry?.source?.metadata.seoRobots : form.seoRobots) === "noindex";

	const title = seoTitle.trim() || form.title.trim() || "제목 없음";
	const description = seoDescription.trim() || text(form.summary).trim();
	const locale = entry?.locale && isLocale(entry.locale) ? entry.locale : DEFAULT_LOCALE;
	const path = localizePath(locale, contentPath(collection, form.slug || "slug") ?? `/${form.slug || "slug"}`);
	const imageUrl = useMediaUrl(ogImageId, pickedUrls);

	/** 검색 제목·설명 자리. 속성 탭의 필드 자리와 같은 자리 이름(`field`)을 쓴다. */
	const fieldSlot = (target: "seoTitle" | "seoDescription", value: string): SlotRequest => ({
		slot: "field",
		target,
		collection,
		scope: entry?.id ?? "new",
		disabled,
		getContext: () => ({
			collection,
			locale: entry?.locale,
			entryId: entry?.id,
			title: form.title,
			summary: text(form.summary) || undefined,
			body: form.mdx,
			current: value || undefined,
		}),
		apply: (next) => onChange({ [target]: next }),
	});

	return (
		<div className="space-y-5">
			<section aria-label="검색 결과 미리보기" className="space-y-1 rounded-lg border bg-muted/30 p-3">
				<p className="truncate text-[11px] text-muted-foreground">
					{SITE_NAME}
					{path
						.split("/")
						.filter(Boolean)
						.map((part) => ` › ${decodeURIComponent(part)}`)}
				</p>
				<p className="line-clamp-2 font-medium text-[#1a0dab] text-sm leading-snug dark:text-[#8ab4f8]">{title}</p>
				<p className={cn("line-clamp-2 text-xs leading-relaxed", !description && "text-muted-foreground italic")}>
					{description || "설명 없음"}
				</p>
				{noindex && <p className="pt-1 font-medium text-[11px] text-amber-700 dark:text-amber-400">검색엔진에 숨김</p>}
			</section>

			<FieldRow
				id="cms-seoTitle"
				label="검색 제목"
				required={requiredOf("seoTitle")}
				slot={fieldSlot("seoTitle", seoTitle)}
				aside={<Counter length={(seoTitle || form.title).length} limit={TITLE_LIMIT} />}
				issue={issueFor("seoTitle")}
			>
				<Input
					id="cms-seoTitle"
					value={seoTitle}
					disabled={disabled}
					placeholder={form.title || "글 제목"}
					aria-invalid={Boolean(issueFor("seoTitle")) || undefined}
					onChange={(event) => onChange({ seoTitle: event.target.value })}
					className="h-8 text-xs md:text-xs"
				/>
			</FieldRow>

			<FieldRow
				id="cms-seoDescription"
				label="검색 설명"
				required={requiredOf("seoDescription")}
				slot={fieldSlot("seoDescription", seoDescription)}
				aside={<Counter length={(seoDescription || text(form.summary)).length} limit={DESCRIPTION_LIMIT} />}
				issue={issueFor("seoDescription")}
			>
				<Textarea
					id="cms-seoDescription"
					rows={3}
					value={seoDescription}
					disabled={disabled}
					placeholder={text(form.summary) || "요약"}
					aria-invalid={Boolean(issueFor("seoDescription")) || undefined}
					onChange={(event) => onChange({ seoDescription: event.target.value })}
					className="min-h-16 resize-none text-xs md:text-xs"
				/>
			</FieldRow>

			<FieldRow id="cms-ogImageId" label="공유 이미지" required={requiredOf("ogImageId")} issue={issueFor("ogImageId")}>
				<div className="overflow-hidden rounded-lg border">
					{ogImageId && imageUrl ? (
						// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
						<img src={imageUrl} alt="" className="aspect-[1.91/1] w-full object-cover" />
					) : ogImageId ? (
						<div className="flex aspect-[1.91/1] items-center justify-center bg-muted text-muted-foreground text-xs">
							<ImageIcon aria-hidden className="size-5" />
						</div>
					) : (
						// 비우면 공개 화면이 제목으로 카드를 만든다(`src/libs/contents/og.tsx`와 같은 모양).
						<div
							className="flex aspect-[1.91/1] items-center justify-center p-4"
							style={{ background: "linear-gradient(135deg, #eff6ff 0%, #e0f2fe 45%, #dbeafe 100%)" }}
						>
							<span className="line-clamp-3 rounded-xl border border-white/70 bg-white/55 px-4 py-3 text-center font-bold text-sm text-zinc-900 leading-snug">
								{form.title || "제목 없음"}
							</span>
						</div>
					)}
				</div>
				<div className="flex gap-1.5">
					<Button
						id="cms-ogImageId"
						type="button"
						size="sm"
						variant="outline"
						className="h-7 flex-1 text-xs"
						disabled={disabled}
						onClick={() => setPicking(true)}
					>
						{ogImageId ? "바꾸기" : "이미지 고르기"}
					</Button>
					{ogImageId && (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="h-7 text-xs"
							disabled={disabled}
							onClick={() => onChange({ ogImageId: "" })}
						>
							빼기
						</Button>
					)}
				</div>
			</FieldRow>

			<FieldRow
				id="cms-seoRobots"
				label="검색엔진에 숨기기"
				aside={
					<Switch
						id="cms-seoRobots"
						size="sm"
						checked={noindex}
						disabled={disabled || robotsLocked}
						onCheckedChange={(checked) => onChange({ seoRobots: checked ? "noindex" : "index" })}
					/>
				}
				help={robotsLocked ? "원문 값을 따릅니다." : undefined}
			>
				{null}
			</FieldRow>

			<Collapsible defaultOpen={Boolean(canonicalUrl) || Boolean(issueFor("canonicalUrl"))}>
				<CollapsibleTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="xs"
							className="group -ml-2 font-semibold text-muted-foreground text-xs"
						/>
					}
				>
					<ChevronRight className="transition-transform group-data-[panel-open]:rotate-90" />
					고급
				</CollapsibleTrigger>
				<CollapsibleContent className="pt-2">
					<FieldRow
						id="cms-canonicalUrl"
						label="원본 주소"
						required={requiredOf("canonicalUrl")}
						issue={issueFor("canonicalUrl")}
					>
						<Input
							id="cms-canonicalUrl"
							value={canonicalUrl}
							disabled={disabled}
							placeholder="https://example.com"
							aria-invalid={Boolean(issueFor("canonicalUrl")) || undefined}
							onChange={(event) => onChange({ canonicalUrl: event.target.value })}
							className="h-8 text-xs md:text-xs"
						/>
					</FieldRow>
				</CollapsibleContent>
			</Collapsible>

			<ImageInsertDialog
				open={picking}
				initialFile={null}
				mode="pick"
				title="공유 이미지"
				onClose={() => setPicking(false)}
				onInsert={(image) => {
					setPickedUrls((current) => ({ ...current, [image.mediaId]: image.publicUrl }));
					onChange({ ogImageId: image.mediaId });
					setPicking(false);
				}}
			/>
		</div>
	);
}
