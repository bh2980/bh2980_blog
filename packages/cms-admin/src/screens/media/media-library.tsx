"use client";

import {
	ALLOWED_IMAGE_MIME_TYPES,
	FILE_ACCEPT,
	fileTypeFor,
	isImageMime,
	parseDateTimeInput,
} from "@bh2980/cms/client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, LayoutGrid, Link2, List, PanelRightOpen, RefreshCw, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { prepareUpload, uploadAttachment, uploadImageFile } from "../../editor/upload-helper";
import { cn } from "../../lib/utils/cn";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "../../ui/empty";
import { IconButton } from "../../ui/icon-button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Skeleton } from "../../ui/skeleton";
import { Switch } from "../../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { cmsFetch, errorText } from "../admin-api";
import type { MenuAction } from "../shared/action-menu";
import { AdminShell } from "../shared/admin-shell";
import { useConfirm } from "../shared/confirm-dialog";
import { DateRangePicker } from "../shared/date-range-picker";
import { entryHref } from "../shared/entry-href";
import { SIDE_PANEL_DOCK } from "../shared/side-panel";
import { useDebounced } from "../shared/use-debounced";
import { MediaDetailPanel } from "./media-detail-panel";
import type { MediaItem } from "./media-item";
import { MediaGrid, MediaTable } from "./media-views";

const PAGE_SIZE = 30;
const KIND_OPTIONS = [
	{ value: "all", label: "모든 형식" },
	{ value: "image", label: "이미지" },
	{ value: "file", label: "파일" },
];

const UPLOAD_ACCEPT = `${ALLOWED_IMAGE_MIME_TYPES.join(",")},${FILE_ACCEPT}`;

const MEDIA_KEY = ["cms", "media"] as const;

interface MediaPage {
	items: MediaItem[];
	total: number;
}

const isImageFile = (file: File) => isImageMime(file.type);

const USED_OPTIONS = [
	{ value: "all", label: "사용 여부 전체" },
	{ value: "used", label: "사용 중" },
	{ value: "unused", label: "미사용" },
];

type MediaView = "grid" | "list";
const VIEW_STORAGE_KEY = "cms:media-view";

/** 바둑판·목록 보기 선택. 이 브라우저에 기억하고, 저장소를 못 쓰면 바둑판으로 시작한다. */
function useMediaView(): [MediaView, (view: MediaView) => void] {
	const [view, setView] = useState<MediaView>("grid");
	useEffect(() => {
		try {
			if (window.localStorage.getItem(VIEW_STORAGE_KEY) === "list") setView("list");
		} catch {
			// 저장소를 쓸 수 없으면 기본 보기를 쓴다.
		}
	}, []);
	const change = (next: MediaView) => {
		setView(next);
		try {
			window.localStorage.setItem(VIEW_STORAGE_KEY, next);
		} catch {
			// 기억하지 못해도 보기는 바뀐다.
		}
	};
	return [view, change];
}

/**
 * 미디어 라이브러리(§7.3). 바둑판·목록 보기, 파일명 검색, 형식·업로드일·사용 여부 필터, 최신 업로드순.
 * 고르면 오른쪽에 상세가 열린다.
 */
export function MediaLibrary() {
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [used, setUsed] = useState<"all" | "used" | "unused">("all");
	const [kind, setKind] = useState<"all" | "image" | "file">("all");
	const [uploadedFrom, setUploadedFrom] = useState("");
	const [uploadedTo, setUploadedTo] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	/** 상세 칸의 기본 설명에 저장하지 않은 변경이 있는가. 상세 칸이 알려 준다. */
	const detailDirtyRef = useRef(false);
	const [optimize, setOptimize] = useState(false);
	const [upload, setUpload] = useState<{ current: number; total: number; percent: number } | null>(null);
	const { confirm, confirmDiscard, dialog } = useConfirm();
	const [view, setView] = useMediaView();
	const fileInputRef = useRef<HTMLInputElement>(null);

	// 조건을 바꾸는 동안에도 이전 줄을 남겨(`keepPreviousData`) 자리 표시로 깜빡이지 않는다. 자리 표시는 캐시가 없을 때만 보인다.
	const query = useMemo(() => {
		const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), used });
		if (search.trim()) params.set("search", search.trim());
		if (kind !== "all") params.set("kind", kind);
		const from = uploadedFrom && parseDateTimeInput(`${uploadedFrom}T00:00`);
		const to = uploadedTo && parseDateTimeInput(`${uploadedTo}T23:59`);
		if (from) params.set("uploadedFrom", from);
		if (to) params.set("uploadedTo", new Date(Date.parse(to) + 59_999).toISOString());
		return params.toString();
	}, [page, used, search, kind, uploadedFrom, uploadedTo]);
	const debouncedQuery = useDebounced(query, 200);
	const mediaQuery = useQuery({
		queryKey: [...MEDIA_KEY, debouncedQuery],
		queryFn: ({ signal }) => cmsFetch<MediaPage>(`/api/cms/v1/media?${debouncedQuery}`, { signal }),
		placeholderData: keepPreviousData,
	});
	const items = mediaQuery.data?.items ?? [];
	const total = mediaQuery.data?.total ?? 0;
	const selected = items.find((item) => item.id === selectedId) ?? null;

	const loadError = mediaQuery.error ? errorText(mediaQuery.error, "미디어를 불러오지 못했습니다.") : null;

	/** 상세 칸에 연다(닫으려면 null). 저장하지 않은 기본 설명이 있으면 버릴지 먼저 묻는다. */
	const openDetail = async (id: string | null) => {
		if (id === selectedId) return;
		if (!(await confirmDiscard(detailDirtyRef.current))) return;
		detailDirtyRef.current = false;
		setSelectedId(id);
	};

	/** 목록을 뒤에서 다시 받는다. 지금 보이는 줄은 그대로 둔다. */
	const invalidateMedia = () => queryClient.invalidateQueries({ queryKey: MEDIA_KEY });

	const handleFiles = async (files: FileList | null) => {
		if (!files?.length) return;
		const list: File[] = [];
		for (const file of Array.from(files)) {
			if (isImageFile(file) || fileTypeFor(file.name)) list.push(file);
			else toast.error(`'${file.name}'은(는) 올릴 수 없는 형식입니다.`);
		}
		if (list.length === 0) {
			if (fileInputRef.current) fileInputRef.current.value = "";
			return;
		}
		try {
			for (const [index, file] of list.entries()) {
				const onProgress = (percent: number) => setUpload({ current: index + 1, total: list.length, percent });
				setUpload({ current: index + 1, total: list.length, percent: 0 });
				if (isImageFile(file)) {
					const prepared = await prepareUpload(file, { optimize });
					await uploadImageFile(prepared, onProgress);
				} else {
					await uploadAttachment(file, onProgress);
				}
			}
			toast.success(`${list.length}개 파일을 올렸습니다.`);
			setPage(1);
			await invalidateMedia();
		} catch (error) {
			// 실패한 업로드는 사용 가능 상태가 되지 않는다. 같은 파일로 다시 시도할 수 있다(§7.2).
			toast.error(`업로드 실패: ${errorText(error, "오류가 발생했습니다.")} 다시 시도할 수 있습니다.`);
		} finally {
			setUpload(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	const deleteMedia = async (media: MediaItem) => {
		// 목록에서 먼저 빼고 요청한다. 실패하면 되돌리고, 끝나면 서버 값으로 맞춘다.
		await queryClient.cancelQueries({ queryKey: MEDIA_KEY });
		const snapshots = queryClient.getQueriesData<MediaPage>({ queryKey: MEDIA_KEY });
		queryClient.setQueriesData<MediaPage>({ queryKey: MEDIA_KEY }, (data) =>
			data?.items.some((item) => item.id === media.id)
				? { items: data.items.filter((item) => item.id !== media.id), total: Math.max(0, data.total - 1) }
				: data,
		);
		// 지우는 파일이 열려 있으면 닫는다. 그 파일의 고친 기본 설명은 함께 버린다.
		setSelectedId((current) => {
			if (current !== media.id) return current;
			detailDirtyRef.current = false;
			return null;
		});
		try {
			await cmsFetch(`/api/cms/v1/media/${media.id}`, { method: "DELETE", fallback: "삭제하지 못했습니다." });
			toast.success(`'${media.filename}'을(를) 삭제했습니다.`);
		} catch (error) {
			for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
			toast.error(errorText(error, "삭제하지 못했습니다."));
		} finally {
			void invalidateMedia();
		}
	};

	/** 기본 설명 저장. 실패는 상세 칸 안에 보이도록 그대로 던진다. */
	const saveDefaults = async (media: MediaItem, defaults: { alt: string; caption: string }) => {
		await cmsFetch(`/api/cms/v1/media/${media.id}`, {
			method: "PATCH",
			json: { defaultAlt: defaults.alt, defaultCaption: defaults.caption },
			fallback: "저장하지 못했습니다.",
		});
		toast.success("저장했습니다.");
		void invalidateMedia();
	};

	const rename = async (media: MediaItem, filename: string) => {
		try {
			await cmsFetch(`/api/cms/v1/media/${media.id}`, { method: "PATCH", json: { filename } });
			toast.success(`이름을 '${filename}'(으)로 바꿨습니다.`);
			await invalidateMedia();
		} catch (error) {
			toast.error(errorText(error, "이름을 바꾸지 못했습니다."));
		}
	};

	const cleanup = async () => {
		try {
			const result = await cmsFetch<{ removed: number; failed: string[] }>("/api/cms/v1/media/cleanup", {
				method: "POST",
				json: {},
			});
			const text = `24시간 지난 미완료 업로드 ${result.removed}개를 정리했습니다.${result.failed.length ? ` ${result.failed.length}개는 다음에 다시 시도합니다.` : ""}`;
			if (result.failed.length) toast.error(text);
			else toast.success(text);
			void invalidateMedia();
		} catch (error) {
			toast.error(errorText(error, "정리하지 못했습니다."));
		}
	};

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const setDetailDirty = useCallback((dirty: boolean) => {
		detailDirtyRef.current = dirty;
	}, []);

	const requestDelete = async (media: MediaItem) => {
		const ok = await confirm({
			title: media.status === "deleting" ? "삭제 다시 시도" : "미디어 삭제",
			description: `'${media.filename}' 파일을 삭제할까요? 템플릿이나 해석하지 못한 초안에서 쓰이면 삭제가 보류됩니다.`,
			confirmLabel: "삭제",
			destructive: true,
		});
		if (ok) await deleteMedia(media);
	};

	/** 미디어 타일의 오른쪽 클릭·`⋯` 메뉴(v2 A2). */
	const mediaMenu = (media: MediaItem): MenuAction[] => [
		{ kind: "item", label: "열기", icon: PanelRightOpen, onSelect: () => void openDetail(media.id) },
		{
			kind: "sub",
			label: "사용처",
			icon: Link2,
			emptyLabel: "초안·공개본에서 쓰이지 않습니다",
			items: media.references.map((reference) => ({
				kind: "item" as const,
				label: `${reference.title || "제목 없음"} · ${reference.state === "published" ? "공개본" : "초안"}`,
				icon: FileText,
				onSelect: () => window.location.assign(entryHref(reference.collection, reference.entryId)),
			})),
		},
		{ kind: "separator" },
		{
			kind: "item",
			label: "삭제",
			icon: Trash2,
			shortcut: "Del",
			destructive: true,
			disabled: media.referencesCount > 0,
			onSelect: () => void requestDelete(media),
		},
	];

	const viewProps = {
		items,
		selectedId,
		dimmed: mediaQuery.isPlaceholderData,
		onSelect: (media: MediaItem) => void openDetail(media.id),
		menuFor: mediaMenu,
		onDeleteKey: (media: MediaItem) => void requestDelete(media),
	};

	const setFilter = (apply: () => void) => {
		apply();
		setPage(1);
	};

	return (
		<AdminShell
			title="미디어"
			count={mediaQuery.data ? total : undefined}
			sidebar={{ activeNav: "media" }}
			headerActions={
				<div className="flex flex-wrap items-center gap-2">
					<Label className="font-normal text-muted-foreground text-xs">
						<Switch size="sm" checked={optimize} onCheckedChange={(checked) => setOptimize(checked === true)} />
						웹용 최적화
					</Label>
					<input
						ref={fileInputRef}
						type="file"
						multiple
						hidden
						accept={UPLOAD_ACCEPT}
						onChange={(event) => void handleFiles(event.target.files)}
					/>
					<Button type="button" size="sm" disabled={upload !== null} onClick={() => fileInputRef.current?.click()}>
						<Upload aria-hidden />
						{upload ? `업로드 중 ${upload.current}/${upload.total} · ${upload.percent}%` : "파일 업로드"}
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={() => void cleanup()}>
						미완료 업로드 정리
					</Button>
					<IconButton label="새로고침" variant="outline" onClick={() => void mediaQuery.refetch()}>
						<RefreshCw className={cn(mediaQuery.isFetching && "animate-spin")} aria-hidden />
					</IconButton>
				</div>
			}
		>
			<div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 lg:px-6">
				<Input
					type="search"
					aria-label="파일명 검색"
					value={search}
					placeholder="파일명 검색"
					onChange={(event) => setFilter(() => setSearch(event.target.value))}
					className="h-8 w-56"
				/>
				<Select
					value={kind}
					items={KIND_OPTIONS}
					onValueChange={(value) => value && setFilter(() => setKind(value as typeof kind))}
				>
					<SelectTrigger size="sm" aria-label="형식">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{KIND_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select
					value={used}
					items={USED_OPTIONS}
					onValueChange={(value) => value && setFilter(() => setUsed(value as typeof used))}
				>
					<SelectTrigger size="sm" aria-label="사용 여부">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{USED_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<DateRangePicker
					label="업로드일"
					from={uploadedFrom}
					to={uploadedTo}
					onChange={(from, to) =>
						setFilter(() => {
							setUploadedFrom(from);
							setUploadedTo(to);
						})
					}
				/>
				<ToggleGroup
					aria-label="보기"
					variant="outline"
					size="sm"
					spacing={0}
					value={[view]}
					onValueChange={(next: unknown[]) => {
						const picked = next[0];
						if (picked === "grid" || picked === "list") setView(picked);
					}}
					className="ml-auto"
				>
					<ToggleGroupItem value="grid" aria-label="바둑판 보기">
						<LayoutGrid aria-hidden />
					</ToggleGroupItem>
					<ToggleGroupItem value="list" aria-label="목록 보기">
						<List aria-hidden />
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				<div className="flex-1 overflow-y-auto p-4 lg:p-6">
					{loadError && (
						<Alert variant="danger" className="mb-4 flex w-auto items-center justify-between">
							<AlertDescription className="col-start-auto">{loadError}</AlertDescription>
							<Button type="button" variant="outline" size="xs" onClick={() => void mediaQuery.refetch()}>
								다시 시도
							</Button>
						</Alert>
					)}
					{items.length === 0 ? (
						loadError ? null : mediaQuery.isPending ? (
							<ul aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
								{Array.from({ length: 6 }, (_, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: 자리표시
									<li key={index}>
										<Skeleton className="aspect-square w-full rounded-lg" />
									</li>
								))}
							</ul>
						) : (
							<Empty className="py-16">
								<EmptyHeader>
									<EmptyTitle>조건에 맞는 미디어가 없습니다.</EmptyTitle>
								</EmptyHeader>
							</Empty>
						)
					) : view === "grid" ? (
						<MediaGrid {...viewProps} />
					) : (
						<MediaTable {...viewProps} />
					)}
					<nav aria-label="페이지 이동" className="mt-4 flex items-center justify-end gap-2 text-xs">
						<Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
							이전
						</Button>
						<span className="tabular-nums">
							{page} / {totalPages}
						</span>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={page >= totalPages}
							onClick={() => setPage(page + 1)}
						>
							다음
						</Button>
					</nav>
				</div>

				{selected && (
					<MediaDetailPanel
						key={selected.id}
						media={selected}
						className={SIDE_PANEL_DOCK}
						onClose={() => void openDetail(null)}
						onSaveDefaults={(defaults) => saveDefaults(selected, defaults)}
						onRename={(filename) => void rename(selected, filename)}
						onRequestDelete={() => void requestDelete(selected)}
						onDirtyChange={setDetailDirty}
					/>
				)}
			</div>
			{dialog}
		</AdminShell>
	);
}
