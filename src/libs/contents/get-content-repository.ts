import type { ContentRepository } from "./contracts/repository";
import { KeystaticRepository } from "./repositories/keystatic";
import { PostgresRepository } from "./repositories/postgres";
import { resolveContentRepositorySource } from "./repositories/source";

export {
	CONTENT_REPOSITORY_SOURCES,
	type ContentRepositorySource,
	resolveContentRepositorySource,
} from "./repositories/source";

export function createContentRepository(source: ReturnType<typeof resolveContentRepositorySource>) {
	return source === "postgres" ? new PostgresRepository() : new KeystaticRepository();
}

export function getContentRepository(): ContentRepository {
	return createContentRepository(resolveContentRepositorySource(process.env.CMS_PUBLIC_REPOSITORY));
}
