import Link from "next/link";
import { getAllMemos, categoryLabels, type Memo } from "@/lib/memos";

export default function MemoPage() {
  const memos = getAllMemos();

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
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">메모장 📝</h1>
        <p className="text-lg text-gray-600">
          알고리즘 풀이, CSS 트릭, 간단한 개념 정리 등 작은 메모들을 모아둡니다.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memos.map((memo) => (
          <article
            key={memo.slug}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-all hover:border-gray-300"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(
                  memo.category
                )}`}
              >
                {categoryLabels[memo.category]}
              </span>
              <time className="text-xs text-gray-500">
                {new Date(memo.date).toLocaleDateString("ko-KR", {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </div>

            <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
              <Link
                href={`/memo/${memo.slug}`}
                className="hover:text-blue-600 transition-colors"
              >
                {memo.title}
              </Link>
            </h2>

            <p className="text-gray-600 text-sm mb-4 line-clamp-3">
              {memo.excerpt}
            </p>

            <div className="flex flex-wrap gap-1 mb-4">
              {memo.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                >
                  #{tag}
                </span>
              ))}
              {memo.tags.length > 3 && (
                <span className="text-xs text-gray-400">
                  +{memo.tags.length - 3}
                </span>
              )}
            </div>

            <Link
              href={`/memo/${memo.slug}`}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              자세히 보기 →
            </Link>
          </article>
        ))}
      </div>

      {memos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">아직 작성된 메모가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
