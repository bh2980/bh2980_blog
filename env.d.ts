declare namespace NodeJS {
	interface ProcessEnv {
		HOST_URL: string;

		CMS_DATABASE_URL: string;
		CMS_TEST_DATABASE_URL?: string;
		CMS_TEST_DATABASE_ALLOW_SCHEMA_CREATE?: string;
		/** 기본 스키마(`public`)를 바꾼다. 미리보기/스테이징에서 같은 DB를 나눠 쓸 때 쓴다. */
		CMS_SCHEMA?: string;

		AUTH_SECRET: string;
		AUTH_GITHUB_ID: string;
		AUTH_GITHUB_SECRET: string;
		AUTH_URL: string;
		AUTH_TRUST_HOST?: string;
		CMS_ADMIN_GITHUB_ID: string;
		/** 로컬 개발환경 한정 관리자 인증 우회. development 에서 "1"일 때만 유효. */
		CMS_DEV_AUTH_BYPASS?: string;

		CMS_R2_ACCOUNT_ID: string;
		CMS_R2_ACCESS_KEY_ID: string;
		CMS_R2_SECRET_ACCESS_KEY: string;
		CMS_R2_BUCKET: string;
		CMS_R2_ENDPOINT: string;
		CMS_R2_PUBLIC_BASE_URL: string;

		/**
		 * 개발 전용 가짜 AI 연결(v2 D). "1"이면 키 없이 정해진 답을 준다. production에서는 무시한다.
		 * 실제 서비스 연결(주소·키·모델)은 관리자 AI 화면에서 넣는다.
		 */
		CMS_AI_FAKE?: string;

		GSC_VERIFICATION_TOKEN: string;
	}
}
