import { Folder } from "lucide-react";
import type { CSSProperties, PropsWithChildren } from "react";
import { cn } from "@/utils/cn";
import { CopyButton } from "./copy-button.client";

type PreProps = PropsWithChildren<{
	showLineNumbers?: boolean;
	code: string;
	title?: string;
	className?: string;
	style?: CSSProperties;
}>;

export const pre = async ({ children, title, showLineNumbers, code, className, style }: PreProps) => {
	const filePath = title?.trim().split("/").filter(Boolean);

	const showTitlebar = filePath && filePath.length > 0;

	return (
		<div className="group relative flex flex-col overflow-hidden rounded-xl border dark:border-none">
			<div
				className={cn(
					"peer",
					"hidden items-center gap-1 border-b bg-gray-100 px-3 py-1.5 text-sm dark:bg-gray-700 dark:text-slate-300",
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
						<>
							<span key={folder} className="inline-flex items-center gap-1">
								<Folder size={16} className="stroke-2" />
								{folder}
							</span>
							<span>/</span>
						</>
					);
				})}
			</div>
			<pre
				className={cn(
					"relative overflow-x-auto whitespace-pre rounded-xl px-0!",
					"[&_.line]:inline-block [&_.line]:w-full",
					showLineNumbers ? "[&_.line]:px-2 [&_.line]:before:mr-5" : "[&_.line]:px-5",
					showTitlebar && "m-0! rounded-t-none",
					className,
				)}
				data-show-line-numbers={showLineNumbers}
				style={style}
			>
				{children}
			</pre>
			<CopyButton text={code} className="peer-data-title:top-10! lg:hidden lg:group-hover:block" />
		</div>
	);
};
