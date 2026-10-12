import { headers } from "next/headers";
import Link from "next/link";
import { DEFAULT_LOCALE, isLocale, localizePath } from "@/libs/i18n/locales";
import { translator } from "@/libs/i18n/translate";
import { LOCALE_HEADER } from "@/proxy";

/*
 * 찢긴 종이 가장자리. 위쪽은 배경색, 아래쪽은 muted 색 톱니를 두 겹의 선형 그라디언트로 그린다.
 * 색을 변수로 쓰므로 어두운 화면에서도 그대로 맞는다.
 */
const tornEdgeStyle = {
	height: 16,
	backgroundImage:
		"linear-gradient(135deg, var(--background) 25%, transparent 25%), linear-gradient(225deg, var(--background) 25%, transparent 25%)",
	backgroundSize: "16px 16px",
	backgroundColor: "var(--muted)",
} as const;

/** 없는 주소에서 보이는 "찢겨 나간 쪽". 공개 화면의 404가 함께 쓴다. */
export async function TornPage() {
	const value = (await headers()).get(LOCALE_HEADER);
	const locale = isLocale(value) ? value : DEFAULT_LOCALE;
	const t = translator(locale);

	return (
		<div className="flex flex-1 flex-col">
			<div aria-hidden style={tornEdgeStyle} />
			<div className="mx-auto flex w-full max-w-page flex-1 flex-col items-center px-6 pt-16 pb-24 text-center">
				<h1 className="mb-3 font-bold text-2xl">{t("notFound.title")}</h1>
				<p className="mb-6 text-muted-foreground">{t("notFound.body")}</p>
				<Link
					href={localizePath(locale, "/") as never}
					className="underline underline-offset-[0.3em] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					{t("notFound.home")}
				</Link>
			</div>
		</div>
	);
}
