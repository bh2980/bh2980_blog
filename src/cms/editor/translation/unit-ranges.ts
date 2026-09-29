import type { Node as PmNode } from "@tiptap/pm/model";
import { isExpandedContainer } from "@/cms/core/translation/units";
import type { CmsNode } from "@/cms/mdx";

/** 에디터에서 상자로 그리는 노드. 이 노드 안쪽은 원문 문서의 자식과 하나씩 짝이 맞는다. */
const PM_CONTAINERS = new Set(["cmsCallout", "cmsCollapsible", "cmsTabs", "cmsTab", "cmsColumns", "cmsColumn"]);

/** 번역 단위가 에디터 문서에서 차지하는 자리(노드 하나). 단위 하나가 여러 자리를 가질 수 있다. */
export interface UnitRange {
	readonly index: number;
	readonly from: number;
	readonly to: number;
}

/**
 * 번역 미리보기 문서(`buildWithOwners`)와 그 에디터 문서를 나란히 따라가며 단위마다 자리를 찾는다(v3 번역 화면).
 *
 * 원문 문서의 자식 하나는 에디터 문서의 자식 하나가 된다. 다만 상자가 에디터에서 모양을 바꾸는 경우가 있다:
 * 정렬 상자는 문단 속성이 되고, 옮길 수 없는 블록은 원문 보존 상자 하나로 남는다. 그때는 안쪽 단위가 모두
 * 그 노드 하나를 가리킨다(누르면 첫 단위를 고친다).
 */
export function unitRanges(pmDoc: PmNode, doc: CmsNode, owners: ReadonlyMap<CmsNode, number>): UnitRange[] {
	const ranges: UnitRange[] = [];
	const ownedWithin = (node: CmsNode): number[] => {
		const own = owners.get(node);
		return [...(own === undefined ? [] : [own]), ...(node.content ?? []).flatMap(ownedWithin)];
	};
	const walk = (children: readonly CmsNode[], parent: PmNode, contentStart: number) => {
		let offset = contentStart;
		children.forEach((child, i) => {
			const pm = parent.maybeChild(i);
			if (!pm) return;
			const from = offset;
			const to = offset + pm.nodeSize;
			offset = to;
			if (isExpandedContainer(child.type) && PM_CONTAINERS.has(pm.type.name)) {
				const header = owners.get(child);
				if (header !== undefined) ranges.push({ index: header, from, to });
				walk(child.content ?? [], pm, from + 1);
				return;
			}
			for (const index of ownedWithin(child)) ranges.push({ index, from, to });
		});
	};
	walk(doc.content ?? [], pmDoc, 0);
	return ranges;
}
