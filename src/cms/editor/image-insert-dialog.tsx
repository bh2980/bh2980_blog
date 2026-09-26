"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/utils/cn";
import { formatBytes, type PreparedUpload, prepareUpload, uploadImageFile } from "./upload-helper";

export interface ImageInsertion {
	mediaId: string;
	alt: string;
	decorative: boolean;
	caption: string;
}

interface LibraryItem {
	id: string;
	filename: string;
	publicUrl: string | null;
	width: number | null;
	height: number | null;
	defaultAlt: string;
	defaultCaption: string;
}

interface ImageInsertDialogProps {
	open: boolean;
	/** 붙여넣기·끌어놓기로 들어온 파일. 있으면 업로드 탭으로 연다. */
	initialFile: File | null;
	onClose: () => void;
	onInsert: (image: ImageInsertion) => void;
}

/**
 * 이미지 삽입(§7.1). 새 파일 업로드(원본 유지 기본, 웹용 최적화 선택) 또는 라이브러리 재사용.
 * 라이브러리의 기본 alt·caption은 삽입할 때 복사한다(§7.3). 설명이 필요한 이미지는 alt가 있어야 한다.
 */
export function ImageInsertDialog({ open, initialFile, onClose, onInsert }: ImageInsertDialogProps) {
	const altId = useId();
	const captionId = useId();
	const searchId = useId();
	const [tab, setTab] = useState<"upload" | "library">("upload");
	const [file, setFile] = useState<File | null>(null);
	const [optimize, setOptimize] = useState(false);
	const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
	const [picked, setPicked] = useState<LibraryItem | null>(null);
	const [alt, setAlt] = useState("");
	const [caption, setCaption] = useState("");
	const [decorative, setDecorative] = useState(false);
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [library, setLibrary] = useState<LibraryItem[]>([]);
	const [isLibraryLoading, setIsLibraryLoading] = useState(false);

	useEffect(() => {
		if (!open) return;
		setTab(initialFile ? "upload" : "upload");
		setFile(initialFile);
		setOptimize(false);
		setPrepared(null);
		setPicked(null);
		setAlt("");
		setCaption("");
		setDecorative(false);
		setProgress(null);
		setError(null);
	}, [open, initialFile]);

	useEffect(() => {
		let cancelled = false;
		if (!file) {
			setPrepared(null);
			return;
		}
		prepareUpload(file, { optimize }).then((result) => {
			if (!cancelled) setPrepared(result);
		});
		return () => {
			cancelled = true;
		};
	}, [file, optimize]);

	useEffect(() => {
		if (!open || tab !== "library") return;
		let cancelled = false;
		setIsLibraryLoading(true);
		const timer = setTimeout(() => {
			const params = new URLSearchParams({ pageSize: "24" });
			if (search.trim()) params.set("search", search.trim());
			fetch(`/api/cms/v1/media?${params.toString()}`)
				.then((res) => (res.ok ? res.json() : { items: [] }))
				.then((data: { items?: (LibraryItem & { status?: string })[] }) => {
					if (!cancelled) setLibrary((data.items ?? []).filter((item) => item.status !== "deleting"));
				})
				.catch(() => {
					if (!cancelled) setLibrary([]);
				})
				.finally(() => {
					if (!cancelled) setIsLibraryLoading(false);
				});
		}, 250);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [open, tab, search]);

	const isUploading = progress !== null;
	const needsAlt = !decorative && !alt.trim();
	const canInsert = !isUploading && !needsAlt && (tab === "upload" ? Boolean(prepared) : Boolean(picked));

	const pick = (item: LibraryItem) => {
		setPicked(item);
		setAlt(item.defaultAlt);
		setCaption(item.defaultCaption);
		setDecorative(false);
	};

	const confirm = async () => {
		if (!canInsert) return;
		setError(null);
		if (tab === "library" && picked) {
			onInsert({ mediaId: picked.id, alt: decorative ? "" : alt.trim(), decorative, caption: caption.trim() });
			return;
		}
		if (!prepared) return;
		setProgress(0);
		try {
			const uploaded = await uploadImageFile(prepared, setProgress);
			onInsert({ mediaId: uploaded.mediaId, alt: decorative ? "" : alt.trim(), decorative, caption: caption.trim() });
		} catch (err) {
			setError(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
		} finally {
			setProgress(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(next) => !next && !isUploading && onClose()}>
			<DialogContent className="max-w-lg" showCloseButton={!isUploading}>
				<DialogHeader>
					<DialogTitle>이미지 삽입</DialogTitle>
					<DialogDescription>새 파일을 올리거나 미디어 라이브러리에서 고르세요.</DialogDescription>
				</DialogHeader>

				<Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
					<TabsList variant="line" aria-label="이미지 출처">
						<TabsTrigger value="upload" disabled={isUploading}>
							업로드
						</TabsTrigger>
						<TabsTrigger value="library" disabled={isUploading}>
							라이브러리
						</TabsTrigger>
					</TabsList>
				</Tabs>

				{tab === "upload" ? (
					<div className="space-y-2 text-sm">
						<Input
							type="file"
							aria-label="이미지 파일"
							accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
							disabled={isUploading}
							onChange={(event) => setFile(event.target.files?.[0] ?? null)}
						/>
						{file && (
							<>
								<Label className="font-normal">
									<Checkbox
										checked={optimize}
										disabled={isUploading}
										onCheckedChange={(checked) => setOptimize(checked === true)}
									/>
									웹용 최적화 (긴 변 2560px 이하 WebP, 원본도 보관)
								</Label>
								<p className="text-muted-foreground text-xs" aria-live="polite">
									{prepared?.optimized
										? `${formatBytes(file.size)} → ${formatBytes(prepared.file.size)} (${prepared.width}×${prepared.height})`
										: `원본 유지 · ${formatBytes(file.size)}${prepared?.skippedReason ? ` · ${prepared.skippedReason}` : ""}`}
								</p>
							</>
						)}
					</div>
				) : (
					<div className="space-y-2">
						<Label htmlFor={searchId} className="sr-only">
							파일명 검색
						</Label>
						<Input
							id={searchId}
							value={search}
							placeholder="파일명 검색"
							onChange={(event) => setSearch(event.target.value)}
						/>
						<div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto" aria-busy={isLibraryLoading}>
							{library.length === 0 && !isLibraryLoading && (
								<p className="col-span-3 py-6 text-center text-muted-foreground text-sm">미디어가 없습니다.</p>
							)}
							{library.map((item) => (
								<Button
									key={item.id}
									type="button"
									variant="outline"
									aria-pressed={picked?.id === item.id}
									onClick={() => pick(item)}
									className={cn(
										"h-auto flex-col items-stretch gap-0 overflow-hidden p-0 text-left font-normal text-xs",
										picked?.id === item.id && "ring-2 ring-primary",
									)}
								>
									{item.publicUrl ? (
										// biome-ignore lint/performance/noImgElement: CMS media URLs are dynamic
										<img src={item.publicUrl} alt="" className="h-20 w-full object-cover" />
									) : (
										<span className="flex h-20 items-center justify-center bg-muted">미리보기 없음</span>
									)}
									<span className="block truncate px-1 py-0.5">{item.filename}</span>
								</Button>
							))}
						</div>
					</div>
				)}

				<div className="space-y-2 text-sm">
					<Label htmlFor={altId}>대체 텍스트</Label>
					<Input
						id={altId}
						value={alt}
						disabled={decorative || isUploading}
						aria-required={!decorative}
						aria-invalid={needsAlt || undefined}
						onChange={(event) => setAlt(event.target.value)}
					/>
					<Label className="font-normal">
						<Checkbox
							checked={decorative}
							disabled={isUploading}
							onCheckedChange={(checked) => setDecorative(checked === true)}
						/>
						장식 이미지 (스크린 리더에서 생략)
					</Label>
					<Label htmlFor={captionId}>캡션 (선택)</Label>
					<Input
						id={captionId}
						value={caption}
						disabled={isUploading}
						onChange={(event) => setCaption(event.target.value)}
					/>
				</div>

				{isUploading && (
					<output className="flex items-center gap-2 text-sm">
						<Spinner /> 업로드 중… {progress}%
					</output>
				)}
				{error && (
					<p role="alert" className="text-destructive text-sm">
						{error} 다시 시도하거나 취소할 수 있습니다.
					</p>
				)}

				<DialogFooter>
					<Button type="button" variant="outline" disabled={isUploading} onClick={onClose}>
						취소
					</Button>
					<Button type="button" disabled={!canInsert} onClick={() => void confirm()}>
						{tab === "upload" ? (error ? "다시 업로드" : "업로드 및 삽입") : "삽입"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
