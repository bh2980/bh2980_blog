import { useEffect } from "react";
import type { RefObject } from "react";

export type SyncScrollAxis = "x" | "y" | "both";

export function useSyncScroll({
	refA,
	refB,
	axis = "both",
	syncOn,
}: {
	refA: RefObject<HTMLElement | null>;
	refB: RefObject<HTMLElement | null>;
	axis?: SyncScrollAxis;
	syncOn?: unknown;
}) {
	useEffect(() => {
		const elA = refA.current;
		const elB = refB.current;
		if (!elA || !elB || elA === elB) return;

		const syncX = axis !== "y";
		const syncY = axis !== "x";
		if (!syncX && !syncY) return;

		let syncing = false;

		const onScrollA = () => {
			if (syncing) return;
			syncing = true;
			if (syncX) elB.scrollLeft = elA.scrollLeft;
			if (syncY) elB.scrollTop = elA.scrollTop;
			syncing = false;
		};

		const onScrollB = () => {
			if (syncing) return;
			syncing = true;
			if (syncX) elA.scrollLeft = elB.scrollLeft;
			if (syncY) elA.scrollTop = elB.scrollTop;
			syncing = false;
		};

		elA.addEventListener("scroll", onScrollA, { passive: true });
		elB.addEventListener("scroll", onScrollB, { passive: true });

		return () => {
			elA.removeEventListener("scroll", onScrollA);
			elB.removeEventListener("scroll", onScrollB);
		};
	});

	useEffect(() => {
		if (syncOn === undefined) return;
		const elA = refA.current;
		const elB = refB.current;
		if (!elA || !elB || elA === elB) return;

		if (axis !== "y") {
			elB.scrollLeft = elA.scrollLeft;
		}
		if (axis !== "x") {
			elB.scrollTop = elA.scrollTop;
		}
	}, [axis, refA, refB, syncOn]);
}
