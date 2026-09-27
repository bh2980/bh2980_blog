"use client";

import { useEffect, useState } from "react";
import { COLLECTION_DEFINITIONS, type Collection } from "@/cms/core/collections";
import { slugify } from "@/cms/core/slug";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { CmsApiError, cmsFetch, errorText } from "./admin-api";
import { cmsIssueMessage } from "./api-error-message";
import {
	EMPTY_FORM,
	type EntryData,
	type EntryForm,
	type EntryFormPatch,
	formFromEntry,
	metadataFromForm,
} from "./entries/entry-form";
import { SchemaFields } from "./entries/schema-fields";

export type RecordTarget = { collection: Collection; id: string | null };

/**
 * record 컬렉션 폼(§5.2). `저장`이 검증 후 곧바로 공개 값에 반영된다. 자동 저장은 하지 않는다.
 * 입력은 컬렉션 정의(v2 B1)에서 그린다. 모음집은 설명과 게시글 순서를 편집한다.
 * 아직 공개되지 않은 글도 담을 수 있고 공개 목록에서만 빠진다(§6.4).
 */
export function RecordDialog({
	target,
	onClose,
	onSaved,
}: {
	target: RecordTarget | null;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [loaded, setLoaded] = useState<EntryData | null>(null);
	const [form, setFormState] = useState<EntryForm>(EMPTY_FORM);
	const [error, setError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isDirty, setIsDirty] = useState(false);
	const [confirmDiscard, setConfirmDiscard] = useState(false);

	const collection = target?.collection ?? "tag";
	const label = COLLECTION_DEFINITIONS[collection].label;
	const title = form.title;

	useEffect(() => {
		setLoaded(null);
		setFormState(EMPTY_FORM);
		setError(null);
		setIsDirty(false);
		setConfirmDiscard(false);
		if (!target?.id) return;
		let cancelled = false;
		cmsFetch<EntryData>(`/api/cms/v1/entries/${target.id}`)
			.then((entry) => {
				if (cancelled) return;
				setLoaded(entry);
				setFormState(formFromEntry(entry));
			})
			.catch((err) => {
				if (!cancelled) setError(errorText(err, `${label}을(를) 불러오지 못했습니다.`));
			});
		return () => {
			cancelled = true;
		};
	}, [target, label]);

	const setForm = (patch: EntryFormPatch) => {
		setFormState((current) => ({ ...current, ...patch }) as EntryForm);
		setIsDirty(true);
	};

	const close = () => {
		// 명시적 저장 폼은 변경 중 닫을 때 안내한다(§5.2).
		if (isDirty && !confirmDiscard) {
			setConfirmDiscard(true);
			return;
		}
		onClose();
	};

	const save = async () => {
		if (!target || !title.trim()) return;
		const built = metadataFromForm({ ...form, title: title.trim() }, collection, loaded?.working.metadata ?? {});
		if ("error" in built) {
			setError(built.error);
			return;
		}
		const { metadata } = built;
		setIsSaving(true);
		setError(null);
		const slug = form.slug;
		try {
			if (target.id && loaded) {
				await cmsFetch(`/api/cms/v1/entries/${target.id}`, {
					method: "PATCH",
					json: { expectedVersion: loaded.version, slug: slug.trim() || slugify(title), metadata },
					fallback: "저장하지 못했습니다.",
				});
			} else {
				await cmsFetch("/api/cms/v1/entries", {
					method: "POST",
					json: { collection, slug: slug.trim() || null, metadata, mdx: "" },
					fallback: "만들지 못했습니다.",
				});
			}
			setIsDirty(false);
			onSaved();
		} catch (err) {
			setError(
				err instanceof CmsApiError && err.issues.length > 0
					? err.issues.map(cmsIssueMessage).join("\n")
					: errorText(err, "저장하지 못했습니다."),
			);
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
			<DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{target?.id ? `${label} 편집` : `새 ${label}`}</DialogTitle>
					<DialogDescription>저장하면 검증 후 공개 분류 정보에 바로 반영됩니다.</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-3 text-sm"
					onSubmit={(event) => {
						event.preventDefault();
						void save();
					}}
				>
					<SchemaFields
						collection={collection}
						form={form}
						context={{ entryId: target?.id ?? undefined, disabled: isSaving }}
						onChange={setForm}
						slugPlaceholder={slugify(title) || "비우면 이름에서 만듭니다"}
					/>
					{target?.id && (
						<p className="text-muted-foreground text-xs">주소를 바꾸면 이전 주소는 새 주소로 연결됩니다.</p>
					)}
					{confirmDiscard && (
						<p role="alert" className="text-amber-700 dark:text-amber-400">
							저장하지 않은 변경이 있습니다. 한 번 더 닫으면 변경을 버립니다.
						</p>
					)}
					{error && (
						<p role="alert" className="whitespace-pre-wrap text-destructive">
							{error}
						</p>
					)}
					<DialogFooter>
						<Button type="button" variant="outline" onClick={close}>
							{confirmDiscard ? "변경 버리고 닫기" : "취소"}
						</Button>
						<Button type="submit" disabled={!title.trim() || isSaving || Boolean(target?.id && !loaded)}>
							{target?.id ? "저장" : "만들기"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
