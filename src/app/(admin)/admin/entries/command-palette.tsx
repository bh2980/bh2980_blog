"use client";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@/components/ui/command";

export interface PaletteCommand {
	id: string;
	label: string;
	group: string;
	keywords?: string[];
	shortcut?: string;
	disabled?: boolean;
	run: () => void;
}

/** `Cmd/Ctrl+K` CMS 명령 검색(§4.2). 한국어·영문 키워드로 찾는다. */
export function CommandPalette({
	open,
	onOpenChange,
	commands,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	commands: PaletteCommand[];
}) {
	const groups = [...new Set(commands.map((command) => command.group))];
	return (
		<CommandDialog open={open} onOpenChange={onOpenChange} title="명령 검색" description="실행할 명령을 찾으세요.">
			<CommandInput placeholder="명령 검색 (예: 발행, 저장, 원문)" />
			<CommandList>
				<CommandEmpty>일치하는 명령이 없습니다.</CommandEmpty>
				{groups.map((group) => (
					<CommandGroup key={group} heading={group}>
						{commands
							.filter((command) => command.group === group)
							.map((command) => (
								<CommandItem
									key={command.id}
									value={`${command.label} ${(command.keywords ?? []).join(" ")}`}
									disabled={command.disabled}
									onSelect={() => {
										onOpenChange(false);
										command.run();
									}}
								>
									{command.label}
									{command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
								</CommandItem>
							))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
}
