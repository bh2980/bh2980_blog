"use client";

import type { ReactNode } from "react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import { cn } from "@/utils/cn";
import { extractRangesPlainText } from "./extract-ranges";
import { highlightCode } from "./shiki-code-view";
import type { EditorCodeLang } from "./const";

type NodeViewCodeEditorProps = { lang: EditorCodeLang; useLineNumber?: boolean } & {
	nodeViewChildren: ReactNode;
	onCodeChange?: (code: string) => void;
};

type TokenResult = {
	renderedLines?: ReactNode[];
	tokenMeta?: {
		fg?: string;
		bg?: string;
	};
};

export const NodeViewCodeEditor = ({
	nodeViewChildren,
	lang,
	useLineNumber,
	onCodeChange,
}: NodeViewCodeEditorProps) => {
	const preRef = useRef<HTMLPreElement>(null);

	const [tokenResult, setTokenResult] = useState<TokenResult>({});

	const updateShiki = useCallback(
		async (code: string, lang: string, annotationList?: Annotation[]) => {
			const result = await highlightCode({
				code,
				lang,
				annotationList,
				useLineNumber: Boolean(useLineNumber),
			});

			setTokenResult(result);
		},
		[useLineNumber],
	);

	useLayoutEffect(() => {
		const el = preRef.current;
		if (!el) return;

		const update = () => {
			const proseHtml = el.innerHTML;
			const rawCodePattern = /<p.+?>(?<content>.+?)<\/p>/;
			const result = proseHtml.match(rawCodePattern)?.groups?.content.replaceAll("<br>", "\n") ?? "";

			const annotationList = extractRangesPlainText(result);
			const code = result.replaceAll(/<.+?>/g, "");

			onCodeChange?.(code);
			updateShiki(code, lang, annotationList);
		};

		update();

		const obs = new MutationObserver(update);
		obs.observe(el, { subtree: true, childList: true, characterData: true });

		return () => obs.disconnect();
	}, [lang, onCodeChange, updateShiki]);

	return (
		<div className="relative *:m-0!">
			<pre
				className={cn(
					"w-full [&_p]:m-0!",
					"absolute bg-transparent! text-transparent! caret-white!",
					"**:data-[component=u]:decoration-white! [&_s]:decoration-1! [&_s]:decoration-white!",
					useLineNumber && "[&_p]:pl-7!",
				)}
				ref={preRef}
			>
				{nodeViewChildren}
			</pre>
			<pre
				className="pointer-events-none! select-none!"
				style={{ backgroundColor: tokenResult?.tokenMeta?.bg, color: tokenResult?.tokenMeta?.fg }}
			>
				{tokenResult?.renderedLines}
				<br />
			</pre>
		</div>
	);
};
