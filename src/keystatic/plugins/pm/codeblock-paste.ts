import { Fragment, type Node, Slice } from "prosemirror-model";
import { Plugin } from "prosemirror-state";
import { isInCodeblock } from "./codeblock-keys";

export function codeBlockPasteAsParagraphPlugin() {
	return new Plugin({
		props: {
			handlePaste(view, event) {
				if (!event.clipboardData) return false;

				// 코드 블록 안에서만 동작하게 할지, 아니면 일반 상황에서도
				// p 단위로 쪼개지게 할지는 의도에 따라 결정하세요.
				// 만약 모든 곳에서 p로 나뉘길 원하시면 아래 조건문을 제거하세요.
				if (!isInCodeblock(view.state)) return false;

				const pmSchema = view.state.schema;
				const pType = pmSchema.nodes.paragraph;
				if (!pType) return false;

				const text = event.clipboardData.getData("text/plain");
				if (!text) return false;

				event.preventDefault();

				const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
				const lines = normalized.split("\n");

				const nodes: Node[] = [];
				for (const line of lines) {
					// 각 라인을 paragraph 노드로 감쌉니다.
					// 빈 줄인 경우에도 빈 paragraph를 생성하여 줄바꿈 간격을 유지합니다.
					const content = line.length > 0 ? [pmSchema.text(line)] : [];
					nodes.push(pType.create(null, Fragment.fromArray(content)));
				}

				// Slice의 openStart와 openEnd를 1로 설정하면
				// 현재 커서가 있는 위치의 부모 노드(p)와 자연스럽게 병합되거나 교체됩니다.
				const slice = new Slice(Fragment.fromArray(nodes), 1, 1);
				view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
				return true;
			},
		},
	});
}
