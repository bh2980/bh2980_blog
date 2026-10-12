"use client";

import { useEffect, useRef } from "react";

/** 이 너비부터 각주가 오른쪽 여백으로 나간다(본문 오른쪽에 여백이 생기는 xl 구간). */
const SIDENOTE_MEDIA = "(min-width: 1280px)";
const NOTE_GAP_PX = 10;

/**
 * 각주를 옆주(오른쪽 여백 주석)로 보여 준다. 본문 컨테이너(`relative`) 안에 한 번 두면 된다.
 * 넓은 화면에서는 각주 내용을 복제해 참조 위치에 맞춰 여백에 놓고 아래 각주 목록을 숨긴다.
 * 좁은 화면에서는 아무것도 하지 않아 아래 각주 목록이 그대로 남는다.
 */
export function Sidenotes() {
	const layerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const layer = layerRef.current;
		const container = layer?.parentElement;
		if (!layer || !container) return;

		const media = window.matchMedia(SIDENOTE_MEDIA);
		const footnotes = container.querySelector<HTMLElement>("section[data-footnotes]");
		let frame = 0;

		const clear = () => {
			layer.replaceChildren();
			if (footnotes) footnotes.style.display = "";
		};

		const layout = () => {
			clear();
			if (!media.matches || !footnotes) return;

			const refs = Array.from(container.querySelectorAll<HTMLAnchorElement>("a[data-footnote-ref]"));
			if (refs.length === 0) return;

			const containerTop = container.getBoundingClientRect().top;
			let bottom = Number.NEGATIVE_INFINITY;

			for (const ref of refs) {
				const source = document.getElementById(ref.hash.slice(1));
				if (!source) continue;

				const note = document.createElement("aside");
				note.className =
					"pointer-events-auto absolute left-[calc(100%+1.5rem)] w-[12.5rem] text-[0.8rem] text-muted-foreground leading-[1.7]";

				const number = document.createElement("span");
				number.className = "mr-1 font-semibold text-primary";
				number.textContent = `${ref.textContent}.`;
				note.append(number);

				// 원본 각주의 내용만 가져온다. 되돌아가기 링크는 빼고, 같은 id가 둘이 되지 않게 지운다.
				const body = source.cloneNode(true) as HTMLElement;
				for (const back of body.querySelectorAll("[data-footnote-backref]")) back.remove();
				for (const el of body.querySelectorAll("[id]")) el.removeAttribute("id");
				body.removeAttribute("id");
				for (const p of body.querySelectorAll("p")) p.style.display = "inline";
				note.append(...body.childNodes);

				note.style.top = "0px";
				layer.append(note);

				const wanted = ref.getBoundingClientRect().top - containerTop;
				const top = Math.max(wanted, bottom + NOTE_GAP_PX);
				note.style.top = `${top}px`;
				bottom = top + note.offsetHeight;
			}

			footnotes.style.display = "none";
		};

		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(layout);
		};

		const observer = new ResizeObserver(schedule);
		observer.observe(container);
		media.addEventListener("change", schedule);
		document.fonts?.ready.then(schedule);
		schedule();

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
			media.removeEventListener("change", schedule);
			clear();
		};
	}, []);

	return <div ref={layerRef} aria-hidden={false} className="pointer-events-none absolute inset-0" />;
}
