import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMemoBySlug,
  getAllMemos,
  categoryLabels,
  type Memo,
} from "@/lib/memos";

interface MemoPostProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const memos = getAllMemos();
  return memos.map((memo) => ({
    slug: memo.slug,
  }));
}

export default async function MemoPost({ params }: MemoPostProps) {
  const { slug } = await params;
  const memo = getMemoBySlug(slug);

  if (!memo) {
    notFound();
  }

  const getCategoryBadgeColor = (category: Memo["category"]) => {
    const colors = {
      algorithm: "bg-green-100 text-green-800",
      "css-battle": "bg-purple-100 text-purple-800",
      typescript: "bg-blue-100 text-blue-800",
      etc: "bg-gray-100 text-gray-800",
    };
    return colors[category];
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* 뒤로 가기 링크 */}
      <div className="mb-8">
        <Link
          href="/memo"
          className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
        >
          <svg
            className="mr-1 w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          메모장으로 돌아가기
        </Link>
      </div>

      <article className="prose prose-lg max-w-none">
        {/* 메모 헤더 */}
        <header className="mb-12 pb-8 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${getCategoryBadgeColor(
                memo.category
              )}`}
            >
              {categoryLabels[memo.category]}
            </span>
            <time className="text-gray-500">
              {new Date(memo.date).toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {memo.title}
          </h1>

          <div className="flex flex-wrap gap-2">
            {memo.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </header>

        {/* 메모 내용 */}
        <div className="prose prose-lg prose-gray max-w-none">
          {/* 임시로 마크다운을 그대로 표시 - 나중에 MDX 또는 Notion API로 교체 */}
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
            {memo.content}
          </div>
        </div>
      </article>

      {/* 네비게이션 */}
      <div className="mt-16 pt-8 border-t border-gray-200">
        <div className="flex justify-between">
          <Link
            href="/memo"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← 모든 메모 보기
          </Link>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            홈으로 가기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
