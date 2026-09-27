"use client";

import { Crop as CropIcon, RotateCw, Undo2 } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
	type CropBox,
	formatCrop,
	isFullCrop,
	parseCrop,
	parseRotate,
	type RotateDegree,
} from "@/cms/mdx/image-transform";
import { Button } from "@/components/ui/button";
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

export interface ImageCropDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	src: string;
	crop?: string | null;
	rotate?: string | number | null;
	onApply: (result: { crop: string | null; rotate: string | null }) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export function ImageCropDialog({ open, onOpenChange, src, crop, rotate, onApply }: ImageCropDialogProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	const activeDragCleanupRef = useRef<(() => void) | null>(null);

	const [cropDraft, setCropDraft] = useState<CropBox>({ x: 0, y: 0, width: 100, height: 100 });
	const [rotateDraft, setRotateDraft] = useState<number>(0);

	useEffect(() => {
		return () => {
			activeDragCleanupRef.current?.();
		};
	}, []);

	useEffect(() => {
		// 드래그 중에 대화상자가 닫혀도 전역 포인터 리스너를 남기지 않는다.
		if (!open) {
			activeDragCleanupRef.current?.();
			return;
		}
		const parsedCrop = parseCrop(crop);
		setCropDraft(parsedCrop || { x: 0, y: 0, width: 100, height: 100 });
		const parsedRot = parseRotate(rotate);
		setRotateDraft(parsedRot || 0);
	}, [open, crop, rotate]);

	const handleRotate90 = () => {
		setRotateDraft((prev) => ((prev + 90) % 360) as 0 | RotateDegree);
	};

	const handleResetRotate = () => {
		setRotateDraft(0);
	};

	const handleResetCrop = () => {
		setCropDraft({ x: 0, y: 0, width: 100, height: 100 });
	};

	const handleResetAll = () => {
		handleResetCrop();
		handleResetRotate();
	};

	const handleApply = () => {
		const finalCrop = isFullCrop(cropDraft) ? null : formatCrop(cropDraft);
		const finalRotate = rotateDraft === 0 ? null : String(rotateDraft);
		onApply({ crop: finalCrop, rotate: finalRotate });
		onOpenChange(false);
	};

	// 키보드 수치 직접 입력 대안 (P2)
	const handleNumericCropChange = (field: keyof CropBox, rawValue: number) => {
		if (!Number.isFinite(rawValue)) return;
		const val = round2(rawValue);
		setCropDraft((prev) => {
			let { x, y, width, height } = prev;
			if (field === "x") {
				x = clamp(val, 0, 99);
				if (x + width > 100) width = round2(100 - x);
			} else if (field === "y") {
				y = clamp(val, 0, 99);
				if (y + height > 100) height = round2(100 - y);
			} else if (field === "width") {
				width = clamp(val, 1, round2(100 - x));
			} else if (field === "height") {
				height = clamp(val, 1, round2(100 - y));
			}
			return { x, y, width, height };
		});
	};

	// 드래그로 자르기 영역 선택 (비율 자유, P1-2: 실제 이미지 엘리먼트 기준 좌표계)
	const handlePointerDown = (e: React.PointerEvent, handle?: "move" | "nw" | "ne" | "sw" | "se") => {
		e.preventDefault();
		e.stopPropagation();

		const targetElement = imgRef.current ?? containerRef.current;
		if (!targetElement) return;

		const rect = targetElement.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;

		activeDragCleanupRef.current?.();

		const startClientX = e.clientX;
		const startClientY = e.clientY;
		const startXPercent = clamp(((startClientX - rect.left) / rect.width) * 100, 0, 100);
		const startYPercent = clamp(((startClientY - rect.top) / rect.height) * 100, 0, 100);
		const initialCrop = { ...cropDraft };

		const onPointerMove = (moveEvent: PointerEvent) => {
			const currentXPercent = clamp(((moveEvent.clientX - rect.left) / rect.width) * 100, 0, 100);
			const currentYPercent = clamp(((moveEvent.clientY - rect.top) / rect.height) * 100, 0, 100);
			const deltaX = currentXPercent - startXPercent;
			const deltaY = currentYPercent - startYPercent;

			if (!handle) {
				// 영역 밖을 클릭해 새로 드래그로 사각형 생성
				const x = Math.min(startXPercent, currentXPercent);
				const y = Math.min(startYPercent, currentYPercent);
				const width = Math.abs(currentXPercent - startXPercent);
				const height = Math.abs(currentYPercent - startYPercent);
				if (width >= 2 && height >= 2) {
					setCropDraft({
						x: round2(x),
						y: round2(y),
						width: round2(width),
						height: round2(height),
					});
				}
				return;
			}

			if (handle === "move") {
				const newX = clamp(initialCrop.x + deltaX, 0, 100 - initialCrop.width);
				const newY = clamp(initialCrop.y + deltaY, 0, 100 - initialCrop.height);
				setCropDraft({
					...initialCrop,
					x: round2(newX),
					y: round2(newY),
				});
				return;
			}

			if (handle === "se") {
				const newWidth = clamp(initialCrop.width + deltaX, 2, 100 - initialCrop.x);
				const newHeight = clamp(initialCrop.height + deltaY, 2, 100 - initialCrop.y);
				setCropDraft({ ...initialCrop, width: round2(newWidth), height: round2(newHeight) });
			} else if (handle === "sw") {
				const maxLeft = initialCrop.x + initialCrop.width - 2;
				const newX = clamp(initialCrop.x + deltaX, 0, maxLeft);
				const newWidth = initialCrop.x + initialCrop.width - newX;
				const newHeight = clamp(initialCrop.height + deltaY, 2, 100 - initialCrop.y);
				setCropDraft({ x: round2(newX), y: initialCrop.y, width: round2(newWidth), height: round2(newHeight) });
			} else if (handle === "ne") {
				const newWidth = clamp(initialCrop.width + deltaX, 2, 100 - initialCrop.x);
				const maxTop = initialCrop.y + initialCrop.height - 2;
				const newY = clamp(initialCrop.y + deltaY, 0, maxTop);
				const newHeight = initialCrop.y + initialCrop.height - newY;
				setCropDraft({ x: initialCrop.x, y: round2(newY), width: round2(newWidth), height: round2(newHeight) });
			} else if (handle === "nw") {
				const maxLeft = initialCrop.x + initialCrop.width - 2;
				const maxTop = initialCrop.y + initialCrop.height - 2;
				const newX = clamp(initialCrop.x + deltaX, 0, maxLeft);
				const newY = clamp(initialCrop.y + deltaY, 0, maxTop);
				const newWidth = initialCrop.x + initialCrop.width - newX;
				const newHeight = initialCrop.y + initialCrop.height - newY;
				setCropDraft({ x: round2(newX), y: round2(newY), width: round2(newWidth), height: round2(newHeight) });
			}
		};

		const cleanup = () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerCancel);
			activeDragCleanupRef.current = null;
		};

		const onPointerUp = () => {
			cleanup();
		};

		const onPointerCancel = () => {
			cleanup();
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerCancel);
		activeDragCleanupRef.current = cleanup;
	};

	const isFull = isFullCrop(cropDraft);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl gap-4 p-5 sm:max-w-xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CropIcon className="size-4" />
						이미지 자르기 및 회전
					</DialogTitle>
					<DialogDescription>
						마우스로 드래그하거나 수치를 입력하여 자를 영역과 회전 각도를 지정하세요.
					</DialogDescription>
				</DialogHeader>

				{/* 이미지 영역 + 자르기 오버레이 (P1-2: 실제 이미지 크기에 맞춘 래퍼) */}
				<div className="flex flex-col items-center gap-2">
					<div className="flex max-h-[380px] w-full items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-1">
						<div
							ref={containerRef}
							onPointerDown={(e) => handlePointerDown(e)}
							className="relative inline-block select-none"
							style={{ touchAction: "none" }}
						>
							{/* biome-ignore lint/performance/noImgElement: editor dynamic image */}
							<img
								ref={imgRef}
								src={src}
								alt="자르기 편집 대상"
								className="pointer-events-none block max-h-[360px] max-w-full select-none rounded"
								draggable={false}
							/>

							{/* 선택된 자르기 영역 */}
							{!isFull && (
								<>
									{/* 어두운 반투명 배경 마스크 (영역 밖, P2 디자인 토큰 적용) */}
									<div
										className="pointer-events-none absolute inset-0 bg-foreground/40"
										style={{
											clipPath: `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${cropDraft.x}% ${cropDraft.y}%, ${cropDraft.x}% ${cropDraft.y + cropDraft.height}%, ${cropDraft.x + cropDraft.width}% ${cropDraft.y + cropDraft.height}%, ${cropDraft.x + cropDraft.width}% ${cropDraft.y}%, ${cropDraft.x}% ${cropDraft.y}%)`,
										}}
									/>

									{/* 활성 자르기 사각형 */}
									<div
										data-slot="crop-box"
										onPointerDown={(e) => handlePointerDown(e, "move")}
										className="absolute cursor-move border-2 border-primary shadow-sm"
										style={{
											left: `${cropDraft.x}%`,
											top: `${cropDraft.y}%`,
											width: `${cropDraft.width}%`,
											height: `${cropDraft.height}%`,
										}}
									>
										{/* 모서리 핸들 4개 */}
										<button
											type="button"
											data-slot="crop-handle-nw"
											onPointerDown={(e) => handlePointerDown(e, "nw")}
											className="absolute -top-1.5 -left-1.5 size-3.5 cursor-nwse-resize rounded-sm border border-background bg-primary p-0 shadow-sm"
											aria-label="좌측 상단 핸들"
										/>
										<button
											type="button"
											data-slot="crop-handle-ne"
											onPointerDown={(e) => handlePointerDown(e, "ne")}
											className="absolute -top-1.5 -right-1.5 size-3.5 cursor-nesw-resize rounded-sm border border-background bg-primary p-0 shadow-sm"
											aria-label="우측 상단 핸들"
										/>
										<button
											type="button"
											data-slot="crop-handle-sw"
											onPointerDown={(e) => handlePointerDown(e, "sw")}
											className="absolute -bottom-1.5 -left-1.5 size-3.5 cursor-nesw-resize rounded-sm border border-background bg-primary p-0 shadow-sm"
											aria-label="좌측 하단 핸들"
										/>
										<button
											type="button"
											data-slot="crop-handle-se"
											onPointerDown={(e) => handlePointerDown(e, "se")}
											className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize rounded-sm border border-background bg-primary p-0 shadow-sm"
											aria-label="우측 하단 핸들"
										/>
									</div>
								</>
							)}
						</div>
					</div>

					<div className="flex w-full flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
						<span>
							{isFull
								? "전체 이미지 (드래그하여 자를 영역을 선택하세요)"
								: `선택 영역: ${cropDraft.width}% × ${cropDraft.height}% (좌측 ${cropDraft.x}%, 상단 ${cropDraft.y}%)`}
						</span>
						{!isFull && (
							<Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleResetCrop}>
								자르기 취소
							</Button>
						)}
					</div>

					{/* 키보드 수치 직접 입력 컨트롤 (P2) */}
					<div className="flex w-full items-center justify-between gap-2 rounded-lg border bg-muted/10 p-2 text-xs">
						<span className="font-medium text-muted-foreground">영역 수치 (%):</span>
						<div className="flex items-center gap-2">
							<div className="flex items-center gap-1">
								<Label htmlFor="crop-input-x" className="text-muted-foreground text-xs">
									X
								</Label>
								<Input
									id="crop-input-x"
									type="number"
									min={0}
									max={99}
									step={1}
									value={cropDraft.x}
									aria-label="자르기 X 좌표 (%)"
									onChange={(e) => handleNumericCropChange("x", Number(e.target.value))}
									className="h-6 w-14 px-1.5 text-center text-xs"
								/>
							</div>
							<div className="flex items-center gap-1">
								<Label htmlFor="crop-input-y" className="text-muted-foreground text-xs">
									Y
								</Label>
								<Input
									id="crop-input-y"
									type="number"
									min={0}
									max={99}
									step={1}
									value={cropDraft.y}
									aria-label="자르기 Y 좌표 (%)"
									onChange={(e) => handleNumericCropChange("y", Number(e.target.value))}
									className="h-6 w-14 px-1.5 text-center text-xs"
								/>
							</div>
							<div className="flex items-center gap-1">
								<Label htmlFor="crop-input-w" className="text-muted-foreground text-xs">
									W
								</Label>
								<Input
									id="crop-input-w"
									type="number"
									min={1}
									max={100}
									step={1}
									value={cropDraft.width}
									aria-label="자르기 너비 (%)"
									onChange={(e) => handleNumericCropChange("width", Number(e.target.value))}
									className="h-6 w-14 px-1.5 text-center text-xs"
								/>
							</div>
							<div className="flex items-center gap-1">
								<Label htmlFor="crop-input-h" className="text-muted-foreground text-xs">
									H
								</Label>
								<Input
									id="crop-input-h"
									type="number"
									min={1}
									max={100}
									step={1}
									value={cropDraft.height}
									aria-label="자르기 높이 (%)"
									onChange={(e) => handleNumericCropChange("height", Number(e.target.value))}
									className="h-6 w-14 px-1.5 text-center text-xs"
								/>
							</div>
						</div>
					</div>
				</div>

				{/* 회전 컨트롤 */}
				<div className="flex items-center justify-between rounded-lg border bg-muted/20 p-2.5">
					<div className="flex items-center gap-2">
						<span className="font-medium text-xs">회전:</span>
						<span className="font-semibold text-primary text-xs">{rotateDraft}°</span>
						<span className="text-muted-foreground text-xs">자르기 영역은 회전하기 전 원본 기준입니다</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Button
							type="button"
							variant="outline"
							size="sm"
							aria-label="시계 방향 90도 회전"
							className="h-7 gap-1 px-2 text-xs"
							onClick={handleRotate90}
						>
							<RotateCw className="size-3.5" />
							90° 회전
						</Button>
						{rotateDraft !== 0 && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								aria-label="회전 초기화"
								className="h-7 px-2 text-xs"
								onClick={handleResetRotate}
							>
								<Undo2 className="size-3.5" />
								회전 초기화
							</Button>
						)}
					</div>
				</div>

				<DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
					<Button type="button" variant="ghost" size="sm" className="text-xs" onClick={handleResetAll}>
						초기화
					</Button>
					<div className="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => onOpenChange(false)}>
							취소
						</Button>
						<Button type="button" variant="default" size="sm" className="text-xs" onClick={handleApply}>
							적용
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
