import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { QueryPreservingBackLink } from "@/components/query-preserving-back-link.client";

export const MemoBackLink = () => {
	return (
		<Suspense
			fallback={
				<nav aria-label="리스트로 돌아가기" className="hidden md:block">
					<Link
						href="/memos"
						className="flex items-center gap-1 text-slate-500 text-sm hover:underline dark:text-slate-400"
					>
						<ArrowLeft size={14} />
						<span>돌아가기</span>
					</Link>
				</nav>
			}
		>
			<nav aria-label="리스트로 돌아가기" className="hidden md:block">
				<QueryPreservingBackLink
					pathname="/memos"
					iconSize={14}
					className="flex items-center gap-1 text-slate-500 text-sm hover:underline dark:text-slate-400"
				/>
			</nav>
		</Suspense>
	);
};
