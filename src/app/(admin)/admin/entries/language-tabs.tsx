"use client";

import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALE_INFO, LOCALES } from "@/libs/i18n/locales";
import { cn } from "@/utils/cn";
import { cmsFetch, errorText } from "../admin-api";
import { STATUS_LABELS } from "../shared/entry-status";
import { type EntryData, isTranslationEntry } from "./entry-form";

const STATUS_DOT: Record<string, string> = {
	published: "bg-emerald-500",
	draft: "bg-amber-500",
};

/**
 * 제목 위 언어 탭. 같은 번역 묶음의 언어 사이를 오가고, 없는 언어는 번역본을 만든다.
 * 번역본은 서버에 저장된 원문의 언어별 값과 본문을 복사한 초안이다.
 */
export function LanguageTabs({
	entry,
	disabled,
	onBeforeCreate,
	onTrashTranslation,
}: {
	entry: EntryData;
	disabled: boolean;
	/** 저장되지 않은 변경이 있으면 번역본 생성을 막는다. */
	onBeforeCreate: () => Promise<boolean>;
	onTrashTranslation: () => void;
}) {
	const router = useRouter();
	const [creating, setCreating] = useState<string | null>(null);
	const members = entry.translations ?? [];
	const isTranslation = isTranslationEntry(entry);
	const createDisabled = disabled || entry.status === "trashed" || creating !== null;

	const create = async (target: (typeof LOCALES)[number]) => {
		if (creating) return;
		setCreating(target);
		try {
			if (!(await onBeforeCreate())) {
				toast.error("변경사항을 먼저 저장한 후 번역본을 만드세요.");
				return;
			}
			const created = await cmsFetch<{ id: string }>(`/api/cms/v1/entries/${entry.id}/translations`, {
				method: "POST",
				json: { locale: target },
				fallback: "번역본을 만들지 못했습니다.",
			});
			toast.success(`${LOCALE_INFO[target].adminName} 번역본을 만들었습니다.`);
			router.push(`/admin/entries/${created.id}/edit` as Route);
		} catch (error) {
			toast.error(errorText(error, "번역본을 만들지 못했습니다."));
		} finally {
			setCreating(null);
		}
	};

	return (
		<nav aria-label="언어" className="flex flex-wrap items-center gap-1 px-4 pt-2">
			{LOCALES.map((target) => {
				const member = members.find((item) => item.locale === target);
				if (!member) {
					return (
						<Button
							key={target}
							type="button"
							size="sm"
							variant="ghost"
							disabled={createDisabled}
							aria-label={`${LOCALE_INFO[target].adminName} 번역본 만들기`}
							className="h-7 gap-1 border border-dashed px-2 text-muted-foreground text-xs"
							onClick={() => void create(target)}
						>
							<Plus aria-hidden className="size-3" />
							{target.toUpperCase()}
						</Button>
					);
				}
				const current = member.id === entry.id;
				return (
					<div key={target} className="flex items-center">
						<Button
							type="button"
							size="sm"
							variant="ghost"
							aria-current={current ? "page" : undefined}
							aria-label={`${LOCALE_INFO[target].adminName}${member.isSource ? " 원문" : ""} · ${STATUS_LABELS[member.status]}`}
							className={cn("h-7 gap-1.5 px-2 text-xs", current ? "bg-muted text-foreground" : "text-muted-foreground")}
							onClick={() => {
								if (!current) router.push(`/admin/entries/${member.id}/edit` as Route);
							}}
						>
							<span
								aria-hidden
								className={cn("size-1.5 rounded-full", STATUS_DOT[member.status] ?? "bg-muted-foreground/50")}
							/>
							<span aria-hidden className="font-medium">
								{target.toUpperCase()}
							</span>
							{member.isSource && (
								<span aria-hidden className="font-normal text-muted-foreground">
									원문
								</span>
							)}
						</Button>
						{current && isTranslation && entry.status !== "trashed" && (
							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<Button
											type="button"
											size="icon-sm"
											variant="ghost"
											aria-label="번역본 메뉴"
											className="size-7 text-muted-foreground"
										/>
									}
								>
									<MoreHorizontal aria-hidden className="size-3.5" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuItem variant="destructive" onClick={onTrashTranslation}>
										<Trash2 aria-hidden />
										휴지통으로 이동
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}
					</div>
				);
			})}
		</nav>
	);
}
