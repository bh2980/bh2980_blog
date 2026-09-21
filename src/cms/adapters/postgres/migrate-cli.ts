import { Pool } from "pg";
import { migrateContentStore } from "./content-store";

async function main() {
	const connectionString = process.env.CMS_DATABASE_URL;
	if (!connectionString) {
		console.error("CMS_DATABASE_URL is not set in .env.local");
		process.exit(1);
	}
	console.log("Starting CMS database migration on CMS_DATABASE_URL...");
	const pool = new Pool({ connectionString });
	try {
		await migrateContentStore(pool);
		console.log("CMS database migration completed successfully!");
	} catch (err) {
		console.error("Migration failed:", err);
		process.exit(1);
	} finally {
		await pool.end();
	}
}

main();
