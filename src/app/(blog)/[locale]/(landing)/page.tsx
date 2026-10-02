import type { Metadata } from "next";
import { HomeView, homeMetadata } from "../../_views/home";
import { type LocaleParams, prefixedLocale } from "../locale-param";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
	return homeMetadata(prefixedLocale((await params).locale));
}

export default async function LocalizedHome({ params }: LocaleParams) {
	return <HomeView locale={prefixedLocale((await params).locale)} />;
}
