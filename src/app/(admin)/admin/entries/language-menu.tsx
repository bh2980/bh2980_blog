"use client";

import { Check, Languages, Plus } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isLocale, LOCALE_INFO, LOCALES } from "@/libs/i18n/locales";
import { cmsFetch, errorText } from "../admin-api";
import { STATUS_LABELS } from "../shared/entry-status";
import type { EntryData } from "./entry-form";

const localeName = (locale: string) => (isLocale(locale) ? LOCALE_INFO[locale].adminName : locale);

/**
 * 편집 화면 머리글의 언어 메뉴(v2 B4). 같은 번역 묶음의 언어 사이를 오가고, 없는 언어는 번역본을 만든다.
 * 번역본은 원문의 언어별 값과 본문을 복사한 초안이다. 만들기 전에 지금 편집 중인 내용을 먼저 저장한다.
 */
export function LanguageMenu({
	entry,
	disabled,
	onBeforeCreate,
}: {
	entry: EntryData;
	disabled: boolean;
	/** 저장되지 않은 변경을 서버에 보낸다. 실패하면 번역본을 만들지 않는다. */
	onBeforeCreate: () => Promise<boolean>;
}) {
	const router = useRouter();
	const [creating, setCreating] = useState<string | null>(null);
	const members = entry.translations ?? [];
	const locale = entry.locale ?? "ko";
	const isTranslation = Boolean(entry.translationGroupId && entry.translationGroupId !== entry.id);

	const create = async (target: string) => {
		if (creating) return;
		setCreating(target);
		try {
			if (!(await onBeforeCreate())) {
				toast.error("저장하지 못해 번역본을 만들지 않았습니다.");
				return;
			}
			const created = await cmsFetch<{ id: string }>(`/api/cms/v1/entries/${entry.id}/translations`, {
				method: "POST",
				json: { locale: target },
				fallback: "번역본을 만들지 못했습니다.",
			});
			toast.success(`${localeName(target)} 번역본을 만들었습니다. 원문 내용을 복사한 초안입니다.`);
			router.push(`/admin/entries/${created.id}/edit` as Route);
		} catch (error) {
			toast.error(errorText(error, "번역본을 만들지 못했습니다."));
		} finally {
			setCreating(null);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="gap-1 text-muted-foreground"
						aria-label={`언어: ${localeName(locale)}${isTranslation ? " 번역본" : " 원문"} — 언어 전환·번역본 만들기`}
					/>
				}
			>
				<Languages aria-hidden className="size-3.5" />
				{locale.toUpperCase()}
				{isTranslation && <span className="text-xs">번역</span>}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-60">
				<DropdownMenuGroup>
					<DropdownMenuLabel>이 글의 언어</DropdownMenuLabel>
					{LOCALES.map((target) => {
						const member = members.find((item) => item.locale === target);
						if (!member) return null;
						const current = member.id === entry.id;
						return (
							<DropdownMenuItem
								key={target}
								disabled={current}
								onClick={() => router.push(`/admin/entries/${member.id}/edit` as Route)}
							>
								{current ? <Check aria-hidden /> : <span aria-hidden className="size-4" />}
								<span className="flex-1">
									{LOCALE_INFO[target].adminName}
									{member.isSource && <span className="ml-1 text-muted-foreground text-xs">원문</span>}
								</span>
								<span className="text-muted-foreground text-xs">{STATUS_LABELS[member.status]}</span>
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuGroup>
				{LOCALES.some((target) => !members.some((item) => item.locale === target)) && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuGroup>
							<DropdownMenuLabel>번역본 만들기</DropdownMenuLabel>
							{LOCALES.filter((target) => !members.some((item) => item.locale === target)).map((target) => (
								<DropdownMenuItem
									key={target}
									disabled={disabled || entry.status === "trashed" || creating !== null}
									onClick={() => void create(target)}
								>
									<Plus aria-hidden />
									{creating === target ? "만드는 중..." : `${LOCALE_INFO[target].adminName}로 번역`}
								</DropdownMenuItem>
							))}
						</DropdownMenuGroup>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
