import { Folder } from "lucide-react";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import { cn } from "@/utils/cn";
import type { EditorCodeLang } from "@/keystatic/fields/mdx/components/code-block/const";
import { buildAnnotatedLines, DEFAULT_ANNOTATION_CONFIG } from "@/keystatic/fields/mdx/components/code-block/libs";
import { CopyButton } from "./code-handler";

type CodeblockProps = {
	code: string;
	annotations: string;
	lang: EditorCodeLang;
	useLineNumber: boolean;
	meta: string;
};

export const CodeBlock = async ({ code, annotations, lang, useLineNumber, meta }: CodeblockProps) => {
	const codeStr = JSON.parse(code);
	const annotationList = JSON.parse(annotations) as Annotation[];
	const { renderedLines } = await buildAnnotatedLines({
		code: codeStr,
		lang,
		annotationList,
		useLineNumber,
		annotationConfig: DEFAULT_ANNOTATION_CONFIG,
	});

	const filePath = meta
		.match(/title="(.+?)"/)?.[1]
		.trim()
		.split("/")
		.filter(Boolean);

	const showTitlebar = filePath && filePath.length >= 0;

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
								/
							</>
						);
					})}
				</div>
			)}
			<pre className={cn("relative overflow-x-auto whitespace-pre rounded-xl", showTitlebar && "m-0! rounded-t-none")}>
				<code>{renderedLines}</code>
				<CopyButton text={codeStr} className="lg:hidden lg:group-hover:block" />
			</pre>
		</div>
	);
};
