// 이관 후 정규화된 working 본문 2건을 계획 원본으로 되돌린다.
// 기본은 드라이런이며 --apply 를 줘야 쓴다.
import pg from "pg";
import { readFileSync } from "node:fs";

const apply = process.argv.includes("--apply");
const targets = JSON.parse(readFileSync("artifacts/cms/m9/restore-working-bodies.json", "utf8"));
const pool = new pg.Pool({ connectionString: process.env.CMS_DATABASE_URL });
const client = await pool.connect();

try {
	await client.query("BEGIN");
	await client.query("SET LOCAL search_path TO public");

	for (const t of targets) {
		const cur = (await client.query(
			`SELECT mdx, content_hash, schema_version, metadata, search_text, updated_at
			 FROM entry_bodies WHERE entry_id=$1 AND state=$2 FOR UPDATE`,
			[t.entryId, t.state],
		)).rows[0];
		if (!cur) { console.log(`  ⚠️ 대상 없음: ${t.slug}`); continue; }

		const same = cur.mdx === t.mdx && cur.content_hash === t.contentHash;
		console.log(`\n=== ${t.slug} [${t.state}] ${same ? "(이미 동일)" : ""} ===`);
		console.log(`  mdx         : ${cur.mdx.length}자 → ${t.mdx.length}자`);
		console.log(`  content_hash: ${cur.content_hash}`);
		console.log(`              → ${t.contentHash}`);
		console.log(`  search_text : ${cur.search_text.length}자 → ${t.searchText.length}자`);
		console.log(`  metadata 동일: ${JSON.stringify(cur.metadata) === JSON.stringify(t.metadata)}`);
		console.log(`  updated_at  : ${cur.updated_at.toISOString()} → now()`);

		if (apply && !same) {
			const r = await client.query(
				`UPDATE entry_bodies SET metadata=$1, mdx=$2, schema_version=$3, content_hash=$4, updated_at=now(), search_text=$5
				 WHERE entry_id=$6 AND state=$7`,
				[JSON.stringify(t.metadata), t.mdx, t.schemaVersion, t.contentHash, t.searchText, t.entryId, t.state],
			);
			console.log(`  UPDATE rows=${r.rowCount}`);
		}
	}

	if (!apply) {
		console.log("\n[드라이런] 아무것도 쓰지 않았습니다. 실제 적용은 --apply.");
		await client.query("ROLLBACK");
	} else {
		// 사후 검증
		let ok = 0;
		for (const t of targets) {
			const v = (await client.query(`SELECT mdx, content_hash FROM entry_bodies WHERE entry_id=$1 AND state=$2`, [t.entryId, t.state])).rows[0];
			const good = v?.mdx === t.mdx && v?.content_hash === t.contentHash;
			if (good) ok++;
			else console.log(`  ❌ 검증 실패: ${t.slug}`);
		}
		console.log(`\n검증: ${ok}/${targets.length} 일치`);
		if (ok !== targets.length) { await client.query("ROLLBACK"); console.log("불일치 → 롤백했습니다."); }
		else { await client.query("COMMIT"); console.log("커밋했습니다."); }
	}
} catch (e) {
	await client.query("ROLLBACK");
	console.error("오류 → 롤백:", e.message);
	process.exitCode = 1;
} finally {
	client.release();
	await pool.end();
}
