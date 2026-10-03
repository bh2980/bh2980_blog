"use client";

import type { Editor } from "@tiptap/core";
import { Puzzle } from "lucide-react";
import { iconByName } from "../screens/shared/collection-icon";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { buildBlockSlashCommands } from "./slash-command";

const CUSTOM_BLOCKS = buildBlockSlashCommands();

/** 커스텀 컴포넌트 목록. 컴포넌트 메뉴와 툴바 "더보기" 메뉴가 함께 쓴다. */
export function CustomBlockMenuItems({ editor }: { editor: Editor }) {
	return CUSTOM_BLOCKS.map((block) => {
		// 블록 정의의 아이콘(`editor.icon`). 없으면 퍼즐 아이콘을 쓴다.
		const Icon = (typeof block.icon === "string" ? iconByName(block.icon) : block.icon) ?? Puzzle;
		return (
			<DropdownMenuItem
				key={block.id ?? block.title}
				disabled={!editor.isEditable}
				// 슬래시 메뉴용 액션이라 지울 글자가 없는 빈 범위를 커서 자리에 넘긴다.
				onClick={() => {
					const { from } = editor.state.selection;
					block.action(editor, { from, to: from });
				}}
			>
				<Icon aria-hidden className="size-4" />
				<span className="flex-1">{block.title}</span>
			</DropdownMenuItem>
		);
	});
}

/** 툴바에서 커스텀 컴포넌트(블록)를 커서 위치에 넣는다. */
export function CustomBlockMenu({ editor }: { editor: Editor }) {
	return (
		<DropdownMenu>
			<Tooltip>
				<TooltipTrigger
					render={
						<DropdownMenuTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="size-8 p-0"
									aria-label="컴포넌트 삽입"
									disabled={!editor.isEditable}
									onMouseDown={(event) => event.preventDefault()}
								/>
							}
						/>
					}
				>
					<Puzzle className="size-4" aria-hidden />
				</TooltipTrigger>
				<TooltipContent side="bottom">컴포넌트</TooltipContent>
			</Tooltip>
			<DropdownMenuContent align="start" className="min-w-44">
				<CustomBlockMenuItems editor={editor} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
