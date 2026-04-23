import type { ContentRepository } from "./contracts/repository";
import { KeystaticRepository } from "./repositories/keystatic";

export function getContentRepository(): ContentRepository {
	return new KeystaticRepository();
}
