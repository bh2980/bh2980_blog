import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/postgres", () => ({
	PostgresRepository: class PostgresRepository {},
}));

import { getContentRepository } from "../get-content-repository";
import { PostgresRepository } from "../repositories/postgres";

const previousSource = process.env.CMS_PUBLIC_REPOSITORY;

afterEach(() => {
	if (previousSource === undefined) {
		delete process.env.CMS_PUBLIC_REPOSITORY;
	} else {
		process.env.CMS_PUBLIC_REPOSITORY = previousSource;
	}
});

describe("공개 콘텐츠 저장소", () => {
	it("환경변수 없이 PostgreSQL 저장소를 사용한다", () => {
		delete process.env.CMS_PUBLIC_REPOSITORY;

		expect(getContentRepository()).toBeInstanceOf(PostgresRepository);
	});
});
