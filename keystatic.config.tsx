import { type Config, config } from "@keystatic/core";
import {
	memoCategoryCollection,
	memoCollection,
	postCategoryCollection,
	postCollection,
	projectCollection,
	seriesCollection,
	tagCollection,
} from "@/keystatic/collections";

const storage: Config["storage"] =
	process.env.NODE_ENV === "development"
		? { kind: "local" }
		: { kind: "github", repo: { owner: "bh2980", name: "bh2980_blog" } };

export default config({
	storage,
	collections: {
		//공통
		tag: tagCollection,
		//게시글
		postCategory: postCategoryCollection,
		post: postCollection,
		series: seriesCollection,
		project: projectCollection,
		//메모
		memoCategory: memoCategoryCollection,
		memo: memoCollection,
	},
	ui: {
		navigation: {
			게시글: ["postCategory", "post", "series", "project", "tag"],
			메모: ["memoCategory", "memo", "tag"],
		},
	},
});
