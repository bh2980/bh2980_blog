// src/keystatic/fields/mdx-components/editor-pure-mdx-block.tsx
import { fields } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import { FileText } from "lucide-react";
import { lazy, Suspense } from "react";

const DEFAULT_MDX_SOURCE = [
	"<CodeWithTooltips>",
	"",
	"```js !code",
	"// !tooltip[/lorem/] description",
	"function lorem(ipsum, dolor = 1) {",
	"const sit = ipsum == null ? 0 : ipsum.sit",
	"dolor = sit - amet(dolor)",
	"// !tooltip[/consectetur/] inspect",
	"return sit ? consectetur(ipsum) : []",
	"}",
	"```",
	"",
	"## !!tooltips description",
	"",
	"### Hello world",
	"",
	"Lorem ipsum **dolor** sit amet `consectetur`.",
	"",
	"Adipiscing elit _sed_ do eiusmod.",
	"",
	"## !!tooltips inspect",
	"",
	"```js",
	"function consectetur(ipsum) {",
	"const { a, b } = ipsum",
	"return a + b",
	"}",
	"```",
	"",
	"</CodeWithTooltips>",
].join("\n");

const LazyPureMdxNodeView = lazy(() =>
	import("./node-view.client").then((m) => ({
		default: m.PureMdxBlockNodeView,
	})),
);

function PureMdxNodeViewProxy(props: any) {
	return (
		<Suspense fallback={null}>
			<LazyPureMdxNodeView {...props} />
		</Suspense>
	);
}

export const pureMDX = block({
	label: "MDX",
	icon: <FileText />,
	schema: {
		source: fields.text({ label: "source", multiline: true, defaultValue: DEFAULT_MDX_SOURCE }),
	},
	NodeView: PureMdxNodeViewProxy,
});
