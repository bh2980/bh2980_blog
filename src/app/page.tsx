import Link from "next/link";
import { getAllPosts } from "@/lib/posts";
import { getAllMemos, categoryLabels, type Memo } from "@/lib/memos";

export default function Home() {
  const posts = getAllPosts();
  const memos = getAllMemos();
  const recentPosts = posts.slice(0, 3);
  const recentMemos = memos.slice(0, 4);

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
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          안녕하세요, bh2980입니다 👋
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          개발하면서 배운 것들과 경험을 공유하는 공간입니다. 주로 React,
          Next.js, TypeScript에 대해 다룹니다.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/blog"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            블로그 둘러보기
          </Link>
          <Link
            href="/memo"
            className="inline-block bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            메모장 구경하기
          </Link>
        </div>
      </section>

      {/* Recent Posts */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">최근 포스트</h2>
          <Link
            href="/blog"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            전체 보기 →
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recentPosts.map((post) => (
            <article
              key={post.slug}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link
                  href={`/blog/${post.slug}`}
                  className="hover:text-blue-600"
                >
                  {post.title}
                </Link>
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                {new Date(post.date).toLocaleDateString("ko-KR")}
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                {post.excerpt}
              </p>
              <div className="flex flex-wrap gap-1">
                {post.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded font-medium"
                  >
                    #{tag}
                  </span>
                ))}
                {post.tags.length > 3 && (
                  <span className="text-xs text-gray-400">
                    +{post.tags.length - 3}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Recent Memos */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">최근 메모</h2>
          <Link
            href="/memo"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            전체 보기 →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recentMemos.map((memo) => (
            <article
              key={memo.slug}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
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

              <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                <Link
                  href={`/memo/${memo.slug}`}
                  className="hover:text-blue-600"
                >
                  {memo.title}
                </Link>
              </h3>

              <div className="flex flex-wrap gap-1">
                {memo.tags.slice(0, 2).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                  >
                    #{tag}
                  </span>
                ))}
                {memo.tags.length > 2 && (
                  <span className="text-xs text-gray-400">
                    +{memo.tags.length - 2}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
