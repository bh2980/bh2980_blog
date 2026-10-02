"use client";

import { cmsFetch, errorText } from "@bh2980/cms-admin/api";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Label } from "@bh2980/cms-admin/ui/label";
import { Skeleton } from "@bh2980/cms-admin/ui/skeleton";
import { Textarea } from "@bh2980/cms-admin/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AiSharedView } from "../shared";

export const AI_SHARED_KEY = ["cms", "ai", "shared"] as const;

/**
 * 공통 문구 편집(M8-4). 여러 기능의 지시문에 `{{shared.이름}}`으로 들어가는 문구(예: 문체 가이드)를 고친다.
 * 고친 문구는 저장한 뒤 실행하는 모든 기능에 바로 쓰인다.
 */
export function SharedTextsEditor() {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: AI_SHARED_KEY,
		queryFn: () => cmsFetch<AiSharedView>("/api/cms/v1/ai/shared"),
	});
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	useEffect(() => {
		if (query.data) setDrafts(Object.fromEntries(query.data.items.map((item) => [item.key, item.text])));
	}, [query.data]);

	if (query.isLoading) return <Skeleton className="m-4 h-40" />;
	if (!query.data) {
		return <p className="m-4 text-destructive text-xs">{errorText(query.error, "공통 문구를 불러올 수 없습니다.")}</p>;
	}
	const view = query.data;
	const changed = view.items.some((item) => drafts[item.key] !== item.text);

	const save = async (texts: Record<string, string>) => {
		setSaving(true);
		try {
			const saved = await cmsFetch<AiSharedView>("/api/cms/v1/ai/shared", {
				method: "PUT",
				json: { expectedVersion: view.version, texts },
				fallback: "저장하지 못했습니다.",
			});
			queryClient.setQueryData(AI_SHARED_KEY, saved);
			toast.success("공통 문구를 저장했습니다.");
		} catch (error) {
			toast.error(errorText(error, "저장하지 못했습니다."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
			{view.items.map((item) => (
				<div key={item.key} className="max-w-2xl space-y-1.5">
					<div className="flex items-center justify-between gap-2">
						<Label htmlFor={`shared-${item.key}`} className="text-xs">
							{item.label}
							<code className="font-normal text-muted-foreground">{`{{shared.${item.key}}}`}</code>
						</Label>
						{(item.overridden || drafts[item.key] !== item.defaultText) && (
							<Button
								type="button"
								variant="ghost"
								size="xs"
								onClick={() => setDrafts((current) => ({ ...current, [item.key]: item.defaultText }))}
							>
								<RotateCcw aria-hidden />
								기본값
							</Button>
						)}
					</div>
					<Textarea
						id={`shared-${item.key}`}
						rows={6}
						value={drafts[item.key] ?? ""}
						onChange={(event) => setDrafts((current) => ({ ...current, [item.key]: event.target.value }))}
						className="text-xs md:text-xs"
					/>
				</div>
			))}
			<Button type="button" size="sm" disabled={!changed || saving} onClick={() => void save(drafts)}>
				<Save aria-hidden />
				{saving ? "저장 중..." : "저장"}
			</Button>
		</div>
	);
}
