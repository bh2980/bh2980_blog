# @bh2980/cms-schedule

`@bh2980/cms`의 발행 예약 확장. 편집 화면 발행 단추의 화살표 메뉴에 "발행 예약"을 더하고, 예약이 걸린 글은 편집을 잠근다.
정해진 시각에 실제로 발행하는 일은 외부 실행기(크론 등)가 맡는다. CMS는 실행기를 돌리지 않는다.

## 등록

```ts
// cms.config.ts
import { schedule } from "@bh2980/cms-schedule";

export default defineConfig({
	// …
	plugins: [schedule()], // 실행기 토큰 환경 변수 이름을 바꾸려면 schedule({ tokenEnv: "MY_TOKEN" })
});
```

`cms migrate`가 예약 표(`schedules`)를 만든다. 예전 본체 예약 표가 있으면 그대로 이어 쓴다.

## 동작

- **예약**: 저장된 초안을 발행 검사한 뒤 미래 시각으로만 예약한다. 글마다 대기 예약은 하나다.
- **잠금**: 예약이 걸린 동안 본문·속성을 고칠 수 없고(폴더 이동은 된다), 일괄 상태 변경도 막힌다. 편집 화면은 읽기 전용이고 발행 단추 자리에 "예약 해제"가 있다.
- **취소**: 직접 발행·보관·휴지통으로 보내면 대기 예약이 취소된다.
- **실행**: 실행 때 발행 검사를 다시 한다. 실패하면 공개본을 그대로 두고 실패 이유를 남기며, 편집 화면에 알린다. 같은 예약을 두 번 실행해도 다시 발행하지 않는다.

## 실행기 연결

서버 환경 변수 `CMS_SCHEDULER_TOKEN`(또는 `tokenEnv`로 정한 이름)에 긴 무작위 값을 넣고, 실행기가 몇 분마다 아래를 부르게 한다.

```sh
# 지금 실행할 예약 목록
curl -H "Authorization: Bearer $CMS_SCHEDULER_TOKEN" https://example.com/api/cms/v1/schedules/due
# 예약 하나 실행
curl -X POST -H "Authorization: Bearer $CMS_SCHEDULER_TOKEN" https://example.com/api/cms/v1/schedules/<예약 ID>/publish
```

토큰이 없으면 실행 API는 403이고, 예약 창과 안내 띠가 "외부 실행기 연결 필요"를 알린다. 묻는 간격만큼 예약 시각보다 늦게 발행된다.

## 본체 확장점

본체 기능을 고치지 않고 아래 확장점만 쓴다. 다른 확장도 같은 방법으로 글을 잠그거나 발행 메뉴에 항목을 더할 수 있다.

- 서버 `entryHooks`: `locked`(대기 예약이 있는 글), `afterStatusChange`(발행·보관·휴지통이면 예약 취소)
- 본체 저장소의 트랜잭션 작업: `lockEntryInTransaction`·`validateForPublishInTransaction`·`publishInTransaction`
- 관리자 `entryActions`: 발행 메뉴 항목·안내 띠·잠긴 동안의 단추(`예약 해제`)·예약 창
