import type { ReadonlyURLSearchParams } from "next/navigation";

const getQueryObject = (searchParams: ReadonlyURLSearchParams) => {
	const query = Object.fromEntries(
		Array.from(new Set(searchParams.keys())).map((key) => {
			const values = searchParams.getAll(key);

			return [key, values.length > 1 ? values : (values[0] ?? "")];
		}),
	);

	return Object.keys(query).length > 0 ? query : undefined;
};

/** 현재 쿼리(카테고리 필터 등)를 유지한 채 다른 경로로 이동하는 href. */
const getHrefWithCurrentQuery = (pathname: string, searchParams: ReadonlyURLSearchParams) => ({
	pathname,
	query: getQueryObject(searchParams),
});

export { getHrefWithCurrentQuery };
