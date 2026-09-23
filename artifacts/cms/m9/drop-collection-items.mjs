// 레거시 모음집(type-challenges)의 memo itemIds를 버린다 (사용자 결정 B, M9).
//
// CMS-SPEC §6: itemIds는 게시글(post)만을 대상으로 한다. 원본 YAML의 관계는 레거시
// `meta.wiki.memo`(memo)라서 규격에 맞출 수 없다. 공개 소비자가 없어 화면 영향은 0이다.
//
// 기본은 드라이런이며 --apply 를 줘야 쓴다.
// content_hash 알고리즘은 content-service.ts:356 과 같다:
//   sha256(JSON.stringify(["cms-snapshot-v1", schemaVersion, sortKeys(metadata), mdx]))
import pg from "pg";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const apply = process.argv.includes("--apply");
const SLUG = "type-challenges";

const sortKeys = (obj) => {
	if (obj === null || typeof obj !== "object") return obj;
	if (Array.isArray(obj)) return obj.map(sortKeys);
	return Object.keys(obj)
		.sort()
		.reduce((acc, key) => {
			if (obj[key] !== undefined) acc[key] = sortKeys(obj[key]);
			return acc;
		}, {});
};
const contentHashOf = (schemaVersion, metadata, mdx) =>
	createHash("sha256").update(JSON.stringify(["cms-snapshot-v1", schemaVersion, sortKeys(metadata), mdx])).digest("hex");

const pool = new pg.Pool({ connectionString: process.env.CMS_DATABASE_URL });
const client = await pool.connect();

try {
	await client.query("BEGIN");
	await client.query("SET LOCAL search_path TO public");

	const entry = (
		await client.query(
			`SELECT e.id, a.slug FROM entries e
			 JOIN content_addresses a ON a.entry_id = e.id AND a.type = 'current'
			 WHERE e.collection = 'collection' AND a.slug = $1`,
			[SLUG],
		)
	).rows[0];
	if (!entry) throw new Error(`모음집을 찾을 수 없습니다: ${SLUG}`);
	console.log(`모음집 ${SLUG} = ${entry.id}\n`);

	const bodies = (
		await client.query(
			`SELECT state, metadata, mdx, schema_version, content_hash, search_text
			 FROM entry_bodies WHERE entry_id = $1 ORDER BY state`,
			[entry.id],
		)
	).rows;

	const plan = [];
	let hashSelfCheck = 0;

	for (const b of bodies) {
		// 자체 검증: 현재 DB 값으로 해시를 다시 계산해 저장된 값과 같은지 확인한다.
		const recomputed = contentHashOf(b.schema_version, b.metadata, b.mdx);
		const selfOk = recomputed === b.content_hash;
		if (selfOk) hashSelfCheck++;

		const { itemIds, ...rest } = b.metadata;
		const newMetadata = rest;
		const newHash = contentHashOf(b.schema_version, newMetadata, b.mdx);

		console.log(`=== [${b.state}] 해시 재계산 일치: ${selfOk ? "예" : "❌ 아니오"} ===`);
		console.log(`  metadata : ${JSON.stringify(b.metadata)}`);
		console.log(`          → ${JSON.stringify(newMetadata)}`);
		console.log(`  버리는 itemIds: ${Array.isArray(itemIds) ? `${itemIds.length}개` : "(없음)"}`);
		console.log(`  hash     : ${b.content_hash}`);
		console.log(`          → ${newHash}`);
		console.log(`  search_text: ${b.search_text.length}자 (변경 없음, mdx에서 파생)\n`);

		plan.push({ state: b.state, metadata: newMetadata, mdx: b.mdx, schemaVersion: b.schema_version, newHash, hadItemIds: Array.isArray(itemIds) });
	}

	const refs = (
		await client.query(`SELECT state, kind, target_id, occurrences FROM entry_references WHERE entry_id = $1 ORDER BY state, kind`, [
			entry.id,
		])
	).rows;
	console.log(`=== 참조 ${refs.length}행 (전부 삭제 대상) ===`);
	for (const r of refs) console.log(`  [${r.state}] ${r.kind} → ${r.target_id} (occurrences ${r.occurrences.length})`);

	if (hashSelfCheck !== bodies.length) {
		throw new Error(`해시 재계산이 ${hashSelfCheck}/${bodies.length}만 일치 — 알고리즘 불일치로 중단`);
	}

	if (!apply) {
		console.log("\n[드라이런] 아무것도 쓰지 않았습니다. 실제 적용은 --apply.");
		await client.query("ROLLBACK");
	} else {
		writeFileSync(
			"artifacts/cms/m9/drop-collection-items.json",
			JSON.stringify({ slug: SLUG, entryId: entry.id, before: bodies.map((b) => ({ state: b.state, metadata: b.metadata, contentHash: b.content_hash })), references: refs }, null, 2),
		);
		console.log("\n이전 값 기록: artifacts/cms/m9/drop-collection-items.json");

		for (const p of plan) {
			const r = await client.query(
				`UPDATE entry_bodies SET metadata = $1, content_hash = $2, updated_at = now()
				 WHERE entry_id = $3 AND state = $4`,
				[JSON.stringify(p.metadata), p.newHash, entry.id, p.state],
			);
			console.log(`  UPDATE [${p.state}] rows=${r.rowCount}`);
		}
		const d = await client.query(`DELETE FROM entry_references WHERE entry_id = $1`, [entry.id]);
		console.log(`  DELETE references rows=${d.rowCount}`);

		// 사후 검증
		let ok = 0;
		for (const p of plan) {
			const v = (await client.query(`SELECT metadata, content_hash FROM entry_bodies WHERE entry_id=$1 AND state=$2`, [entry.id, p.state])).rows[0];
			if (v && v.content_hash === p.newHash && !("itemIds" in v.metadata)) ok++;
		}
		const refLeft = (await client.query(`SELECT count(*)::int AS n FROM entry_references WHERE entry_id=$1`, [entry.id])).rows[0].n;
		const total = (await client.query(`SELECT count(*)::int AS n FROM entry_bodies`)).rows[0].n;
		console.log(`\n검증: 본문 ${ok}/${plan.length} itemIds 제거·해시 일치 / 남은 참조 ${refLeft}행 / 전체 본문 ${total}행`);
		if (ok !== plan.length || refLeft !== 0) {
			await client.query("ROLLBACK");
			console.log("검증 실패 → 롤백했습니다.");
			process.exitCode = 1;
		} else {
			await client.query("COMMIT");
			console.log("커밋했습니다.");
		}
	}
} catch (e) {
	await client.query("ROLLBACK");
	console.error("오류 → 롤백:", e.message);
	process.exitCode = 1;
} finally {
	client.release();
	await pool.end();
}
