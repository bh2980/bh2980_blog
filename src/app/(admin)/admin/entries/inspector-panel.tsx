"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { IncomingReferenceItem } from "@/cms/adapters/postgres/content-store";
import { isCollection } from "@/cms/core/collections";
import type { LayoutGroup } from "@/cms/schema/collection";
import { schemaOf } from "@/cms/schema/derive";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isLocale, LOCALE_INFO } from "@/libs/i18n/locales";
import type { CmsIssue } from "../api-error-message";
import { type EntryData, type EntryForm, type EntryFormPatch, formFromSourceMetadata } from "./entry-form";
import { SchemaFields } from "./schema-fields";
import { SeoPanel } from "./seo-panel";

const localeName = (locale: string) => (isLocale(locale) ? LOCALE_INFO[locale].adminName : locale);

type InspectorTab = "fields" | "seo";

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
 * 편집 화면 오른쪽 속성 칸. 속성·SEO를 탭으로 나누고, 안쪽 폭을 고정해 여닫거나 창 폭이 바뀌어도
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
	onRefreshIncomingReferences,
	onSlugChange,
	onRegenerateSlug,
	onChange,
	onClose,
	focusPath,
	onFocused,
}: InspectorPanelProps) {
	const [tab, setTab] = useState<InspectorTab>("fields");
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
						locale: entry?.locale,
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
				{hasSeo && (
					<TabsContent value="seo">
						<SeoPanel
							collection={collection}
							form={form}
							entry={entry}
							disabled={disabled}
							issues={publishIssues}
							onChange={onChange}
						/>
					</TabsContent>
				)}
			</div>
		</Tabs>
	);
}
