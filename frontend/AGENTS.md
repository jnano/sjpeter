<!-- BEGIN:nextjs-agent-rules -->
# Next.js 작업 가이드 (frontend/)

이 프로젝트의 Next.js 버전·API·파일 컨벤션은 학습 데이터와 다를 수 있다. 코드 작성 전에 아래 순서를 따른다.

1. **로컬 docs를 1차 출처로 한다.** `node_modules/next/dist/docs/` 의 해당 가이드를 먼저 확인한다. 학습 데이터의 패턴이 현재 버전에서 deprecate 되었는지 점검한다.

2. **Next.js 본래 컨벤션을 기본값으로 한다.** App Router, Server Components, Route Groups, file conventions(`layout.tsx` / `page.tsx` / `loading.tsx` / `error.tsx` / `route.ts` 등), 데이터 페칭·캐싱 규약 등 프레임워크가 정의한 방식을 우선 적용한다.

3. **사용자 지시가 Next.js 본래 방식과 충돌하면 글로벌 규칙을 따른다.** `~/.claude/CLAUDE.md` 의 "개발 툴과의 충돌 대응 규칙"대로 충돌을 먼저 명시하고, 본래 방식에 충실한 대안 2~3개와 추천안을 제시한 뒤 사용자 승인을 받는다. 충돌을 숨긴 채 임의 변형 금지.

4. **Deprecation 경고는 무시하지 않는다.** 빌드·런타임 경고는 즉시 원인을 확인해 해결한다.
<!-- END:nextjs-agent-rules -->
