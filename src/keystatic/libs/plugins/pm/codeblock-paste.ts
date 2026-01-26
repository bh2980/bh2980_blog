import { Fragment, type Node, Slice } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { isInCodeblock } from "./codeblock-keys";

export function codeBlockPasteAsHardBreakPlugin() {
	return new Plugin({
		props: {
			handlePaste(view, event) {
				if (!event.clipboardData) return false;
				if (!isInCodeblock(view.state)) return false;

				const pmSchema = view.state.schema;
				const br = pmSchema.nodes?.hard_break;
				if (!br) return false;

				const text = event.clipboardData.getData("text/plain");
				if (!text) return false;

				event.preventDefault();

				const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
				const lines = normalized.split("\n"); // 빈 줄 포함

				const nodes: Node[] = [];
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					if (line.length > 0) nodes.push(pmSchema.text(line));
					if (i < lines.length - 1) nodes.push(br.create());
				}

				const slice = new Slice(Fragment.fromArray(nodes), 0, 0);
				view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
				return true;
			},
		},
	});
}
