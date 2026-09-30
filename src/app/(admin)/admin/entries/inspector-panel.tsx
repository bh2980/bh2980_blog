"use client";

import { RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { IncomingReferenceItem } from "@/cms/adapters/postgres/content-store";
import { COLLECTION_DEFINITIONS, isCollection } from "@/cms/core/collections";
import type { LayoutGroup } from "@/cms/schema/collection";
import { schemaOf } from "@/cms/schema/derive";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isLocale, LOCALE_INFO } from "@/libs/i18n/locales";
import type { CmsIssue } from "../api-error-message";
import { type EntryData, type EntryForm, type EntryFormPatch, formFromSourceMetadata } from "./entry-form";
import { SchemaFields } from "./schema-fields";

const REFERENCE_KIND_LABELS = { entry: "글", media: "미디어", category: "카테고리", tag: "태그" };

const localeName = (locale: string) => (isLocale(locale) ? LOCALE_INFO[locale].adminName : locale);

type InspectorTab = "fields" | "seo" | "references";

const isSeoGroup = (group: LayoutGroup) => group.group === "SEO";

/** 필드가 들어 있는 탭. 발행 문제로 이동할 때 그 탭을 먼저 연다. */
function tabOf(collection: string, path: string): InspectorTab {
	if (!isCollection(collection)) return "fields";
	const group = schemaOf(collection).layout?.find((candidate) => candidate.fields.includes(path));
	return group && isSeoGroup(group) ? "seo" : "fields";
}

interface InspectorPanelProps {
	collection: string;
	form: EntryForm;
	disabled: boolean;
	publishIssues?: CmsIssue[];
	entry: EntryData | null;
	incomingReferences: IncomingReferenceItem[];
	isLoadingIncomingReferences: boolean;
	incomingReferencesError: string | null;
	onRefreshIncomingReferences: () => void;
	onSlugChange: (slug: string) => void;
	onRegenerateSlug: () => void;
	onChange: (patch: EntryFormPatch) => void;
	onClose: () => void;
	/** 이 필드로 초점을 옮긴다(발행 문제로 이동). 옮기면 `onFocused`를 부른다. */
	focusPath?: string | null;
	onFocused?: () => void;
}

/**
 * 편집 화면 오른쪽 속성 칸. 속성·SEO·사용처를 탭으로 나누고, 안쪽 폭을 고정해 여닫거나 창 폭이 바뀌어도
 * 입력이 밀리거나 넘치지 않는다.
 */
export function InspectorPanel({
	collection,
	form,
	disabled,
	publishIssues = [],
	entry,
	incomingReferences,
	isLoadingIncomingReferences,
	incomingReferencesError,
	onRefreshIncomingReferences,
	onSlugChange,
	onRegenerateSlug,
	onChange,
	onClose,
	focusPath,
	onFocused,
}: InspectorPanelProps) {
	const [tab, setTab] = useState<InspectorTab>("fields");
	const workingReferences = incomingReferences.filter((reference) => reference.state === "working");
	const publishedReferences = incomingReferences.filter((reference) => reference.state === "published");
	const referenceCount = new Set(incomingReferences.map((reference) => reference.sourceId)).size;
	const hasSeo = isCollection(collection) && Boolean(schemaOf(collection).layout?.some(isSeoGroup));
	const seoIssues = publishIssues.filter((issue) => issue.path && tabOf(collection, issue.path) === "seo").length;

	useEffect(() => {
		if (focusPath) setTab(tabOf(collection, focusPath));
	}, [focusPath, collection]);
	// 탭이 바뀌어 입력이 그려진 뒤에 초점을 옮긴다.
	// biome-ignore lint/correctness/useExhaustiveDependencies: tab change re-runs the lookup
	useEffect(() => {
		if (!focusPath) return;
		const control = document.getElementById(`cms-${focusPath}`);
		if (control) {
			control.focus();
			onFocused?.();
		}
	}, [focusPath, tab]);

	const fields = (include: (group: LayoutGroup) => boolean) =>
		isCollection(collection) && (
			<fieldset disabled={disabled} className="min-w-0 space-y-4 disabled:opacity-70">
				<SchemaFields
					collection={collection}
					form={form}
					issues={publishIssues}
					context={{
						entryId: entry?.id,
						groupId: entry?.translationGroupId,
						disabled,
						incomingReferences: incomingReferences,
						incomingReferencesLoading: isLoadingIncomingReferences,
						refreshIncomingReferences: onRefreshIncomingReferences,
					}}
					omit={["title"]}
					showDescriptions={false}
					include={include}
					sections="plain"
					onChange={onChange}
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
			</fieldset>
		);

	return (
		<Tabs
			value={tab}
			onValueChange={(value) => setTab(value as InspectorTab)}
			aria-label="속성"
			className="h-full w-full gap-0 overflow-hidden border-l bg-background text-sm"
		>
			<div className="flex h-11 shrink-0 items-center gap-1 border-b pr-2 pl-3">
				<TabsList variant="line" className="h-full flex-1 justify-start gap-3">
					<TabsTrigger value="fields" className="flex-none px-0 text-xs">
						속성
					</TabsTrigger>
					{hasSeo && (
						<TabsTrigger value="seo" className="flex-none px-0 text-xs">
							SEO
							{seoIssues > 0 && <span aria-hidden className="size-1.5 rounded-full bg-destructive" />}
						</TabsTrigger>
					)}
					<TabsTrigger value="references" className="flex-none px-0 text-xs">
						사용처
						{referenceCount > 0 && (
							<span className="rounded bg-muted px-1 font-normal text-[10px] text-muted-foreground tabular-nums">
								{referenceCount}
							</span>
						)}
					</TabsTrigger>
				</TabsList>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button type="button" size="icon-sm" variant="ghost" aria-label="속성 닫기" onClick={onClose}>
								<X aria-hidden className="size-4" />
							</Button>
						}
					/>
					<TooltipContent side="bottom">속성 닫기</TooltipContent>
				</Tooltip>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
				<TabsContent value="fields">{fields((group) => !isSeoGroup(group))}</TabsContent>
				{hasSeo && <TabsContent value="seo">{fields(isSeoGroup)}</TabsContent>}
				<TabsContent value="references" className="space-y-3">
					<div className="flex items-center justify-between gap-2">
						<p className="text-muted-foreground text-xs">이 글을 쓰는 곳</p>
						<Tooltip>
							<TooltipTrigger
								render={
									<Button
										type="button"
										size="icon-xs"
										variant="ghost"
										aria-label="사용처 새로고침"
										disabled={!entry || isLoadingIncomingReferences}
										onClick={onRefreshIncomingReferences}
									>
										<RefreshCw aria-hidden className={isLoadingIncomingReferences ? "animate-spin" : undefined} />
									</Button>
								}
							/>
							<TooltipContent side="bottom">새로고침</TooltipContent>
						</Tooltip>
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
				</TabsContent>
			</div>
		</Tabs>
	);
}
