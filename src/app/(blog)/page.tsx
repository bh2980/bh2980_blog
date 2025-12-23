import Link from "next/link";
import { getAllPosts } from "@/libs/posts";
import { getAllMemos } from "@/libs/memos";
import { getAllSeries } from "@/libs/series";

type PostSummary = {
  slug: string;
  category: string;
  createdAt: string | number | Date;
  title: string;
  excerpt: string;
  tags: string[];
};

type MemoSummary = {
  slug: string;
  category: string;
  createdAt: string | number | Date;
  title: string;
  tags: string[];
};

type SeriesSummary = {
  slug: string;
  title: string;
  description: string;
  createdAt: string | number | Date;
  postSlugs: string[];
};

export default function Home() {
  const posts = getAllPosts() as PostSummary[];
  const memos = getAllMemos() as MemoSummary[];
  const series = getAllSeries() as SeriesSummary[];
  const recentPosts = posts.slice(0, 3);
  const recentMemos = memos.slice(0, 4);
  const recentSeries = series.slice(0, 2);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Section */}
      <section className="text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 dark:text-gray-100">안녕하세요, bh2980입니다 👋</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto dark:text-gray-300">
          개발하면서 배운 것들과 경험을 공유하는 공간입니다.
        </p>
        <Link
          href="/posts"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
        >
          블로그 둘러보기
        </Link>
      </section>

      {/* Recent Posts */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">최근 게시글</h2>
          <Link
            href="/posts"
            className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-500 dark:hover:text-blue-600"
          >
            전체 보기 →
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recentPosts.length > 0 ? (
            recentPosts.map((post) => (
              <Link key={post.slug} href={`/posts/${post.slug}`} className="block">
                <article className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-gray-300 transition-all flex flex-col h-full dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {post.category}
                    </span>
                    <p className="text-gray-600 text-sm dark:text-gray-400">
                      {new Date(post.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-500">
                    {post.title}
                  </h3>
                  <p className="text-gray-700 leading-relaxed mb-4 flex-1 dark:text-gray-300">{post.excerpt}</p>
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
                      >
                        #{tag}
                      </span>
                    ))}
                    {post.tags.length > 3 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">+{post.tags.length - 3}</span>
                    )}
                  </div>
                </article>
              </Link>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400">작성된 게시글이 없습니다.</p>
          )}
        </div>
      </section>

      {/* Recent Series */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">최근 묶음글</h2>
          <Link
            href="/series"
            className="text-indigo-600 hover:text-indigo-700 font-medium dark:text-indigo-500 dark:hover:text-indigo-600"
          >
            전체 보기 →
          </Link>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {recentSeries.length > 0 ? (
            recentSeries.map((seriesItem) => (
              <Link key={seriesItem.slug} href={`/series#${seriesItem.slug}`} className="block">
                <article className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-gray-300 transition-all dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium dark:bg-indigo-900/30 dark:text-indigo-400">
                      묶음글
                    </span>
                    <time className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(seriesItem.createdAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-gray-100">{seriesItem.title}</h3>

                  <p className="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-3 dark:text-gray-300">
                    {seriesItem.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <svg className="mr-1 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                        />
                      </svg>
                      {seriesItem.postSlugs.length}개 게시글
                    </div>
                    <span className="text-xs text-indigo-600 font-medium dark:text-indigo-500">묶음글 보기 →</span>
                  </div>
                </article>
              </Link>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400">작성된 묶음글이 없습니다.</p>
          )}
        </div>
      </section>

      {/* Recent Memos */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">최근 메모</h2>
          <Link
            href="/memo"
            className="text-blue-600 hover:text-blue-700 font-medium dark:text-blue-500 dark:hover:text-blue-600"
          >
            전체 보기 →
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recentMemos.length > 0 ? (
            recentMemos.map((memo) => (
              <Link key={memo.slug} href={`/memo/${memo.slug}`} className="block">
                <article className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                      {memo.category}
                    </span>
                    <time className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(memo.createdAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>

                  <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 dark:text-gray-100">
                    {memo.title}
                  </h3>

                  <div className="flex flex-wrap gap-1">
                    {memo.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
                      >
                        #{tag}
                      </span>
                    ))}
                    {memo.tags.length > 2 && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">+{memo.tags.length - 2}</span>
                    )}
                  </div>
                </article>
              </Link>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400">작성된 메모가 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}
