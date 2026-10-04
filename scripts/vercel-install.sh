#!/bin/sh
# Vercel 설치 단계. Monti는 비공개 저장소라, 읽기 토큰이 있으면 git 주소에 걸어 둔 뒤 설치한다.
if [ -n "$MONTI_READ_TOKEN" ]; then
  git config --global url."https://x-access-token:${MONTI_READ_TOKEN}@github.com/monti-cms/".insteadOf "https://github.com/monti-cms/"
fi
pnpm install
