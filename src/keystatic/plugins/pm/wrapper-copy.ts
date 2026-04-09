import { Slice } from "prosemirror-model";
import { Plugin, type Selection, TextSelection } from "prosemirror-state";
import { isWrapperLikeNodeType } from "./wrapper-keys";

const EMPTY_BLOCK_SEPARATOR = "\n\n";
const MARKDOWN_HARD_BREAK_PATTERN = /\\\r?\n/g;

const unwrapOpenWrapperSlice = (slice: Slice) => {
	let content = slice.content;
	let openStart = slice.openStart;
	let openEnd = slice.openEnd;
	let changed = false;

	// 선택이 wrapper "안쪽"에서 이뤄진 경우만 바깥 wrapper를 벗긴다.
	while (openStart > 0 && openEnd > 0 && content.childCount === 1) {
		const onlyChild = content.firstChild;
		if (!onlyChild || !isWrapperLikeNodeType(onlyChild.type)) break;

		content = onlyChild.content;
		openStart -= 1;
		openEnd -= 1;
		changed = true;
	}

	return {
		changed,
		slice: changed ? new Slice(content, openStart, openEnd) : slice,
	};
};

type ClipboardSerializerView = {
	state: {
		plugins: readonly Plugin[];
	};
};

const findNextClipboardTextSerializer = (view: ClipboardSerializerView, currentPlugin: Plugin) => {
	const currentIndex = view.state.plugins.indexOf(currentPlugin);
	if (currentIndex === -1) return undefined;

	for (let index = currentIndex + 1; index < view.state.plugins.length; index += 1) {
		const nextPlugin = view.state.plugins[index];
		const serializer = nextPlugin?.props.clipboardTextSerializer;
		if (serializer) {
			return { plugin: nextPlugin, serializer };
		}
	}

	return undefined;
};

const normalizeUnwrappedWrapperText = (text: string) => text.replace(MARKDOWN_HARD_BREAK_PATTERN, "\n");
const shouldUnwrapCopiedSelection = (selection: Selection) => selection instanceof TextSelection && !selection.empty;

export function wrapperCopyPlugin() {
	let plugin: Plugin;
	let lastCopyUnwrapped = false;

	plugin = new Plugin({
		props: {
			transformCopied(slice, view) {
				if (!shouldUnwrapCopiedSelection(view.state.selection)) {
					lastCopyUnwrapped = false;
					return slice;
				}

				const unwrapped = unwrapOpenWrapperSlice(slice);
				lastCopyUnwrapped = unwrapped.changed;
				return unwrapped.slice;
			},
			clipboardTextSerializer(slice, view) {
				const nextSerializer = findNextClipboardTextSerializer(view, plugin);
				const targetSlice = slice;
				if (nextSerializer) {
					const serialized = nextSerializer.serializer.call(nextSerializer.plugin, targetSlice, view);
					return lastCopyUnwrapped ? normalizeUnwrappedWrapperText(serialized) : serialized;
				}

				return targetSlice.content.textBetween(0, targetSlice.content.size, EMPTY_BLOCK_SEPARATOR);
			},
		},
	});

	return plugin;
}

export { unwrapOpenWrapperSlice };
export { normalizeUnwrappedWrapperText };
export { shouldUnwrapCopiedSelection };
