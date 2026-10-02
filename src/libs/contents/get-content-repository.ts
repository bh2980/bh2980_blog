import type { ContentRepository } from "./contracts/repository";
import { PostgresRepository } from "./repositories/postgres";

export function getContentRepository(): ContentRepository {
	return new PostgresRepository();
}
