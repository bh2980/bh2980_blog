import { type Config, config } from "@keystatic/core";
import { collectionCollection, memoCollection, postCollection, tagCollection } from "@/keystatic/collections";

const storage: Config["storage"] =
	process.env.NODE_ENV === "development"
		? { kind: "local" }
		: {
				kind: "github",
				repo: { owner: process.env.KEYSTATIC_OWNER, name: process.env.KEYSTATIC_REPO },
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
