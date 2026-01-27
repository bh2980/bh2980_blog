"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import { renderTree } from "./libs";
import { highlightCode } from "./shiki-code-view";

type TagRange = { type: string; start: number; end: number };

const TYPE_TO_STYLE = {
	s: "delete",
	strong: "strong",
	em: "emphasis",
};

function extractRangesPlainText(html: string, tagsToTrack = new Set(["strong", "em", "span", "s"])) {
	const tpl = document.createElement("template");
	tpl.innerHTML = html;

	let pos = 0;
	const ranges: TagRange[] = [];

	const walk = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			const v = node.nodeValue ?? "";
			pos += v.length;
			return;
		}

		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const name = el.tagName.toLowerCase();
			const type = TYPE_TO_STYLE[name];
			const track = tagsToTrack.has(name);
			const start = pos;

			el.childNodes.forEach(walk);

			const end = pos;
			if (track) ranges.push({ type: type ?? name, start, end });
			return;
		}

		if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			node.childNodes.forEach(walk);
		}
	};

	walk(tpl.content);
	return ranges;
}

type NodeViewCodeEditorProps = { lang: string; useLineNumber?: boolean } & {
	nodeViewChildren: ReactNode;
	onCodeChange?: (code: string) => void;
};

export const NodeViewCodeEditor = ({
	nodeViewChildren,
	lang,
	useLineNumber,
	onCodeChange,
}: NodeViewCodeEditorProps) => {
	const preRef = useRef<HTMLPreElement>(null);

	const [code, setCode] = useState("");
	const [tokenResult, setTokenResult] = useState({});

	const updateShiki = async (code: string, lang: string, annotationList?: TagRange[]) => {
		const result = await highlightCode(code, lang, annotationList);

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
	}, []);

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
					useLineNumber && "ml-[calc(2ch+0.5rem)]",
				)}
				ref={preRef}
			>
				{nodeViewChildren}
			</pre>
			<pre
				className="pointer-events-none! select-none!"
				style={{ backgroundColor: tokenResult?.bg, color: tokenResult?.fg }}
			>
				{tokenResult?.tokens?.map((line, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: 뷰어 역할로 항목의 추가, 삭제, 순서 변경이 이루어지지 않으므로 사용
					<span key={`line-${index}`} className={cn(useLineNumber && "line")}>
						{renderTree(line, `line-${index}`)}
						{index < tokenResult?.tokens?.length - 1 ? "\n" : null}
					</span>
				))}
				<br />
			</pre>
		</div>
	);
};
