import { Slice } from "prosemirror-model";
import { Plugin, type Selection, TextSelection } from "prosemirror-state";
import { isWrapperLikeNodeType } from "./wrapper-keys";

const EMPTY_BLOCK_SEPARATOR = "\n\n";
const UNWRAPPED_COPY_SLICE = Symbol("unwrapped-copy-slice");

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

const shouldUnwrapCopiedSelection = (selection: Selection) => selection instanceof TextSelection && !selection.empty;

type TaggedSlice = Slice & {
	[UNWRAPPED_COPY_SLICE]?: true;
};

const markSliceAsUnwrapped = (slice: Slice) => {
	const tagged = slice as TaggedSlice;
	tagged[UNWRAPPED_COPY_SLICE] = true;
	return tagged;
};

const wasSliceUnwrapped = (slice: Slice) => (slice as TaggedSlice)[UNWRAPPED_COPY_SLICE] === true;

export function wrapperCopyPlugin() {
	let plugin: Plugin;

	plugin = new Plugin({
		props: {
			transformCopied(slice, view) {
				if (!shouldUnwrapCopiedSelection(view.state.selection)) {
					return slice;
				}

				const unwrapped = unwrapOpenWrapperSlice(slice);
				return unwrapped.changed ? markSliceAsUnwrapped(unwrapped.slice) : unwrapped.slice;
			},
			clipboardTextSerializer(slice, view) {
				if (wasSliceUnwrapped(slice)) {
					return slice.content.textBetween(0, slice.content.size, EMPTY_BLOCK_SEPARATOR);
				}

				const nextSerializer = findNextClipboardTextSerializer(view, plugin);
				if (nextSerializer) {
					const serialize = nextSerializer.serializer as (content: Slice, view: unknown) => string;
					return serialize(slice, view);
				}

				return slice.content.textBetween(0, slice.content.size, EMPTY_BLOCK_SEPARATOR);
			},
		},
	});

	return plugin;
}

export { unwrapOpenWrapperSlice };
export { shouldUnwrapCopiedSelection };
export { markSliceAsUnwrapped };
export { wasSliceUnwrapped };
