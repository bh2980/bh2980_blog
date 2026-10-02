import { cmsServerConfig } from "../../server/resolved";

/** `cms:db:migrate`. 서버 설정(`cms.server.ts`)의 저장소에 표를 만들거나 최신 모양으로 맞춘다. */
async function main() {
	const { database } = cmsServerConfig;
	console.log(`Starting CMS database migration (${database.name})...`);
	try {
		await database.migrate();
		console.log("CMS database migration completed successfully!");
	} catch (err) {
		console.error("Migration failed:", err);
		process.exitCode = 1;
	} finally {
		await database.close?.();
	}
}

main();
