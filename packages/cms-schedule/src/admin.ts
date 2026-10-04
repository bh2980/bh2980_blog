import { defineAdminPlugin } from "@bh2980/cms-admin/plugins";
import { ScheduleProvider } from "./admin/provider";

/** 예약의 관리자 화면 쪽. 편집 화면 발행 메뉴에 "발행 예약"을, 예약이 걸린 글에 안내 띠와 "예약 해제"를 넣는다. */
export default defineAdminPlugin({ Provider: ScheduleProvider });
