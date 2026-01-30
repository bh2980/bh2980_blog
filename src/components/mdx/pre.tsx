import { Folder } from "lucide-react";
import type { PropsWithChildren } from "react";
import { cn } from "@/utils/cn";
import { CopyButton } from "./code-handler";

type PreProps = PropsWithChildren<{
	title?: string;
	showLineNumbers?: boolean;
	code: string;
}>;

export const Pre = async ({ children, title, showLineNumbers, code }: PreProps) => {
	const filePath = title?.trim().split("/").filter(Boolean);

	const showTitlebar = filePath && filePath.length > 0;

	return (
		<div className="group relative flex flex-col">
			{showTitlebar && (
				<div className="flex items-center gap-1 rounded-t-xl bg-slate-600 px-3 py-1.5 text-slate-300 text-sm">
					{filePath.map((folder, index, arr) => {
						const isFile = arr.length - 1 === index;

						return isFile ? (
							<span key={folder} className="inline-flex items-center gap-1 font-semibold text-slate-50">
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
			)}
			<pre
				className={cn("relative overflow-x-auto whitespace-pre rounded-xl", showTitlebar && "m-0! rounded-t-none")}
				data-show-line-numbers={showLineNumbers}
			>
				{children}
				<CopyButton text={code} className="lg:hidden lg:group-hover:block" />
			</pre>
		</div>
	);
};
