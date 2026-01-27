"use client";

import type { MdxJsxAttribute } from "mdast-util-mdx-jsx";
import type { ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Annotation } from "@/libs/remark/remark-code-block-annotation";
import { cn } from "@/utils/cn";
import { highlightCode } from "./shiki-code-view";

type NodeViewCodeEditorProps = { lang: string; useLineNumber?: boolean } & {
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

const TYPE_TO_STYLE: Record<string, Annotation["type"]> = {
	s: "delete",
	strong: "strong",
	em: "emphasis",
};

function extractRangesPlainText(html: string, tagsToTrack = new Set(["strong", "em", "span", "s"])) {
	const tpl = document.createElement("template");
	tpl.innerHTML = html;

	let pos = 0;
	const ranges: Annotation[] = [];

	const walk = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const v = node.nodeValue ?? "";
			pos += v.length;
			return;
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const name = el.tagName.toLowerCase();
			const component = el.getAttribute("data-component");
			const track = tagsToTrack.has(name) || component === "u" || component === "Tooltip";
			const start = pos;

			el.childNodes.forEach(walk);

			const end = pos;
			if (!track || start >= end) return;

			if (component === "u") {
				ranges.push({
					type: "mdxJsxTextElement",
					name: "u",
					attributes: [],
					start,
					end,
				});
				return;
			}

			if (component === "Tooltip") {
				const content = el.getAttribute("data-content");
				const attributes: MdxJsxAttribute[] = content
					? [{ type: "mdxJsxAttribute", name: "content", value: content }]
					: [];

				ranges.push({
					type: "mdxJsxTextElement",
					name: "Tooltip",
					attributes,
					start,
					end,
				});
				return;
			}

			const mapped = TYPE_TO_STYLE[name];
			if (mapped) {
				ranges.push({
					type: mapped,
					start,
					end,
				});
			}

			return;
		}

		if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			node.childNodes.forEach(walk);
		}
	};

	walk(tpl.content);
	return ranges;
}

export const NodeViewCodeEditor = ({
	nodeViewChildren,
	lang,
	useLineNumber,
	onCodeChange,
}: NodeViewCodeEditorProps) => {
	const preRef = useRef<HTMLPreElement>(null);

	const [code, setCode] = useState("");
	const [tokenResult, setTokenResult] = useState<TokenResult>({});

	const updateShiki = async (code: string, lang: string, annotationList?: Annotation[]) => {
		const result = await highlightCode({
			code,
			lang,
			annotationList,
			useLineNumber: Boolean(useLineNumber),
		});

		setTokenResult(result);
	};

	useLayoutEffect(() => {
		const el = preRef.current;
		if (!el) return;

		const update = () => {
			const proseHtml = el.innerHTML;
			const rawCodePattern = /<p.+?>(?<content>.+?)<\/p>/;

			const result = proseHtml.match(rawCodePattern)?.groups?.content.replaceAll("<br>", "\n") ?? "";

			const annotationList = extractRangesPlainText(result);

			const code = result.replaceAll(/<.+?>/g, "");

			setCode(code);

			updateShiki(code, lang, annotationList);
		};

		update();

		const obs = new MutationObserver(update);
		obs.observe(el, { subtree: true, childList: true, characterData: true });

		return () => obs.disconnect();
	}, [lang, useLineNumber]);

	useEffect(() => {
		onCodeChange?.(code);
	}, [code, onCodeChange]);

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
