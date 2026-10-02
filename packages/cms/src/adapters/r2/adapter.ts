import type { MediaAdapter } from "../../server/define";
import { createR2MediaStore } from "./media-store";
import type { MediaStoreConfig } from "./types";

export type R2Options = { readonly [K in keyof MediaStoreConfig]: MediaStoreConfig[K] | undefined };

/** Cloudflare R2(S3 호환) 미디어 저장소. 값이 하나라도 없으면 처음 쓸 때 오류를 낸다. */
export function r2Storage(options: R2Options): MediaAdapter {
	return {
		name: "r2",
		createStore: () => {
			const missing = Object.entries(options)
				.filter(([, value]) => !value)
				.map(([key]) => key);
			if (missing.length > 0) {
				throw new Error(`cms.server: r2Storage is missing ${missing.join(", ")}`);
			}
			return createR2MediaStore(options as MediaStoreConfig);
		},
	};
}
