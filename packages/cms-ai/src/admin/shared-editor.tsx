"use client";

import { cmsFetch, errorText } from "@bh2980/cms-admin/api";
import { Button } from "@bh2980/cms-admin/ui/button";
import { Field, FieldGroup, FieldLabel } from "@bh2980/cms-admin/ui/field";
import { Skeleton } from "@bh2980/cms-admin/ui/skeleton";
import { Textarea } from "@bh2980/cms-admin/ui/textarea";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { AiSharedView } from "../shared";
import { DETAIL_PANE, InlineError, LoadError } from "./connection-editor";

export const AI_SHARED_KEY = ["cms", "ai", "shared"] as const;

/** 지시문·공통 문구 입력 칸의 모양(둘 다 지시에 들어가는 글이다). */
export const PROMPT_ROWS = 8;
export const PROMPT_TEXTAREA = "text-xs md:text-xs";

/**
 * 공통 문구 편집(M8-4). 여러 기능의 지시문에 `{{shared.이름}}`으로 들어가는 문구(예: 문체 가이드)를 고친다.
 * 고친 문구는 저장한 뒤 실행하는 모든 기능에 바로 쓰인다. `기본값으로`는 입력 칸만 되돌린다(저장은 따로).
 */
export function SharedTextsEditor({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
	const queryClient = useQueryClient();
	const query = useQuery({
		queryKey: AI_SHARED_KEY,
		queryFn: ({ signal }) =>
			cmsFetch<AiSharedView>("/api/cms/v1/ai/shared", { signal, fallback: "공통 문구를 불러올 수 없습니다." }),
	});
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		if (query.data) setDrafts(Object.fromEntries(query.data.items.map((item) => [item.key, item.text])));
	}, [query.data]);
	const view = query.data;
	const changed = Boolean(view?.items.some((item) => (drafts[item.key] ?? item.text) !== item.text));
	useEffect(() => onDirtyChange(changed), [changed, onDirtyChange]);
	useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

	if (query.isPending) {
		return (
			<div className={DETAIL_PANE}>
				<Skeleton className="h-40" />
			</div>
		);
	}
	if (!view) {
		return (
			<LoadError
				message={errorText(query.error, "공통 문구를 불러올 수 없습니다.")}
				onRetry={() => void query.refetch()}
			/>
		);
	}

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			const saved = await cmsFetch<AiSharedView>("/api/cms/v1/ai/shared", {
				method: "PUT",
				json: { expectedVersion: view.version, texts: drafts },
				fallback: "저장하지 못했습니다.",
			});
			queryClient.setQueryData(AI_SHARED_KEY, saved);
			toast.success("저장했습니다.");
		} catch (saveError) {
			setError(errorText(saveError, "저장하지 못했습니다."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className={DETAIL_PANE}>
				<FieldGroup className="gap-5">
					{view.items.map((item) => (
						<Field key={item.key}>
							<div className="flex items-center justify-between gap-2">
								<FieldLabel htmlFor={`shared-${item.key}`}>
									{item.label}
									<code className="font-normal text-muted-foreground text-xs">{`{{shared.${item.key}}}`}</code>
								</FieldLabel>
								{drafts[item.key] !== item.defaultText && (
									<Button
										type="button"
										variant="ghost"
										size="xs"
										onClick={() => setDrafts((current) => ({ ...current, [item.key]: item.defaultText }))}
									>
										<RotateCcw aria-hidden />
										기본값으로
									</Button>
								)}
							</div>
							<Textarea
								id={`shared-${item.key}`}
								rows={PROMPT_ROWS}
								value={drafts[item.key] ?? ""}
								onChange={(event) => setDrafts((current) => ({ ...current, [item.key]: event.target.value }))}
								className={PROMPT_TEXTAREA}
							/>
						</Field>
					))}
				</FieldGroup>
				{error && <InlineError>{error}</InlineError>}
				<div className="flex items-center gap-2">
					<Button type="button" size="sm" disabled={!changed || saving} onClick={() => void save()}>
						<Save aria-hidden />
						{saving ? "저장 중…" : "저장"}
					</Button>
				</div>
			</div>
		</div>
	);
}
