import Link from "next/link";
import { getAllPosts } from "@/lib/posts";

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">블로그</h1>
        <p className="text-lg text-gray-600">
          개발하면서 배운 것들과 경험을 기록합니다.
        </p>
      </div>

      <div className="space-y-8">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="bg-white border border-gray-200 rounded-lg p-8 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <time className="text-sm text-gray-500">
                {new Date(post.date).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              <Link
                href={`/blog/${post.slug}`}
                className="hover:text-blue-600 transition-colors"
              >
                {post.title}
              </Link>
            </h2>

            <p className="text-gray-700 leading-relaxed mb-6">{post.excerpt}</p>

            <div className="flex flex-wrap gap-2 mb-6">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>

            <Link
              href={`/blog/${post.slug}`}
              className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
            >
              계속 읽기
              <svg
                className="ml-1 w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </article>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            아직 작성된 포스트가 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
