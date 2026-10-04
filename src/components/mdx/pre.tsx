import { showsLineNumbers } from "@monti-cms/core/render/code";
import { Folder } from "lucide-react";
import { type CSSProperties, Fragment, type PropsWithChildren } from "react";
import { cn } from "@/utils/cn";
import { CopyButton } from "./copy-button.client";

type PreProps = PropsWithChildren<{
	showLineNumbers?: boolean;
	/** 줄 번호 표시. 에디터는 코드 펜스 meta에 `lnum`으로 저장한다(`showLineNumbers`와 같다). */
	lnum?: boolean | string;
	code: string;
	title?: string;
	className?: string;
	style?: CSSProperties;
	/** 코드 안 툴팁 설명(번호 순서, JSON 배열). 터치 기기에서 코드 아래 주석 목록으로 보인다. */
	notes?: string;
}>;

const parseNotes = (notes: string | undefined): string[] => {
	if (!notes) return [];
	try {
		const parsed: unknown = JSON.parse(notes);
		return Array.isArray(parsed) ? parsed.map(String) : [];
	} catch {
		return [];
	}
};

export const pre = async ({ children, title, showLineNumbers, lnum, code, className, style, notes }: PreProps) => {
	const numbered = showsLineNumbers({ showLineNumbers, lnum });
	const noteList = parseNotes(notes);
	const filePath = title?.trim().split("/").filter(Boolean);

	const showTitlebar = filePath && filePath.length > 0;

	return (
		<div className="group relative flex w-full flex-col overflow-hidden rounded-md border">
			<div
				className={cn(
					"peer",
					"hidden items-center gap-1 border-b bg-muted px-3 py-1.5 text-muted-foreground text-sm",
					showTitlebar && "flex",
				)}
				data-title={title}
			>
				{filePath?.map((folder, index, arr) => {
					const isFile = arr.length - 1 === index;

					return isFile ? (
						<span key={folder} className="inline-flex items-center gap-1 font-semibold dark:text-slate-50">
							{folder}
						</span>
					) : (
						<Fragment key={folder}>
							<span className="inline-flex items-center gap-1">
								<Folder size={16} className="stroke-2" />
								{folder}
							</span>
							<span>/</span>
						</Fragment>
					);
				})}
			</div>
			<pre
				className={cn(
					"relative overflow-x-auto whitespace-pre px-0!",
					"[&_>_code]:block [&_>_code]:min-w-fit",
					numbered ? "[&_.line]:px-2 [&_.line]:before:mr-5" : "[&_.line]:px-5",
					showTitlebar && "m-0! rounded-t-none",
					"dark:bg-slate-800!",
					className,
				)}
				// CSS가 속성이 있기만 해도 줄 번호를 그린다. 꺼져 있으면 속성을 아예 두지 않는다.
				data-show-line-numbers={numbered || undefined}
				style={style}
			>
				{children}
			</pre>
			<CopyButton text={code} className="hidden peer-data-title:top-10! lg:group-hover:block" />
			{noteList.length > 0 && (
				// 터치 기기는 툴팁을 띄울 수 없다. 코드 안 번호에 맞춘 주석 목록을 코드 아래에 둔다.
				<ol
					aria-label="코드 주석"
					className="m-0! touch:block hidden list-none space-y-1 border-t bg-muted/40 px-4! py-3 text-sm leading-6"
				>
					{noteList.map((note, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 주석 번호가 곧 순서다
						<li key={index} className="m-0! flex gap-2 p-0!">
							<span className="shrink-0 font-semibold text-primary tabular-nums">{index + 1}</span>
							<span className="text-muted-foreground">{note}</span>
						</li>
					))}
				</ol>
			)}
		</div>
	);
};
