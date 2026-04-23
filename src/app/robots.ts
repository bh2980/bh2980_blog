import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/keystatic/", "/api/", "/preview"],
		},
		sitemap: `${process.env.HOST_URL}/sitemap.xml`,
	};
}
