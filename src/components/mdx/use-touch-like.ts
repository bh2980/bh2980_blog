"use client";

import { useEffect, useState } from "react";

/**
 * 마우스를 올릴 수 없는 화면(터치)인지. `(hover: none)` 또는 `(pointer: coarse)`다.
 * 서버 렌더와 첫 렌더는 false이고, 붙은 뒤에 실제 값으로 바뀐다.
 */
export function useTouchLike(): boolean {
	const [isTouchLike, setIsTouchLike] = useState(false);

	useEffect(() => {
		const hoverNoneQuery = window.matchMedia("(hover: none)");
		const pointerCoarseQuery = window.matchMedia("(pointer: coarse)");
		const updateTouchLike = () => {
			setIsTouchLike(hoverNoneQuery.matches || pointerCoarseQuery.matches);
		};

		updateTouchLike();

		if ("addEventListener" in hoverNoneQuery && "addEventListener" in pointerCoarseQuery) {
			hoverNoneQuery.addEventListener("change", updateTouchLike);
			pointerCoarseQuery.addEventListener("change", updateTouchLike);

			return () => {
				hoverNoneQuery.removeEventListener("change", updateTouchLike);
				pointerCoarseQuery.removeEventListener("change", updateTouchLike);
			};
		}

		hoverNoneQuery.addListener(updateTouchLike);
		pointerCoarseQuery.addListener(updateTouchLike);

		return () => {
			hoverNoneQuery.removeListener(updateTouchLike);
			pointerCoarseQuery.removeListener(updateTouchLike);
		};
	}, []);

	return isTouchLike;
}
