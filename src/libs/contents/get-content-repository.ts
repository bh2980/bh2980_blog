import type { ContentRepository } from "./contracts/repository";
import { PostgresRepository } from "./repositories/postgres";
import { resolveContentRepositorySource } from "./repositories/source";

export {
	CONTENT_REPOSITORY_SOURCES,
	type ContentRepositorySource,
	resolveContentRepositorySource,
} from "./repositories/source";

export function createContentRepository(): ContentRepository {
	return new PostgresRepository();
}

export function getContentRepository(): ContentRepository {
	// 플래그를 먼저 검증한다. 미설정·오값이면 여기서 실패한다(fail-closed).
	resolveContentRepositorySource(process.env.CMS_PUBLIC_REPOSITORY);
	return createContentRepository();
}
