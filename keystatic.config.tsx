import { type Config, config } from "@keystatic/core";
import { collectionCollection, memoCollection, postCollection, tagCollection } from "@/keystatic/collections";

const storage: Config["storage"] =
	process.env.NODE_ENV === "development"
		? { kind: "local" }
		: {
				kind: "github",
				repo: { owner: process.env.NEXT_PUBLIC_KEYSTATIC_OWNER, name: process.env.NEXT_PUBLIC_KEYSTATIC_REPO },
				branchPrefix: "docs/",
			};

export default config({
	storage,
	collections: {
		post: postCollection,
		memo: memoCollection,
		collection: collectionCollection,
		tag: tagCollection,
	},
});
