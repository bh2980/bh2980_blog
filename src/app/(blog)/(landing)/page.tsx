import type { Metadata } from "next";
import { DEFAULT_LOCALE } from "@/libs/i18n/locales";
import { HomeView, homeMetadata } from "../_views/home";

export const dynamic = "force-dynamic";

export function generateMetadata(): Promise<Metadata> {
	return homeMetadata(DEFAULT_LOCALE);
}

export default function Home() {
	return <HomeView locale={DEFAULT_LOCALE} />;
}
