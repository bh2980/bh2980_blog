import { reader } from "@/keystatic/utils/reader";
import Link from "next/link";

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

const isDefined = <T extends any>(value: T | undefined | null): value is T => {
  return value !== undefined && value !== null;
};

export default async function MemoPage() {
  const [allMemos, allMemoCategories, allTags] = await Promise.all([
    reader.collections.memo.all(),
    reader.collections.memoCategory.all(),
    reader.collections.tag.all(),
  ]);

  const categoryMap = new Map(
    allMemoCategories.map((category) => [category.slug, { ...category.entry, slug: category.slug }])
  );
  const tagMap = new Map(allTags.map((tag) => [tag.slug, { name: tag.entry.name, slug: tag.slug }]));

  const memoList = allMemos
    .map((memo) => {
      const { entry, slug } = memo;

      const category = categoryMap.get(entry.category);

      const tags = (entry.tags || [])
        .filter((tagSlug): tagSlug is string => !!tagSlug)
        .map((tagSlug) => tagMap.get(tagSlug))
        .filter(isDefined);

      const publishedDate = new Date(memo.entry.publishedDate).toLocaleString("ko-KR", { dateStyle: "short" });

      return {
        slug,
        title: entry.title,
        content: entry.content,
        publishedDate,
        category,
        tags,
      };
    })
    .filter((memo): memo is Expand<Omit<typeof memo, "category"> & { category: NonNullable<typeof memo.category> }> =>
      isDefined(memo.category)
    )
    .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());

  const categoryList = Array.from(categoryMap, (v) => v[1]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 dark:text-gray-100">메모장 📝</h1>
        <p className="text-lg text-gray-600 mb-8 dark:text-gray-300">
          알고리즘 풀이, CSS 트릭, 간단한 개념 정리 등 작은 메모들을 모아둡니다.
        </p>

        {/* 카테고리 필터 탭 */}
        <div className="flex flex-wrap gap-2 mb-8">
          <div className="px-4 rounded-full text-sm flex justify-center items-center font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <span className="w-2 h-2 opacity-70 bg-black rounded-full mr-2 inline-block" />
            <span className="inline-block">전체</span>
          </div>
          {categoryList.map((category) => (
            <div
              key={category.slug}
              className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <span
                className="w-2 h-2 opacity-70 rounded-full mr-2 inline-block"
                style={{ backgroundColor: `${category.color}` }}
              />
              <span className="inline-block">{category.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        {memoList.map((memo) => (
          <Link key={memo.slug} href={`/memo/${memo.slug}`} className="block">
            <article className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md hover:border-gray-300 transition-all flex flex-col h-full dark:bg-gray-900 dark:border-gray-800 dark:hover:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  {memo.category.name}
                </span>
                <time className="text-xs text-gray-500 dark:text-gray-400">{memo.publishedDate}</time>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 dark:text-gray-100">{memo.title}</h2>

              <div className="flex flex-wrap gap-1 mt-auto">
                {memo.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag.name}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded dark:bg-gray-800 dark:text-gray-400"
                  >
                    #{tag.name}
                  </span>
                ))}
                {memo.tags.length > 3 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">+{memo.tags.length - 3}</span>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>

      {memoList.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg dark:text-gray-400">아직 작성된 메모가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
