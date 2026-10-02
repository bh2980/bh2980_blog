"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { cmsFetch } from "../admin-api";

type Template = { id: string; name: string; mdx: string };

/**
 * 편집기 툴바 끝의 템플릿 메뉴. 처음 열 때 목록을 받는다.
 * 본문이 비었으면 고른 템플릿을 바로 넣고, 쓴 본문이 있으면 바꿀지 먼저 묻는다.
 */
export function TemplateMenu({
	currentMdx,
	disabled,
	onApply,
}: {
	currentMdx: string;
	disabled: boolean;
	onApply: (mdx: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [templates, setTemplates] = useState<Template[] | null>(null);
	const [pendingMdx, setPendingMdx] = useState<string | null>(null);

	const openMenu = async (next: boolean) => {
		setOpen(next);
		if (!next || templates) return;
		try {
			const data = await cmsFetch<{ items: Template[] }>("/api/cms/v1/templates");
			setTemplates(data.items);
		} catch {
			setTemplates([]);
		}
	};

	const apply = (mdx: string) => {
		onApply(mdx);
		setOpen(false);
		setPendingMdx(null);
	};

	return (
		<>
			<DropdownMenu open={open} onOpenChange={(next) => void openMenu(next)}>
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							size="icon-sm"
							variant="ghost"
							aria-label="템플릿 메뉴"
							title="템플릿"
							disabled={disabled}
						/>
					}
				>
					<MoreHorizontal aria-hidden className="size-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
					<DropdownMenuGroup>
						<DropdownMenuLabel>템플릿</DropdownMenuLabel>
						{templates === null ? (
							<DropdownMenuItem disabled>불러오는 중...</DropdownMenuItem>
						) : templates.length === 0 ? (
							<DropdownMenuItem disabled>등록된 템플릿이 없습니다.</DropdownMenuItem>
						) : (
							templates.map((template) => (
								<DropdownMenuItem
									key={template.id}
									onClick={() => (currentMdx.trim() ? setPendingMdx(template.mdx) : apply(template.mdx))}
								>
									<span className="truncate">{template.name}</span>
								</DropdownMenuItem>
							))
						)}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => window.open("/admin/templates", "_blank", "noopener")}>
						템플릿 관리
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={pendingMdx !== null} onOpenChange={(next) => !next && setPendingMdx(null)}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>템플릿 적용</DialogTitle>
						<DialogDescription>현재 본문이 선택한 템플릿으로 바뀝니다.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setPendingMdx(null)}>
							취소
						</Button>
						<Button type="button" onClick={() => pendingMdx !== null && apply(pendingMdx)}>
							템플릿 적용
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
