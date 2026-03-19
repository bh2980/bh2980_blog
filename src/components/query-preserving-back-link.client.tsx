"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { type ReadonlyURLSearchParams, useSearchParams } from "next/navigation";

type QueryPreservingBackLinkProps = {
	pathname: string;
	label?: string;
	className?: string;
	iconSize?: number;
};

const getQueryObject = (searchParams: ReadonlyURLSearchParams) => {
	const query = Object.fromEntries(
		Array.from(new Set(searchParams.keys())).map((key) => {
			const values = searchParams.getAll(key);

			return [key, values.length > 1 ? values : (values[0] ?? "")];
		}),
	);

	return Object.keys(query).length > 0 ? query : undefined;
};

const getHrefWithCurrentQuery = (pathname: string, searchParams: ReadonlyURLSearchParams) => ({
	pathname,
	query: getQueryObject(searchParams),
});

export const QueryPreservingBackLink = ({
	pathname,
	label = "돌아가기",
	className,
	iconSize = 16,
}: QueryPreservingBackLinkProps) => {
	const searchParams = useSearchParams();
	const href = getHrefWithCurrentQuery(pathname, searchParams);

	return (
		<Link href={href} className={className}>
			<ArrowLeft size={iconSize} />
			<span>{label}</span>
		</Link>
	);
};

export { getHrefWithCurrentQuery };
