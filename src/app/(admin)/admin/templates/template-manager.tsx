"use client";

import { LayoutTemplate, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { BodyTemplate } from "@/cms/adapters/postgres/content-store";
import { CmsEditor } from "@/cms/editor/tiptap-editor";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/utils/cn";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "../shared/action-menu";
import { AdminShell } from "../shared/admin-shell";
import { ConfirmDialog, type ConfirmRequest } from "../shared/confirm-dialog";

export function TemplateManager() {
	const [templates, setTemplates] = useState<BodyTemplate[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Editor state for selected/new template
	const [activeTemplate, setActiveTemplate] = useState<Partial<BodyTemplate> | null>(null);
	const [editName, setEditName] = useState("");
	const [editMdx, setEditMdx] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

	const fetchTemplates = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/cms/v1/templates");
			if (!res.ok) throw new Error("템플릿 목록을 불러올 수 없습니다.");
			const data = await res.json();
			setTemplates(data.items || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "불러오기 실패");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTemplates();
	}, [fetchTemplates]);

	const handleSelectTemplate = (t: BodyTemplate) => {
		setActiveTemplate(t);
		setEditName(t.name);
		setEditMdx(t.mdx);
		setSaveError(null);
	};

	const handleOpenNew = () => {
		setActiveTemplate({
			name: "",
			mdx: "## 서론\n\n내용을 입력하세요.\n\n## 본론\n\n- 항목 1\n- 항목 2\n\n## 결론\n\n마무리 요약.",
		});
		setEditName("");
		setEditMdx("## 서론\n\n내용을 입력하세요.\n\n## 본론\n\n- 항목 1\n- 항목 2\n\n## 결론\n\n마무리 요약.");
		setSaveError(null);
	};

	const handleCloseEditor = () => {
		setActiveTemplate(null);
		setSaveError(null);
	};

	const handleSave = async () => {
		if (!editName.trim()) {
			setSaveError("템플릿 이름을 입력해주세요.");
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			if (activeTemplate?.id) {
				// PATCH update
				const res = await fetch(`/api/cms/v1/templates/${activeTemplate.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: editName.trim(),
						mdx: editMdx,
						expectedVersion: activeTemplate.version,
					}),
				});
				if (!res.ok) {
					const errData = await res.json().catch(() => ({}));
					throw new Error(errData.message || "수정 저장에 실패했습니다.");
				}
				const updated = await res.json();
				setActiveTemplate(updated);
			} else {
				// POST create
				const res = await fetch("/api/cms/v1/templates", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: editName.trim(),
						mdx: editMdx,
					}),
				});
				if (!res.ok) {
					const errData = await res.json().catch(() => ({}));
					throw new Error(errData.message || "생성에 실패했습니다.");
				}
				const created = await res.json();
				setActiveTemplate(created);
			}
			await fetchTemplates();
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "오류가 발생했습니다.");
		} finally {
			setIsSaving(false);
		}
	};

	const deleteTemplate = async (template: BodyTemplate) => {
		try {
			const res = await fetch(`/api/cms/v1/templates/${template.id}?expectedVersion=${template.version}`, {
				method: "DELETE",
			});
			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				toast.error(errData.message || "삭제에 실패했습니다.");
				return;
			}
			if (activeTemplate?.id === template.id) setActiveTemplate(null);
			toast.success(`'${template.name}' 템플릿을 삭제했습니다.`);
			await fetchTemplates();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.");
		}
	};

	const requestDelete = (template: BodyTemplate) =>
		setConfirm({
			title: "템플릿 삭제",
			description: `'${template.name}' 템플릿을 삭제하시겠습니까? 이 템플릿으로 작성된 글에는 영향이 없습니다.`,
			confirmLabel: "삭제",
			destructive: true,
			onConfirm: () => deleteTemplate(template),
		});

	/** 템플릿 목록 줄의 오른쪽 클릭·`⋯` 메뉴(v2 A2). */
	const templateMenu = (template: BodyTemplate): MenuAction[] => [
		{ kind: "item", label: "열기", onSelect: () => handleSelectTemplate(template) },
		{ kind: "separator" },
		{ kind: "item", label: "삭제", shortcut: "Del", destructive: true, onSelect: () => requestDelete(template) },
	];

	return (
		<AdminShell
			title={
				<span className="flex items-center gap-2">
					본문 템플릿 <Badge variant="secondary">총 {templates.length}개</Badge>
				</span>
			}
			sidebar={{ activeNav: "templates" }}
			headerActions={
				<Button type="button" size="sm" onClick={handleOpenNew}>
					<Plus aria-hidden />새 템플릿 만들기
				</Button>
			}
		>
			{error && (
				<Alert variant="danger" className="m-3 w-auto">
					<AlertDescription className="col-start-auto">{error}</AlertDescription>
				</Alert>
			)}
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<div className="flex w-80 shrink-0 flex-col border-r">
					<ul className="flex-1 divide-y overflow-y-auto" aria-label="템플릿 목록">
						{isLoading ? (
							Array.from({ length: 3 }, (_, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
								<li key={index} className="p-4" aria-hidden>
									<Skeleton className="h-10 w-full" />
								</li>
							))
						) : templates.length === 0 ? (
							<li className="p-8 text-center text-muted-foreground text-xs">등록된 템플릿이 없습니다.</li>
						) : (
							templates.map((t) => {
								const isSelected = activeTemplate?.id === t.id;
								return (
									<ActionContextMenu
										key={t.id}
										actions={templateMenu(t)}
										trigger={
											<li
												className={cn(
													"group flex items-center justify-between gap-2 px-3 py-2 transition-colors",
													isSelected ? "bg-accent" : "hover:bg-accent/50",
												)}
											/>
										}
									>
										<Button
											variant="ghost"
											type="button"
											aria-current={isSelected ? "true" : undefined}
											onClick={() => handleSelectTemplate(t)}
											onKeyDown={(event) => {
												if (event.key === "Delete") {
													event.preventDefault();
													requestDelete(t);
												}
											}}
											className="h-auto min-w-0 flex-1 flex-col items-start gap-1.5 px-1 py-1 text-left font-normal hover:bg-transparent"
										>
											<span className="truncate font-medium text-sm">{t.name}</span>
											<span className="flex items-center gap-2 text-muted-foreground text-xs">
												<span className="text-[11px]">{new Date(t.updatedAt).toLocaleDateString("ko-KR")}</span>
											</span>
										</Button>
										<MoreActionsButton actions={templateMenu(t)} label={`'${t.name}' 템플릿 작업`} />
									</ActionContextMenu>
								);
							})
						)}
					</ul>
				</div>

				<div className="flex flex-1 flex-col overflow-hidden">
					{activeTemplate ? (
						<div className="flex h-full flex-1 flex-col overflow-hidden">
							<div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
								<div className="flex max-w-2xl flex-1 items-center gap-3">
									<Input
										type="text"
										aria-label="템플릿 이름"
										value={editName}
										onChange={(e) => setEditName(e.target.value)}
										placeholder="템플릿 이름 (예: 알고리즘 풀이)"
										className="h-8 min-w-0 flex-1"
									/>
									<span className="hidden text-muted-foreground text-xs sm:inline">본문 MDX 골격</span>
								</div>
								<div className="flex items-center gap-2">
									<Button type="button" variant="ghost" size="sm" onClick={handleCloseEditor}>
										닫기
									</Button>
									<Button type="button" size="sm" disabled={isSaving} onClick={handleSave}>
										<Save aria-hidden />
										{isSaving ? "저장 중..." : activeTemplate.id ? "수정 완료" : "생성하기"}
									</Button>
								</div>
							</div>
							{saveError && (
								<p role="alert" className="border-b bg-destructive/10 px-6 py-2 text-destructive text-xs">
									{saveError}
								</p>
							)}
							<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
								<CmsEditor content={editMdx} onChange={(next) => setEditMdx(next)} />
							</div>
						</div>
					) : (
						<Empty className="flex-1">
							<EmptyHeader>
								<EmptyMedia variant="icon">
									<LayoutTemplate aria-hidden />
								</EmptyMedia>
								<EmptyTitle>본문 템플릿을 선택하거나 새로 만드세요</EmptyTitle>
								<EmptyDescription>
									왼쪽 목록에서 기존 템플릿을 골라 수정하거나, 새 템플릿을 만들어 글을 쓸 때 빠르게 적용할 수 있습니다.
								</EmptyDescription>
							</EmptyHeader>
							<EmptyContent>
								<Button type="button" onClick={handleOpenNew}>
									<Plus aria-hidden />새 템플릿 만들기
								</Button>
							</EmptyContent>
						</Empty>
					)}
				</div>
			</div>
			<ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
		</AdminShell>
	);
}
