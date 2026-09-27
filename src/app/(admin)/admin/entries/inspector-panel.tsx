"use client";

import Link from "next/link";
import type { IncomingReferenceItem } from "@/cms/adapters/postgres/content-store";
import { COLLECTION_DEFINITIONS, isCollection } from "@/cms/core/collections";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_LOCALE, isLocale, LOCALE_INFO, localizePath } from "@/libs/i18n/locales";
import { cn } from "@/utils/cn";
import type { CmsIssue } from "../api-error-message";
import { describeEntryStatus } from "../shared/entry-status";
import { type EntryData, type EntryForm, type EntryFormPatch, formFromSourceMetadata } from "./entry-form";
import { SchemaFields } from "./schema-fields";

const REFERENCE_KIND_LABELS = { entry: "글", media: "미디어", category: "카테고리", tag: "태그" };

const localeName = (locale: string) => (isLocale(locale) ? LOCALE_INFO[locale].adminName : locale);

export type LifecycleAction = "archive" | "unarchive" | "trash" | "restore";

interface InspectorPanelProps {
	collection: string;
	form: EntryForm;
	disabled: boolean;
	publishIssues?: CmsIssue[];
	/** 요약이 비었을 때 발행하면 쓸 자동 요약(§5.6). */
	autoSummaryPreview: string;
	entry: EntryData | null;
	previewHref: string | null;
	incomingReferences: IncomingReferenceItem[];
	isLoadingIncomingReferences: boolean;
	incomingReferencesError: string | null;
	onRefreshIncomingReferences: () => void;
	onTitleChange: (title: string) => void;
	onSlugChange: (slug: string) => void;
	onRegenerateSlug: () => void;
	onChange: (patch: EntryFormPatch) => void;
	onDuplicate: () => void;
	onLifecycle: (action: LifecycleAction) => void;
	onPermanentDelete: () => void;
	onClose?: () => void;
}

export function InspectorPanel({
	collection,
	form,
	disabled,
	publishIssues = [],
	autoSummaryPreview,
	entry,
	previewHref,
	incomingReferences,
	isLoadingIncomingReferences,
	incomingReferencesError,
	onRefreshIncomingReferences,
	onTitleChange,
	onSlugChange,
	onRegenerateSlug,
	onChange,
	onDuplicate,
	onLifecycle,
	onPermanentDelete,
	onClose,
}: InspectorPanelProps) {
	const workingReferences = incomingReferences.filter((reference) => reference.state === "working");
	const publishedReferences = incomingReferences.filter((reference) => reference.state === "published");

	const actionButton = "h-7 px-2 text-xs";

	return (
		<div className="h-full w-full space-y-5 overflow-y-auto border-l bg-background px-5 py-4 text-sm lg:w-80">
			<div className="flex h-7 items-center justify-between">
				<h2 className="font-medium text-muted-foreground text-xs">속성</h2>
				{onClose && (
					<Button type="button" size="sm" variant="ghost" className={actionButton} onClick={onClose}>
						닫기
					</Button>
				)}
			</div>

			{entry && (
				<section aria-label="상태와 작업" className="space-y-2 text-xs">
					<p>
						<span className="font-semibold">상태</span>{" "}
						{describeEntryStatus({ ...entry, scheduledAt: entry.schedule?.pending?.scheduledAt })}
					</p>
					{entry.publishedSlug && entry.status === "published" && (
						<p className="break-all text-muted-foreground">
							공개 주소:{" "}
							{localizePath(
								isLocale(entry.locale) ? entry.locale : DEFAULT_LOCALE,
								`/${collection === "memo" ? "memos" : "posts"}/${entry.publishedSlug}`,
							)}
						</p>
					)}
					<div className="flex flex-wrap gap-1.5">
						{previewHref && (
							<a
								href={previewHref}
								target="_blank"
								rel="noreferrer"
								className={cn(buttonVariants({ variant: "outline", size: "sm" }), actionButton)}
							>
								미리보기
							</a>
						)}
						{entry.status !== "trashed" && (
							<Button type="button" size="sm" variant="outline" className={actionButton} onClick={onDuplicate}>
								복제
							</Button>
						)}
						{(entry.status === "draft" || entry.status === "published") && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className={actionButton}
								onClick={() => onLifecycle("archive")}
							>
								보관
							</Button>
						)}
						{entry.status === "archived" && (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className={actionButton}
								onClick={() => onLifecycle("unarchive")}
							>
								보관 해제
							</Button>
						)}
						{entry.status === "trashed" ? (
							<>
								<Button
									type="button"
									size="sm"
									variant="outline"
									className={actionButton}
									onClick={() => onLifecycle("restore")}
								>
									복원
								</Button>
								<Button
									type="button"
									size="sm"
									variant="destructive"
									className={actionButton}
									onClick={onPermanentDelete}
								>
									영구 삭제
								</Button>
							</>
						) : (
							<Button
								type="button"
								size="sm"
								variant="outline"
								className={`${actionButton} text-destructive`}
								onClick={() => onLifecycle("trash")}
							>
								휴지통
							</Button>
						)}
					</div>
				</section>
			)}

			<fieldset disabled={disabled} className="space-y-6 disabled:opacity-70">
				{isCollection(collection) && (
					<SchemaFields
						collection={collection}
						form={form}
						issues={publishIssues}
						context={{ entryId: entry?.id, autoSummaryPreview, disabled }}
						onChange={onChange}
						onSourceChange={onTitleChange}
						onSlugChange={onSlugChange}
						onRegenerateSlug={onRegenerateSlug}
						locked={
							entry?.source
								? {
										values: formFromSourceMetadata(collection, entry.source.metadata),
										note: (
											<>
												원문({localeName(entry.source.locale)}) 값입니다.{" "}
												<Link
													href={`/admin/entries/${entry.source.id}/edit`}
													className="text-primary underline-offset-2 hover:underline"
												>
													원문에서 바꿉니다
												</Link>
											</>
										),
									}
								: undefined
						}
					/>
				)}
			</fieldset>

			<Separator />
			<section aria-labelledby="cms-incoming-references-heading" className="space-y-3">
				<div className="flex items-center justify-between gap-2">
					<h3 id="cms-incoming-references-heading" className="font-semibold text-xs">
						사용처
					</h3>
					<Button
						type="button"
						variant="outline"
						size="sm"
						aria-label="사용처 새로고침"
						disabled={!entry || isLoadingIncomingReferences}
						onClick={onRefreshIncomingReferences}
						className={actionButton}
					>
						{isLoadingIncomingReferences ? "불러오는 중" : "새로고침"}
					</Button>
				</div>
				{!entry ? (
					<p className="text-muted-foreground text-xs">초안을 저장하면 사용처가 표시됩니다.</p>
				) : incomingReferencesError ? (
					<p role="alert" className="text-destructive text-xs">
						{incomingReferencesError}
					</p>
				) : incomingReferences.length === 0 ? (
					<p className="text-muted-foreground text-xs">사용 중인 관계가 없습니다.</p>
				) : (
					[
						{ title: "초안에서 사용", references: workingReferences },
						{ title: "현재 공개본에서 사용", references: publishedReferences },
					].map(({ title, references }) =>
						references.length > 0 ? (
							<div key={title} className="space-y-1.5">
								<h4 className="font-medium text-[11px] text-muted-foreground">{title}</h4>
								<ul className="space-y-2">
									{references.map((reference) => (
										<li
											key={`${reference.state}:${reference.sourceId}:${reference.kind}`}
											className="rounded-md border bg-background p-2 text-xs"
										>
											<Link
												href={`/admin/entries/${reference.sourceId}/edit`}
												className="font-medium text-primary hover:underline"
											>
												{reference.sourceTitle || reference.sourceSlug || reference.sourceId}
											</Link>{" "}
											<span className="text-muted-foreground">
												{isCollection(reference.sourceCollection)
													? COLLECTION_DEFINITIONS[reference.sourceCollection].label
													: reference.sourceCollection}{" "}
												· {REFERENCE_KIND_LABELS[reference.kind]}
											</span>
											{reference.isStale && (
												<span className="ml-1 text-amber-700 dark:text-amber-400">대상 변경 확인 필요</span>
											)}
											{reference.occurrences.length > 0 && (
												<ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
													{reference.occurrences.map((occurrence) => (
														<li
															key={
																occurrence.type === "mdx"
																	? `mdx:${occurrence.line}:${occurrence.column}`
																	: `metadata:${occurrence.path}:${occurrence.ordinal ?? ""}`
															}
														>
															{occurrence.type === "mdx"
																? `본문 ${occurrence.line}:${occurrence.column}`
																: `${occurrence.path}${occurrence.ordinal === undefined ? "" : ` · ${occurrence.ordinal + 1}번째`}`}
														</li>
													))}
												</ul>
											)}
										</li>
									))}
								</ul>
							</div>
						) : null,
					)
				)}
			</section>
		</div>
	);
}
