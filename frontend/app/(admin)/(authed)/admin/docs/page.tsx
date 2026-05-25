"use client";
import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
//  버전 관리: 새 버전 배포 시 CHANGELOG 배열 맨 앞에 항목을 추가하세요.
//  tag: "기능" | "수정" | "디자인" | "인프라"
// ─────────────────────────────────────────────────────────────────────────────
export const CURRENT_VERSION = "1.5.380";
export const LAST_UPDATED = "2026-05-25";

// 버전 규칙:
// - 모든 변경은 patch +1로 누적 (기능/수정 무관)
// - tag로 성격 구분: "기능" | "수정" | "디자인" | "인프라"
// - minor bump (1.5 → 1.6)는 큰 마일스톤에서만
type Tag = "기능" | "수정" | "디자인" | "인프라";

const CHANGELOG: { version: string; date: string; tag: Tag; items: string[] }[] = [
  { version: "1.5.380", date: "2026-05-25", tag: "디자인", items: ["마이페이지를 시안(mypage.html)으로 탭형 통합 — profile-hero(아바타·세례명 pill·관리자/로그아웃 액션)+5탭(대시보드·프로필편집·알림설정·알림함·내가쓴글). 대시보드: KPI 4종(글·댓글·관심분과·안읽은알림 다크카드)·최근활동 피드·저장한 기도(localStorage)·다가오는 행사·올해 활동 차트·계정 카드, 모두 실데이터. 편집/알림/알림함/내글 탭은 기존 페이지를 embedded prop 으로 재사용(단독 라우트 유지)"] },
  { version: "1.5.379", date: "2026-05-25", tag: "디자인", items: ["글쓰기 폼을 시안(board-write.html)으로 — '게시판 글 작성/글쓰기' 헤더·form 카드·라벨 필드(제목·카테고리·내용)·채워진 인풋·점선 업로드 영역·둥근 취소/등록 버튼. MarkdownEditor·파일 업로드 기능 보존"] },
  { version: "1.5.378", date: "2026-05-25", tag: "디자인", items: ["게시글 보기(PostDetail)를 시안(board-view.html)으로 — 제목·작성자·조회·도구 헤더 카드 + 본문/첨부 카드(art-head·art-body 연결). 추천·공유·목록·이전다음·댓글·관리자 액션 기능 보존"] },
  { version: "1.5.377", date: "2026-05-25", tag: "디자인", items: ["게시판 목록을 시안(board.html)으로 재현 — 검색 pill·분절 정렬/보기 토글·전체 N건 메타·목록(테두리 테이블)·카드·사진 그리드 3뷰·페이지네이션. 기능(정렬·뷰·페이지·고정·AI·동영상·작성자·조회) 유지"] },
  { version: "1.5.376", date: "2026-05-25", tag: "디자인", items: ["사목 지표(/vision)를 시안(pastoral.html)으로 재현 — statement-hero(와인 카드·연도·모토·주임신부 pill)·번호 카드(본문 ## ~ #### 섹션 자동 파싱)·맺음 성구(> 인용)·역대 아카이브"] },
  { version: "1.5.375", date: "2026-05-25", tag: "디자인", items: ["기도문 상세를 시안(prayer-detail.html)으로 재현 — 카테고리 pill·대형 제목·기반 성서·대형 본문(빈 줄 단위 단 번호·아멘 분리)·관련 기도·이전다음. 액션바: 저장(localStorage)·글자크기·음성 듣기(TTS)·인쇄·공유"] },
  { version: "1.5.374", date: "2026-05-25", tag: "디자인", items: ["기도문 목록을 시안(prayer.html)으로 재현 — 오늘 추천 기도(today-highlight) 배너·카테고리 칩(점+카운트)·검색·카테고리 그룹 카드(좌측 컬러 보더·성서 출처·저장(localStorage)·공유). 기존 8 카테고리에 시안 색 매핑"] },
  { version: "1.5.373", date: "2026-05-25", tag: "기능", items: ["묵상 반응·공유 바 신설 (시안 .art-foot) — 은혜로워요·되새겨요 반응(회원 로그인 기반, meditation_reactions 테이블)·저장(북마크)·공유·링크복사. 시안 아이콘·배치 그대로, 실천 섹션 다음 배치"] },
  { version: "1.5.372", date: "2026-05-25", tag: "수정", items: ["게시판 목록 500 에러 해소 — 서버 컴포넌트 BoardList 에서 아바타 <img onError>(클라이언트 전용 핸들러)를 직접 렌더해 작성자 사진이 있는 글에서 터지던 문제. onError 부분을 AvatarImg 클라이언트 컴포넌트로 분리"] },
  { version: "1.5.371", date: "2026-05-25", tag: "기능", items: ["글자 크기·인쇄 도구를 정적 소개 페이지(소개·연혁·신부님·수녀님·사목지표·사목협의회·역대 사제 등)에도 적용 — SectionLayout tools 옵션. 본문은 .reading-zoom(zoom)으로 ad-hoc 마크업도 글자 크기 반영"] },
  { version: "1.5.370", date: "2026-05-25", tag: "기능", items: ["글자 크기(Aa)·인쇄 도구 신설 — 시안 meditation 의 원형 버튼 모양·위치 그대로. 글자 크기는 3단계(100/112/125%) 순환(localStorage 유지), 인쇄는 부속 숨김 후 본문만 출력", "묵상(메타 행)·게시판 글·공지 상세에 적용 — 본문(.med-body·.prose) 글자 크기·인쇄 동작"] },
  { version: "1.5.369", date: "2026-05-25", tag: "수정", items: ["접힘 펼치기 '›' 원형 버튼을 펼침 '‹ 메뉴 접기' pill과 같은 자리(콘텐츠 행 좌상단·sticky top-44)로 통일 — 접기/펼치기 전환 시 토글이 제자리 유지"] },
  { version: "1.5.368", date: "2026-05-25", tag: "수정", items: ["스크롤 시 '메뉴 접기' 토글도 사진·메뉴와 함께 따라오도록 — 토글을 sticky 영역 안으로 이동 (섹션 페이지·캘린더). 캘린더는 깨져 있던 사이드바 sticky도 함께 정상화"] },
  { version: "1.5.367", date: "2026-05-25", tag: "수정", items: ["사이드바 sticky 상단 가림 해소 — 스크롤 시 헤더에 브레드크럼 띠가 생겨 높이가 ~158px로 커지는데 오프셋이 112px(top-28)이라 사진 상단이 가려지던 문제. top-44(176px)로 올려 헤더+띠 아래로 여백 확보"] },
  { version: "1.5.366", date: "2026-05-25", tag: "디자인", items: ["시안 스킨일 때 전 페이지 본문을 묵상 기준으로 통일 — body 전역 Pretendard(var(--font-body)) + 한글 장평(palt) + 자간 -0.01em", "본문(.prose·.med-body) 양쪽맞춤(justify) 적용 — 게시판·공지·주보·vision·묵상"] },
  { version: "1.5.365", date: "2026-05-25", tag: "디자인", items: ["시안 원본 폰트 'Pretendard Variable' 로드 (정적→가변, dynamic-subset 으로 사용 글리프만 on-demand) — 시안과 굵기·장평 픽셀 단위로 일치"] },
  { version: "1.5.364", date: "2026-05-25", tag: "디자인", items: ["묵상 본문 글꼴 장평을 시안과 일치 — .med-article 에 font-feature-settings:'palt' 적용(한글·문장부호 비례폭으로 조밀하게)"] },
  { version: "1.5.363", date: "2026-05-25", tag: "디자인", items: ["행사 일정(/calendar)을 시안과 정밀 재현 — date-nav pill·다크 뷰스위치(월주일목록)·카테고리 칩(점+카운트)·월그리드 소프트 이벤트칩·목록/일/주뷰·다가오는 일정 카드 + 모바일 미니캘린더·선택일 상세", "행사 카테고리 7종(행사·모임·봉사·순례·피정·강의·기타) 색 토큰 신설 + admin 구분 드롭다운 확장"] },
  { version: "1.5.362", date: "2026-05-25", tag: "수정", items: ["사이드바 '메뉴 접기' 펼침 토글을 시안 pill 모양으로"] },
  { version: "1.5.361", date: "2026-05-25", tag: "수정", items: ["묵상 본문·인용·실천 글꼴을 시안 Pretendard 로 통일 (Noto Sans 폴백 방지)"] },
  { version: "1.5.360", date: "2026-05-25", tag: "디자인", items: ["주일 말씀 묵상 상세를 시안과 정밀 재현 — eyebrow·큰 제목·저자 메타·복음 인용·드롭캡 본문·풀쿼트·이번 주 실천·이전다음·최근묵상(PC 3단 + 모바일)"] },
  { version: "1.5.359", date: "2026-05-25", tag: "기능", items: ["메뉴 접기 토글 개선 — 펼침 '‹ 메뉴 접기' / 접힘 동그라미 '›'", "묵상 풀쿼트·이번 주 실천 컬럼 + admin 입력 신설"] },
  { version: "1.5.358", date: "2026-05-25", tag: "디자인", items: ["게시판·소개 서브페이지를 시안 톤으로 — 제목 Pretendard, 게시판 고정 핀 와인색"] },
  { version: "1.5.357", date: "2026-05-25", tag: "디자인", items: ["서브페이지 공통 헤더(PageHeader)를 시안 톤으로 — 큰 Pretendard 제목·여백 확대"] },
  { version: "1.5.356", date: "2026-05-24", tag: "디자인", items: ["모바일 시안 3종 재현 — 상단 앱헤더·검색바·하단 탭바(홈/주보/기도/행사/내정보) + 스킨별 본문"] },
  { version: "1.5.355", date: "2026-05-24", tag: "디자인", items: ["editorial·construction 홈을 시안과 픽셀 단위로 재현"] },
  { version: "1.5.354", date: "2026-05-24", tag: "디자인", items: ["서브페이지 본문 폭을 홈·헤더와 동일한 1320px로 확장·정렬"] },
  { version: "1.5.353", date: "2026-05-24", tag: "디자인", items: ["헤더·푸터를 시안 비주얼로 정밀 재현(전 페이지 공통, 동적 메뉴·검색 기능 유지)"] },
  { version: "1.5.352", date: "2026-05-24", tag: "디자인", items: ["dashboard 홈을 시안과 픽셀 단위로 재현 — KPI·월 달력·일러스트·갤러리"] },
  { version: "1.5.351", date: "2026-05-24", tag: "기능", items: ["쇼케이스 스킨 3종 본문 완성", "성전 건축 헌금 모금 기능 신설 — 목표·모금액 admin 입력 + 공개 표시"] },
  { version: "1.5.350", date: "2026-05-24", tag: "디자인", items: ["Claude Design 시안 3종 스킨 추가 — editorial / dashboard / construction"] },
  { version: "1.5.349", date: "2026-05-24", tag: "수정", items: ["구글·카카오 외부 프로필 사진 로드 실패(referrer 차단) 보정"] },
  { version: "1.5.348", date: "2026-05-24", tag: "수정", items: ["스킨 utility 자동 매핑 제거 — opt-in 클래스 방식으로(사진 라운드 부작용 해소)"] },
  { version: "1.5.347", date: "2026-05-24", tag: "수정", items: ["스킨 변경 시 프로필 사진 등 미디어 라운드 깨짐 수정"] },
  { version: "1.5.346", date: "2026-05-24", tag: "수정", items: ["admin/skin 저장 'Not Found' — PATCH 엔드포인트 경로 보정"] },
  { version: "1.5.345", date: "2026-05-24", tag: "기능", items: ["스킨 시스템 1단계 — 디자인 토큰 + 3 프리셋(기본/고전/현대) + admin/skin UI"] },
  { version: "1.5.344", date: "2026-05-24", tag: "디자인", items: ["기도문 아이콘 시각 크기 균형 조정"] },
  { version: "1.5.343", date: "2026-05-24", tag: "디자인", items: ["기도문 아이콘 십자가 크기 조정"] },
  { version: "1.5.342", date: "2026-05-24", tag: "디자인", items: ["기도문 아이콘에 작은 십자가 추가"] },
  { version: "1.5.341", date: "2026-05-24", tag: "기능", items: ["빠른메뉴 '기도문' 아이콘(묵주 형상) 추가"] },
  { version: "1.5.340", date: "2026-05-24", tag: "기능", items: ["빠른메뉴 '성인사전' 아이콘 추가"] },
  { version: "1.5.339", date: "2026-05-24", tag: "디자인", items: ["홈 모바일 전용 섹션 순서 분기(PC 레이아웃 유지)"] },
  { version: "1.5.338", date: "2026-05-24", tag: "디자인", items: ["모바일 검색 placeholder를 '무엇을 찾으시나요?'로 통일"] },
  { version: "1.5.337", date: "2026-05-24", tag: "수정", items: ["모바일 홈 '성전 건축' 카드 중복 노출 수정"] },
  { version: "1.5.336", date: "2026-05-24", tag: "기능", items: ["주보 AI 추출 라우팅 개편 — 공지 묻힘 해소"] },
  {
    version: "1.5.335", date: "2026-05-24", tag: "인프라",
    items: ["백업 사전 작업으로 /admin/docs CHANGELOG v1.5.288~v1.5.334 일괄 동기화"],
  },
  {
    version: "1.5.334", date: "2026-05-24", tag: "수정",
    items: ["갤러리 게시판에서 '목록' 뷰 토글이 안 먹던 버그 — kind='gallery' default 가 photo 라 list 클릭 시 view 파라미터 생략으로 default 복귀"],
  },
  {
    version: "1.5.333", date: "2026-05-24", tag: "수정",
    items: ["사이드바 active 매칭이 글 상세 경로에서 풀리던 버그 — pathname === href 정확 일치만 봐서 /boards/liturgy/691 같은 자식 경로에서 부모 메뉴 강조 안 됨. matchesHref 유틸로 prefix 매칭 통일"],
  },
  {
    version: "1.5.332", date: "2026-05-24", tag: "수정",
    items: ["/boards/[slug] 글쓰기 버튼이 슈퍼관리자에게 안 보이던 회귀 — server-side isOperator 가 session.isAdmin 만 봐서 admin_token cookie 만 가진 슈퍼관리자가 진입 차단"],
  },
  {
    version: "1.5.331", date: "2026-05-24", tag: "디자인",
    items: ["펼치기/접기 표준 hook useCollapseScroll — 접기 시 페이지 최상단으로 부드럽게 스크롤. 향후 공개 페이지 동일 패턴 일관성"],
  },
  {
    version: "1.5.330", date: "2026-05-24", tag: "디자인",
    items: ["/word 복음 본문 3줄 요약 + 펼치기 토글 — 새 client component GospelText, 짧으면 토글 숨김"],
  },
  {
    version: "1.5.329", date: "2026-05-24", tag: "기능",
    items: ["/vision/[id] 사목지표 상세 페이지 신규 — markdown 본문 + 이전/다음 사목지표 네비. /vision 역대 목록 항목 Link 화"],
  },
  {
    version: "1.5.328", date: "2026-05-24", tag: "기능",
    items: ["카톡 알림 = 전화번호 가드 (A,B,C 일괄 적용)",
      "  · (A) /me/interests, /onboarding/interests: phone 없으면 카톡 토글 disabled + 안내",
      "  · (B) fanout select 분리 — 사이트 알림은 phone 무관, 카톡은 phone 있는 회원만. kakao_skipped_no_phone 통계",
      "  · (C) /register, profile PhoneForm 에 '카톡 받으려면 전화번호 필요' 안내"],
  },
  {
    version: "1.5.327", date: "2026-05-23", tag: "기능",
    items: ["알림 발송 중복 차단·실수 가드·모니터링 시스템",
      "  · notification_batches 테이블 신규 — fanout 1회 = 1 row, target_count/site_sent/email_sent/failed_reason",
      "  · 분과 미선택 + notify=true 면 approve/bulkApprove 클릭 시 confirm 가드",
      "  · 중복 알림 사전 경고 — GET /api/bulletins/extractions/{id}/notify-preview, 같은 분과·정규화 제목·14일 batch 매칭 시 노란 인라인 경고",
      "  · /admin/notification-log 모니터링 페이지 + GET /api/admin/notification-batches + /recipients. AdminSidebar 시스템 그룹에 추가"],
  },
  {
    version: "1.5.326", date: "2026-05-23", tag: "디자인",
    items: ["admin sidebar '공동체' 그룹 분리 — '단체·분과'(사목평의회·단체·분과) + '게시판·회원'(게시판 관리·회원 관리)"],
  },
  {
    version: "1.5.325", date: "2026-05-23", tag: "디자인",
    items: ["admin sidebar 그룹 재편 — '페이지·사진·배너' → '페이지·배너', 페이지 사진·메인 사진을 레이아웃 그룹으로 이동"],
  },
  {
    version: "1.5.324", date: "2026-05-23", tag: "수정",
    items: ["SectionLayout 사이드바 스크롤 sticky 복원 — inner div overflow-hidden 이 sticky 컨테이너를 가져가 무력화됐던 것을 wrapper 자체에 sticky 적용"],
  },
  {
    version: "1.5.323", date: "2026-05-23", tag: "기능",
    items: ["마이페이지 3개 sub 페이지로 분리 + 슬림화",
      "  · /members/me/profile: 아바타·이름·세례명·전화·영명축일·비밀번호·탈퇴 (모달 → 페이지)",
      "  · /members/me/posts: 내 글 / 내 댓글 탭",
      "  · /members/me/interests: 분과·단체 + 카톡 알림 + 콘텐츠 알림",
      "  · /members/me 메인은 회원 카드 + 빠른 메뉴 4개 카드. 4개 모두 SectionLayout"],
  },
  {
    version: "1.5.322", date: "2026-05-23", tag: "수정",
    items: ["/members/me·/members/notifications 에 SectionLayout 적용 — admin/menus 에 등록해도 사이드바가 안 붙던 메뉴-사이드바 불변량 위반 해소"],
  },
  {
    version: "1.5.321", date: "2026-05-23", tag: "수정",
    items: ["메뉴 항목 수정 시 '최상위로 이동'·'비활성화' 가 무력화되던 버그 — saveItem 의 ?? fallback 이 null/false 도 fallback 처리해 명시적 값이 무시. 'in body' 체크로 변경"],
  },
  {
    version: "1.5.320", date: "2026-05-23", tag: "기능",
    items: ["vision/meditation 알림도 '원글 삭제' 판정 — 주보 PDF 삭제 케이스",
      "  · notifications.vision_id / meditation_id 컬럼 추가 (FK SET NULL)",
      "  · fanout 시 target_id 채움, 기존 알림은 created_at 기준 backfill",
      "  · 프론트 isDeleted 판정 확장"],
  },
  {
    version: "1.5.319", date: "2026-05-23", tag: "기능",
    items: ["원글 삭제 시 알림 보존 + 삭제됨 표시",
      "  · notifications.post_id/event_id FK CASCADE → SET NULL 마이그레이션",
      "  · 알림함 UI 에 '🗑️ 삭제됨' 뱃지 + line-through 제목 + 클릭 비활성"],
  },
  {
    version: "1.5.318", date: "2026-05-23", tag: "수정",
    items: ["성전건축 단계 사진 업로드 500 — construction.py 3곳에서 phase.title 참조해 AttributeError. phase.name 으로 교체 (모델 컬럼명 일치)"],
  },
  {
    version: "1.5.317", date: "2026-05-23", tag: "수정",
    items: ["AI 추출 검토 '게시판 등록' 시 글이 비공개로 저장되던 버그 — approve_extraction 강제 board_id 경로 is_published=False 가 잘못 박힘"],
  },
  {
    version: "1.5.316", date: "2026-05-23", tag: "기능",
    items: ["알림함 항목 클릭 시 해당 글로 이동 + kind별 라우팅",
      "  · kind=vision/meditation 은 /vision·/meditation, community 는 board_slug 기반",
      "  · backend GET 응답에 board_slug 추가 (posts JOIN boards)"],
  },
  {
    version: "1.5.315", date: "2026-05-23", tag: "기능",
    items: ["AI 추출 검토에서도 사목지표·묵상 등록 시 알림 발송 옵션 — approve-as-vision / approve-as-meditation 에 ?notify=true Query param + 카드 노란 체크박스"],
  },
  {
    version: "1.5.314", date: "2026-05-23", tag: "디자인",
    items: ["마이페이지에서 '관심 콘텐츠 알림' 카드를 '내 관심 분과·단체' 위로 이동"],
  },
  {
    version: "1.5.313", date: "2026-05-23", tag: "기능",
    items: ["사목지표·주일말씀 알림 수신 동의 + 등록 시 fanout",
      "  · members.notify_vision/notify_meditation 컬럼 추가",
      "  · /api/members/me/interests 두 플래그 노출·수정, POST /visions|meditations ?notify=true Query param",
      "  · app/core/content_notify.py 신규 — site notification + 이메일 발송"],
  },
  {
    version: "1.5.312", date: "2026-05-23", tag: "수정",
    items: ["일괄 승인이 ext별 사용자 review 정보(분과·시점·알림) 사용"],
  },
  {
    version: "1.5.311", date: "2026-05-23", tag: "수정",
    items: ["일괄 승인(bulk_approve) 도 분과 자동 매칭·알림 fanout 처리"],
  },
  {
    version: "1.5.310", date: "2026-05-23", tag: "수정",
    items: ["알림 게이트 단순화 — timeless 무조건 통과, future 만 날짜 검사"],
  },
  {
    version: "1.5.309", date: "2026-05-23", tag: "수정",
    items: ["approve-as-event 도 분과 태깅·알림 hook 연결"],
  },
  {
    version: "1.5.308", date: "2026-05-23", tag: "기능",
    items: ["AI 오타 사전에 '제외 prefix' 컨텍스트 예외 추가"],
  },
  {
    version: "1.5.307", date: "2026-05-23", tag: "기능",
    items: ["추출 검토 대기 목록에서 지표·묵상 상단 고정"],
  },
  {
    version: "1.5.306", date: "2026-05-23", tag: "인프라",
    items: ["'+ 분과 추가' → '+ 분과 선택' 라벨 변경"],
  },
  {
    version: "1.5.305", date: "2026-05-23", tag: "기능",
    items: ["묵상도 본당 사목지표와 같은 별도 처리 흐름 — approve-as-meditation endpoint + 검토 UI 인라인 폼"],
  },
  {
    version: "1.5.304", date: "2026-05-23", tag: "수정",
    items: ["주보 결과 화면이 pending 도 '등록 완료'로 표시하던 오해 해소"],
  },
  {
    version: "1.5.303", date: "2026-05-23", tag: "수정",
    items: ["split-by-dates 가 범위 표현·한국어 날짜 인식"],
  },
  {
    version: "1.5.302", date: "2026-05-23", tag: "기능",
    items: ["split-by-dates 시 content 의 비대상 날짜 토큰 제거"],
  },
  {
    version: "1.5.301", date: "2026-05-23", tag: "인프라",
    items: ["'사목지표' → '본당 사목지표' 전반 일괄 교체"],
  },
  {
    version: "1.5.300", date: "2026-05-23", tag: "기능",
    items: ["'사목지표' → '본당 사목지표' 라벨 + 시드 폐기"],
  },
  {
    version: "1.5.299", date: "2026-05-23", tag: "기능",
    items: ["AI 오타 사전 admin UI — 하드코딩에서 DB 로 이전. /admin/bulletin/ai-typos 신규"],
  },
  {
    version: "1.5.298", date: "2026-05-23", tag: "인프라",
    items: ["AI 추출 프롬프트 압축으로 응답 시간 회복 (perf)"],
  },
  {
    version: "1.5.297", date: "2026-05-22", tag: "수정",
    items: ["AI 추출 오타·오역 1차 교정 (프롬프트 보강 + 후처리 사전)"],
  },
  {
    version: "1.5.296", date: "2026-05-22", tag: "수정",
    items: ["추출 검토의 분과 카탈로그 endpoint 잘못된 경로 수정"],
  },
  {
    version: "1.5.295", date: "2026-05-22", tag: "수정",
    items: ["옛 주보 추출 시 AI 의 future 분류를 오늘 기준으로 past 보정"],
  },
  {
    version: "1.5.294", date: "2026-05-22", tag: "기능",
    items: ["분과 태깅·사이트 알림 P4 — 태그 클라우드 + 분과 글 모아보기"],
  },
  {
    version: "1.5.293", date: "2026-05-22", tag: "디자인",
    items: ["분과 페이지 사진을 잘림 없이 표시"],
  },
  {
    version: "1.5.292", date: "2026-05-22", tag: "기능",
    items: ["분과 태깅·사이트 알림 P3 — 회원 알림함 UI (/members/notifications)"],
  },
  {
    version: "1.5.291", date: "2026-05-22", tag: "기능",
    items: ["분과 태깅·사이트 알림 P2 — 검토 UI + 승인 hook (분과 chip·temporal_kind·notify 토글)"],
  },
  {
    version: "1.5.290", date: "2026-05-22", tag: "기능",
    items: ["분과 태깅·사이트 알림 P1 — 모델·마이그레이션·AI 프롬프트 (post_community_targets, event_community_targets, notifications 테이블)"],
  },
  {
    version: "1.5.289", date: "2026-05-22", tag: "기능",
    items: ["홈 블록 빌더 확장 + 사이드바 그룹 합산 배지"],
  },
  {
    version: "1.5.288", date: "2026-05-22", tag: "기능",
    items: ["홈 블록 빌더에 2열 컨테이너(two_column) 블록 추가"],
  },
  {
    version: "1.5.287", date: "2026-05-22", tag: "기능",
    items: [
      "/setup-check 서버 자가진단 페이지 + GET /api/setup/system-check API",
      "  · 호스팅 직후 다른 본당 운영자가 자기 서버가 본 시스템에 적합한지 자가진단 (인증 불필요)",
      "  · 진단 항목 13종: Python·OS·PostgreSQL·메모리·디스크·업로드 쓰기·외부 키 5종·INTERNAL_API_SECRET·SECRET_KEY 강도",
      "  · status 4단계: ok(충족) / warn(권장 미달) / fail(미충족) / info(안내)",
      "  · 페이지: 최소사양 vs 권장사양 fold + 요약 카드(충족/권장미달/미충족) + 항목별 상세 + 다음 단계 6단계 안내",
      "  · 보안: path·hostname·process·IP 등 민감 정보 미노출, 일반 운영 정보만",
      "  · psutil 비의존 — Linux /proc/meminfo + stdlib shutil.disk_usage 만",
    ],
  },
  {
    version: "1.5.286", date: "2026-05-22", tag: "기능",
    items: [
      "이용약관·개인정보 처리방침을 admin/pages 동적 페이지로 전환",
      "  · /terms·/privacy 정적 페이지 제거 → dynamic_pages 테이블 row 2건(slug=terms·privacy, layout_kind=body) 시드",
      "  · admin/pages 에서 편집 가능 — 본당 운영 정책에 맞춰 markdown 본문 직접 수정",
      "  · URL: /p/terms · /p/privacy (기존 /p/[slug] 동적 라우트 활용)",
      "  · register 동의 체크박스와 Footer 링크 모두 /p/terms · /p/privacy 로 변경",
      "  · 정적 페이지는 페이지 추가/수정 시 코드 배포 필요 → 동적 페이지는 admin UI 만으로 즉시 반영",
    ],
  },
  {
    version: "1.5.285", date: "2026-05-22", tag: "기능",
    items: [
      "이용약관·개인정보 처리방침 페이지 + 회원가입 동의 체크박스",
      "  · /terms (이용약관) — 한국 본당 표준 템플릿 10개 조항 (가입·서비스·게시물·탈퇴·변경 등)",
      "  · /privacy (개인정보 처리방침) — 10개 항목 (수집·이용 목적·보유 기간·제3자 제공·위탁·회원 권리·안전성 등)",
      "  · register 페이지에 필수 동의 체크박스 추가 — 체크 안 하면 가입 버튼 비활성, 미동의 시 명시적 에러 메시지",
      "  · 본문에 placeholder 표시: 본당의 실제 운영 정책에 맞춰 검수·수정 필요 (시행일·연락처·DPO 등)",
      "  · Footer 에 '이용약관 | 개인정보 처리방침' 링크 추가 (저작권 표시 위)",
    ],
  },
  {
    version: "1.5.284", date: "2026-05-22", tag: "수정",
    items: [
      "회원 페이지 LOW 보강 2건 — callbackUrl open redirect 차단 + 아바타 업로드 UX",
      "  · login 페이지 callbackUrl 검증 — '/' 시작 + '//' 미시작 (open redirect 회피)",
      "  · 아바타 업로드: frontend 선검사(확장자·5MB) + 실패 시 alert 메시지 + 'JPEG·PNG·GIF·WebP · 5MB 이하' 안내 문구",
    ],
  },
  {
    version: "1.5.283", date: "2026-05-22", tag: "기능",
    items: [
      "회원 가입 직후 자동 로그인 + 온보딩 자동 이동",
      "  · 이전: 가입 성공 → /members/login?registered=1 → 사용자가 다시 이메일·비밀번호 입력 (이중 입력 UX 부담)",
      "  · 새: 가입 성공 → signIn('credentials', ...) 자동 호출 → /onboarding/interests 로 이동 (분과·단체 선택)",
      "  · NextAuth session 직접 박는 경로가 없어 같은 자격으로 signIn 호출 (backend 한 번 더 거치지만 UX 우선)",
      "  · 자동 로그인 실패 시(어떤 이유로든) 기존 /members/login?registered=1 로 fallback",
    ],
  },
  {
    version: "1.5.282", date: "2026-05-22", tag: "수정",
    items: [
      "회원 페이지 UX 일관성 보강 5건",
      "  · 비밀번호 정책 frontend↔backend 통일 — register/reset-password/me 3곳의 validatePassword 와 placeholder 를 backend v1.5.280 정책(영문·숫자·특수 중 2종)에 맞춤. 'abcd1234' frontend 거부됐다가 backend 통과되는 모순 제거",
      "  · 회원 탈퇴 confirm 메시지를 soft delete(v1.5.279) 동작에 맞춤 — '글·댓글 삭제' 오안내 → '탈퇴 회원으로 표시·보존' 정확 안내",
      "  · 비활성 계정 로그인 시 정확한 사유 표시 — NextAuth generic error 대신 backend 직접 호출로 status 403(비활성)·401(자격 불일치) 분기",
      "  · 마이페이지 미로그인 사용자 무한 로딩 차단 — status === 'unauthenticated' 면 /members/login?callbackUrl=/members/me 로 redirect",
      "  · 마이페이지 admin 페이지 이동·로그아웃·탈퇴 시 admin_token cookie 처리 추가 (v1.5.281 도입한 cookie fallback 흐름 일관성)",
    ],
  },
  {
    version: "1.5.281", date: "2026-05-22", tag: "기능",
    items: [
      "회원 시스템 LOW 7·8 — 장기 미접속 필터 + admin_token cookie 인증",
      "  · 7-A: admin/members 페이지에 '3개월+·6개월+·1년+' 미접속 필터 칩 추가. last_login_at NULL(한 번도 로그인 안 함) 도 포함. backend admin/list endpoint 에 inactive_months 쿼리 파라미터",
      "  · 8-A 점진적 1단계: backend get_current_admin·get_current_super_admin 이 admin_token cookie 도 fallback 인식. Authorization Bearer 우선, 없으면 cookie",
      "  · admin login 시 admin_token cookie 도 set (path=/, SameSite=Lax, https 시 Secure). logout 시 admin_token cookie 도 제거",
      "  · 효과: <img>·<a href> 같이 fetch header 못 보내는 요소가 admin guard 라우트 자동 인증 가능 → 향후 bulletin-extracted 같은 라우트의 fetch+blob 우회 단순화 여지",
      "  · 검증: Bearer header → 200, Cookie only → 200, inactive_months=6 필터 정상 동작",
    ],
  },
  {
    version: "1.5.280", date: "2026-05-22", tag: "수정",
    items: [
      "회원 시스템 LOW 보강 3건 — 비밀번호 정책 + avatar magic + CLAUDE.md 동기화",
      "  · 비밀번호 정책: '특수문자 1개 필수' → 영문·숫자·특수문자 중 2종 이상 (8자 기준 유지). 'aaaaaaaa!' 같은 사전 공격 약한 비밀번호 차단, 'abcd1234'(영+숫)는 통과 — 60대 UX 절충",
      "  · avatar 업로드 magic byte 검증: JPEG/PNG/GIF/WebP 매직 바이트 4종 확인. '.jpg' 로 이름만 바꾼 임의 파일 차단",
      "  · CLAUDE.md '관리자 페이지 목록' 표를 사이드바 그룹 순서대로 전면 갱신 (v1.5.274 이후 추가된 20+ admin 페이지 반영)",
    ],
  },
  {
    version: "1.5.279", date: "2026-05-22", tag: "수정",
    items: [
      "회원 시스템 보안 강화 3건 — 출시 전 점검 항목",
      "  · /api/members/social-login 2중 방어: localhost IP 검증 + X-Internal-Secret 헤더 검증. NextAuth 외 직접 호출로 타인 소셜 ID 도용 차단",
      "  · INTERNAL_API_SECRET env 신설 (backend/.env, frontend/.env.local 동일 값). NEXT_PUBLIC_ 접두사 없음 = 브라우저 미노출",
      "  · 회원 탈퇴 hard delete → soft delete: is_active=FALSE + PII NULL + nickname '탈퇴 회원' + email 'deleted-{id}@deleted.local'. 본인 탈퇴(DELETE /me) + admin 삭제(DELETE /admin/{id}) 양쪽 동일. 글·댓글 보존되어 게시판 흐름 끊김 방지 (CLAUDE.md 소프트 삭제 원칙 일치)",
      "  · /api/members/forgot-password timing 균일화: 토큰 생성·이메일 발송을 BackgroundTasks 로 위임 → 회원 존재/미존재 응답 latency 동일 (회원 enumeration 차단). 검증: 두 케이스 모두 ~30ms",
    ],
  },
  {
    version: "1.5.278", date: "2026-05-22", tag: "수정",
    items: [
      "보안 강화 — 주보 PDF 추출 사진을 admin guard 라우트로 분리 (정적 마운트 밖)",
      "  · 저장 위치: uploads/bulletin-extracted/ → private-uploads/bulletin-extracted/ (정적 /uploads 밖)",
      "  · DB: bulletin_extracted_images.file_path 신규 컬럼 (실제 disk 상대 path)",
      "  · 새 라우트: GET /api/bulletins/extracted-images/{id}/file — admin guard + FileResponse",
      "  · file_url 의미 변경: /uploads/... 정적 URL → /api/bulletins/extracted-images/{id}/file admin URL",
      "  · construction/gallery 분류 시 공개 위치(uploads/construction, uploads/attachments)로 복사 (공개 페이지 노출 위해)",
      "  · frontend ExtractedImagesSection: useAuthorizedImage hook 도입 — fetch + Authorization + URL.createObjectURL 로 blob URL 생성, img/a/ImageCropModal 모두 blob URL 사용",
      "  · .gitignore: backend/private-uploads/ 추가",
      "  · 영향: 분류 전 신자 얼굴 사진 등의 URL 추측·XSS 노출 차단",
    ],
  },
  {
    version: "1.5.277", date: "2026-05-22", tag: "수정",
    items: [
      "보안 강화 — 주보 PDF 매직 바이트 검증 + 회원 비밀번호 reset random 발급",
      "  · 주보 업로드 (POST /api/bulletins): content_type 의 application/octet-stream 우회를 막기 위해 첫 5바이트 '%PDF-' 검증 추가",
      "  · PATCH /api/members/admin/{id}/reset-password: 고정값 '0629' 평문 → secrets.token_urlsafe(8) 무작위 임시 패스워드",
      "  · admin/members 페이지: reset 응답의 temp_password 를 1회 alert + 클립보드 복사. 회원에게 안전 경로로 전달 안내",
      "  · /admin/docs API 표 라벨 '0629 초기화' → '임시 발급 (1회 표시)' 갱신",
    ],
  },
  {
    version: "1.5.276", date: "2026-05-22", tag: "수정",
    items: [
      "보안 강화 — JWT SECRET_KEY 가드 + CORS env 분리 + 터널 CORS production 차단",
      "  · SECRET_KEY default 평문 'change-this-in-production' 제거 → 빈 문자열 + length<32 시 startup fail-fast",
      "  · CORS allow_origins 를 코드 박힘 → backend/.env 의 CORS_ORIGINS env 로 분리 (LAN IP·운영 도메인은 .env 에서 관리)",
      "  · ENABLE_TUNNEL_CORS=1 이면서 ENV=production 이면 startup fail-fast (임시 시연용 와일드카드가 운영에 잘못 켜지는 사고 차단)",
    ],
  },
  {
    version: "1.5.275", date: "2026-05-22", tag: "수정",
    items: [
      "주보 AI 분석 무한 'AI 분석 중…' 멈춤 버그 수정",
      "  · 원인: app/services/pdf_extractor.py 에서 extract_embedded_images 함수가 누락되어 background task 가 import 단계에서 ImportError 로 즉시 실패",
      "  · BackgroundTasks 컨텍스트에서 except 분기의 ai_status='failed' 갱신도 commit 되지 못해 processing 상태로 영구 잔존",
      "  · 조치: PyMuPDF 기반으로 extract_embedded_images(pdf_path, min_dim) 복원 — 임베디드 비트맵을 원본 그대로 추출, 중복 xref 제거 + min_dim 미만 아이콘 제외",
      "  · 영향: 주보 PDF 업로드 → AI 추출 + 사진 추출 정상 동작 복구",
    ],
  },
  {
    version: "1.5.274", date: "2026-05-22", tag: "디자인",
    items: [
      "admin 사이드바 '주보 관리'를 독립 대메뉴로 분리 — '소식·일정' 위에 배치",
      "  · 신규 그룹 '주보 관리' (📖): 주보 업로드·목록 / AI 추출 검토 / AI 임시저장 / AI 분류설정 / AI 분석 통계 (children → 평면 5항목)",
      "  · '소식·일정'(📰)에는 공지 관리·본당 일정 관리만 잔존",
      "  · NavItem.exact 옵션 추가 — 하위 경로(/admin/bulletin/extractions 등)에서 '주보 업로드·목록'이 startsWith로 켜지는 active 충돌 방지",
    ],
  },
  {
    version: "1.5.273", date: "2026-05-22", tag: "디자인",
    items: [
      "admin 사이드바 NAV_GROUPS 순서 재정렬 — 사용 빈도·업무 흐름 반영",
      "  · 새 순서: 대시보드 → 성전 건축 → 성당 정보 → 신부님·수녀님 → 말씀·기도 → 소식·일정 → 공동체 → 페이지·사진·배너 → 레이아웃 → 시스템",
      "  · 이전 순서 대비 변경: 말씀·기도가 소식·일정 앞으로, 공동체가 페이지·사진·배너 앞으로 이동",
    ],
  },
  {
    version: "1.5.272", date: "2026-05-21", tag: "디자인",
    items: [
      "admin/members 회원 정보 셀에 이름(본명) 표시 추가",
      "  · 1줄: 이름(있을 때, 굵게·상세 링크) / 2줄: 닉네임=세례명 / 3줄: 이메일 / 4줄: #ID",
      "  · 이름이 없으면 닉네임이 1줄로 올라가 링크 역할 유지 (기존 동작 호환)",
    ],
  },
  {
    version: "1.5.271", date: "2026-05-21", tag: "디자인",
    items: [
      "admin/members 목록 컬럼 6개 의미별 재배치 — 헤더와 셀 내용 일치",
      "  · 새 헤더: 회원 정보 / 가입 / 활동 / 운영자 / 상태 / 관리",
      "  · 회원 정보: 아바타+닉네임+이메일+#ID 통합 (이전엔 닉네임·이메일이 두 열로 분리)",
      "  · 활동: 글 N건 + '마지막 로그인 N일 전' 한 셀로 묶음",
      "  · 운영자: 운영자/일반 배지 + 비밀번호 미설정 경고 분리",
      "  · 상태: 활성/비활성 단일 의미로 정돈",
      "  · grid 비율 재조정: 2.5fr·1fr·1.5fr·0.8fr·0.8fr·auto",
    ],
  },
  {
    version: "1.5.270", date: "2026-05-21", tag: "수정",
    items: [
      "super-admin 전용 영역 5곳 가드 강화 — 운영자(member.is_admin) 접근 차단",
      "  · 백엔드: /api/admin/settings GET/test-smtp, /api/members/admin/{id} GET·PATCH, /api/members/admin/export.csv → super-admin Depends",
      "  · 프론트엔드 admin/settings: 비-super 진입 시 /admin/dashboard 리다이렉트",
      "  · 프론트엔드 admin/members/[id]: 비-super 진입 시 /admin/members 리다이렉트",
      "  · 프론트엔드 admin/members 목록: CSV 다운로드 버튼·닉네임 상세 링크는 isSuper 만 노출(운영자에겐 plain 텍스트)",
      "  · 프론트엔드 admin/docs '변경 이력' 탭: 비-super 면 탭 자체 숨김 + 컴포넌트 미렌더",
      "  · AdminSidebar NavItem.superOnly 필드 도입 — '사이트 설정' 메뉴는 운영자에게 사이드바에서 미노출(그룹 자체가 비면 그룹도 숨김)",
      "  · 운영자 권한 grant/revoke 는 이전부터 super-admin 전용(get_current_super_admin) — 별도 변경 없음",
    ],
  },
  {
    version: "1.5.269", date: "2026-05-21", tag: "기능",
    items: [
      "회원 관리 보강 — 상세 페이지·관리자 수정 API·CSV export·마지막 로그인 추적",
      "  · DB: members.last_login_at TIMESTAMP 추가 (auth.py·members.py 의 모든 로그인 핸들러에서 갱신)",
      "  · GET  /api/members/admin/{id} — 회원 상세 (글·댓글·관심 분과·이메일인증 등 통계 포함)",
      "  · PATCH /api/members/admin/{id} — 관리자가 회원 정보 수정 (이메일·이름·세례명·전화·영명축일)",
      "  · GET  /api/members/admin/export.csv — 필터 조건 그대로 CSV 다운로드 (Excel BOM, audit log 기록)",
      "  · MemberAdminOut 확장: name·phone·is_email_verified·name_day_*·last_login_at 노출",
      "  · admin/members 페이지: CSV 다운로드 버튼, 닉네임 클릭 → 상세, '#id · 마지막 로그인 N일 전' 표시",
      "  · admin/members/[id] 신규: 4개 정보카드(기본정보·계정상태·활동통계·관심 분과) + 인라인 수정 폼",
    ],
  },
  {
    version: "1.5.268", date: "2026-05-21", tag: "디자인",
    items: [
      "admin '페이지 관리' → '페이지 만들기' (사이드바·페이지 H1)",
    ],
  },
  {
    version: "1.5.267", date: "2026-05-21", tag: "디자인",
    items: [
      "'암송할 기도문' 칩을 '전체' 다음으로 — PRAYER_CATEGORIES 배열 맨 앞 이동 (frontend·backend 동기화)",
      "12개 암송 기도문 display_order 재할당 (1~12, 명시 순서대로)",
    ],
  },
  {
    version: "1.5.266", date: "2026-05-21", tag: "기능",
    items: [
      "기도문 카테고리 '암송할 기도문(memorize)' 신설 — 학교사이트 암송 기도문 6건 묶음",
      "  · 반성의 기도·십계명·고백의 기도·삼덕송·봉헌의 기도·부활 삼종기도 → category='memorize'",
      "  · frontend/lib/prayer.ts: PRAYER_CATEGORIES·LABELS·HINTS 에 memorize 추가 (daily 다음 위치)",
      "  · backend/app/api/content.py·models/content.py: 허용 카테고리 리스트에 추가",
    ],
  },
  {
    version: "1.5.265", date: "2026-05-21", tag: "디자인",
    items: [
      "admin '페이지' → '페이지 관리' (사이드바·페이지 H1 동시 적용, H1 의 '동적 페이지' 도 통일)",
    ],
  },
  {
    version: "1.5.264", date: "2026-05-21", tag: "디자인",
    items: [
      "admin 사이드바 '기도문' → '기도문 관리' (페이지 H1 과 일치)",
    ],
  },
  {
    version: "1.5.263", date: "2026-05-21", tag: "디자인",
    items: [
      "admin '행사 캘린더' → '본당 일정 관리' (사이드바·페이지 H1)",
    ],
  },
  {
    version: "1.5.262", date: "2026-05-21", tag: "디자인",
    items: [
      "admin 사이드바 라벨 '주보'·'공지' → '주보 관리'·'공지 관리' (페이지 H1 과 일치)",
    ],
  },
  {
    version: "1.5.261", date: "2026-05-21", tag: "디자인",
    items: [
      "admin '연혁' 라벨 → '연혁 관리' (사이드바 항목·페이지 H1)",
    ],
  },
  {
    version: "1.5.260", date: "2026-05-21", tag: "기능",
    items: [
      "admin/content 의 5개 탭을 개별 라우트로 분리 — 사이드바 항목별 단독 페이지",
      "  · 새 라우트: /admin/vision · /admin/meditation · /admin/history · /admin/council · /admin/community",
      "  · 5개 Tab 컴포넌트(VisionTab 외)에 export 추가, 새 페이지에서 import",
      "  · /admin/content?tab=xxx 는 새 라우트로 client-side replace 리다이렉트 (북마크·외부 링크 호환)",
      "  · AdminSidebar 의 5개 href 를 새 라우트로 갱신 — 사이드바 어떤 항목을 눌러도 자신의 화면만 보임",
      "  · bulletin/[id]/result, docs 안내 내 활성 링크도 새 라우트로 동기화",
    ],
  },
  {
    version: "1.5.259", date: "2026-05-21", tag: "디자인",
    items: [
      "admin 사이드바 그룹 라벨 '배너·사진·페이지' → '페이지·사진·배너' (항목 순서와 일치)",
    ],
  },
  {
    version: "1.5.258", date: "2026-05-21", tag: "디자인",
    items: [
      "admin 사이드바 '배너·사진·페이지' 그룹 항목 순서 재배열",
      "  · 페이지 → 페이지 사진 → 광고 배너 → 메인 사진 (구체 → 광역, 페이지 단위가 먼저)",
    ],
  },
  {
    version: "1.5.257", date: "2026-05-21", tag: "디자인",
    items: [
      "admin 사이드바 '레이아웃' 그룹 신설 — 홈 페이지·메뉴·전례 시기 테마 분리",
      "  · '배너·사진·페이지' 는 콘텐츠 자산만 (메인 사진·광고 배너·페이지 사진·페이지)",
      "  · '레이아웃' 그룹은 사이트 구조 (홈 페이지 블록·메뉴 구성·전례 시기 테마)",
    ],
  },
  {
    version: "1.5.256", date: "2026-05-21", tag: "디자인",
    items: [
      "admin 사이드바 재정리 — 홈 페이지·메뉴·전례 시기 테마를 '배너·사진·페이지' 그룹으로 이동",
      "  · '시스템' 그룹에는 사이트 설정·장애 신고·활동 로그·기술 문서만 잔존",
      "  · 콘텐츠/구조 관리는 한 그룹, 운영/메타는 시스템 그룹으로 역할 분리",
    ],
  },
  {
    version: "1.5.255", date: "2026-05-21", tag: "디자인",
    items: [
      "admin 사이드바 그룹 재정리 — '배너·사진·페이지' 그룹 신설",
      "  · '배너 관리' → '배너·사진·페이지' 로 그룹 라벨 변경 (메인 사진·광고 배너·페이지 사진 포함)",
      "  · '시스템' 그룹의 '동적 페이지' 를 '페이지' 로 라벨 변경 + 새 그룹으로 이동",
      "  · 시각 자료(배너·사진)와 동적 페이지가 한 그룹에 모여 콘텐츠 관리 동선 단축",
    ],
  },
  {
    version: "1.5.254", date: "2026-05-21", tag: "수정",
    items: [
      "admin/settings 에서 HOME_HERO_LAYOUT 항목 숨김 — /admin/home 으로 단일화",
      "  · 홈 hero 레이아웃은 home_blocks 의 hero 블록 payload.layout 이 1순위, settings.HOME_HERO_LAYOUT 은 fallback",
      "  · 같은 옵션이 두 곳에 노출되어 혼란을 유발 → admin/settings 화면에서만 가리기 (DB row·API·fallback 동작 유지)",
      "  · 확장용 HIDDEN_KEYS Set 도입 — 향후 다른 키도 같은 방식으로 가능",
    ],
  },
  {
    version: "1.5.253", date: "2026-05-21", tag: "기능",
    items: [
      "페이지 사진(page-photos) 관리 개선 — admin 사이드바 메뉴 + 사진별 이미지 위치(9방향)",
      "  · admin 사이드바 '배너 관리' 그룹에 '페이지 사진' 메뉴 추가 — 그동안 누락되어 있던 진입점 복원",
      "  · DB: page_photos.image_position VARCHAR(20) DEFAULT 'center' 컬럼 추가 (object-position 9방향)",
      "  · admin/page-photos: 사진 행마다 9방향 위치 그리드 (admin/menus 의 사이드바 이미지와 동일 패턴, 낙관적 업데이트)",
      "  · 공개 PageHeroSlideshow: 1장 정적 / 슬라이드 / 페이드 3경로 모두 <Image style={objectPosition}> 반영",
      "  · 동기: /p/saint 같이 가로형 박스에 세로 인물 사진이 들어가도 머리·얼굴 위치를 어드민에서 직접 맞출 수 있게",
    ],
  },
  {
    version: "1.5.252", date: "2026-05-21", tag: "수정",
    items: [
      "시스템 불변량 강제 — 메뉴 등록 자원은 어떤 상황에서도 사이드바를 가진다",
      "  · 근본 원인: 사이드바 결정권이 두 시스템(menu_items / layout_kind)에 분산 → invariant 위반 가능",
      "  · /api/pages/by-slug 응답에 in_menu 필드 추가 (menu_items 조회로 판정)",
      "  · /p/[slug] 런타임 가드: layout_kind='html' 라도 in_menu=true 면 SectionLayout/PageHeader 강제 wrap",
      "  · admin/pages UI 경고: layout='html' + menu_item_count>0 일 때 amber 경고 박스로 'HTML+레이아웃' 추천",
      "  · CLAUDE.md '핵심 규칙 6' 추가: 메뉴 등록 자원 = 사이드바 필수. 유일한 예외는 /photos (의도된 풀폭)",
      "  · 전체 메뉴 등록 라우트 37개 점검 — invariant 위반 0건 (/p/saint 사례 재현 불가능)",
    ],
  },
  {
    version: "1.5.251", date: "2026-05-21", tag: "기능",
    items: [
      "새 레이아웃 'HTML + 레이아웃' (html_in_layout) — HTML 자유도 + 사이트 일관성",
      "  · 기존 'html' 은 wrapper 없이 raw HTML 만 출력 — 사이드바·PageHeader 없음",
      "  · 신규 'html_in_layout' 은 raw HTML 본문을 PageHeader + SectionLayout(사이드바) 안에 출력",
      "  · admin/pages 레이아웃 picker 에 새 옵션 노출. LAYOUT_SPECS 동적 갱신",
      "  · /p/saint 의 layout_kind 를 'html' → 'html_in_layout' 으로 전환 — 본문 그대로, 사이드바·헤더 자동 추가",
    ],
  },
  {
    version: "1.5.250", date: "2026-05-21", tag: "인프라",
    items: [
      "Stage 6 Part 3 — 모든 admin endpoint audit log 완료 (100% coverage)",
      "  · bulletins.py (16): 업로드·재분석·삭제·추출 승인/거부/편집/분리·이미지 라우팅·crop·delete 등 mutation 전부",
      "  · content.py (32): history/vision/community/static_page/meditation/prayer/council CRUD + 배경 이미지 + 카드 사진 등 전부",
      "  · boards.py 누락 12 보강: move_post·publish_draft_multi·event_mapping·board CRUD·board_admin_group CRUD·allowed_member·delete_board",
      "  · members.py 누락 4 보강: admin_create_member·reset_password·grant_admin·revoke_admin",
      "  · bulletin_routed_counts_batch 1건만 의도적 skip (pure read — count only)",
      "  · Stage 6 누적: 21개 파일 ~170 admin endpoints. admin_logs 에 모든 mutation 기록됨",
    ],
  },
  {
    version: "1.5.249", date: "2026-05-21", tag: "인프라",
    items: [
      "Stage 6 Part 2 — construction·page_photos·archive 감사 로그 추가",
      "  · construction.py (8): phase/journal CRUD + photo upload",
      "  · page_photos.py (8): slug CRUD + photo upload/update/delete + settings + reorder",
      "  · archive.py (9): parish_pastors·parish_priests CRUD + photo upload + restore-to-staff",
      "  · 누적: 12개 파일 65 endpoints 에 log_action 적용",
      "  · 남은 작업 (Part 3~): bulletins(16) + content(32) + members/boards/auth 부분 누락",
    ],
  },
  {
    version: "1.5.248", date: "2026-05-21", tag: "인프라",
    items: [
      "Stage 6 Part 1 — 8개 admin endpoint 파일에 감사 로그 추가",
      "  · saints·setup·issue_reports·transport_routes·home_banner·parish·banners·parish_staff 모두 log_action 적용",
      "  · 모든 create/update/delete/reorder/upload 액션이 admin_logs 에 기록됨",
      "  · setup_init 은 admin 이 아직 없는 시점이라 admin_identifier='setup' 으로 기록",
      "  · 다음 단계 (Part 2~4): construction·page_photos·archive·bulletins·content + members/boards/auth 부분 누락 보강",
    ],
  },
  {
    version: "1.5.247", date: "2026-05-21", tag: "기능",
    items: [
      "홈 블록 빌더 확장 — drag-and-drop + quick_links 편집",
      "  · admin/home 블록 리스트에 HTML5 native drag-and-drop. 드래그 핸들(⠿) + drop indicator(파랑 테두리). ↑↓ 버튼은 접근성용으로 유지",
      "  · quick_links 블록에 items[] 편집기 추가: 라벨·URL·icon_key 행별 편집, +추가 / ×삭제",
      "  · 5개 icon_key 옵션: church·groups·bulletin·cross·construction. page.tsx 의 ICON_BY_KEY 와 동기",
      "  · payload.items 가 비어 있으면 default 3개(성당 안내·분과·주보) 사용 — 기존 시드와 호환",
      "  · grid template column 수가 items 길이에 맞춰 동적 (최대 4열)",
    ],
  },
  {
    version: "1.5.246", date: "2026-05-21", tag: "기능",
    items: [
      "Stage 4 Phase 4+5 — admin/home 블록 빌더 UI + 사이드바 등록",
      "  · admin/home 페이지에 블록 빌더 추가: 9 블록 ↑↓ 재정렬 + ON/OFF 토글 + 추가 + 삭제 + per-block payload 편집",
      "  · 블록 종류별 인라인 폼: hero(layout select 4종) · banner(placement 입력) · quote(text/source 텍스트박스). 나머지 5종은 무옵션",
      "  · 활성 블록 수·순서 즉시 반영 (PATCH/POST/DELETE 마다 setBlocks 갱신)",
      "  · AdminSidebar 시스템 그룹에 '홈 페이지' 항목 첫 번째로 추가",
      "  · 통합 테스트 OK — payload 갱신·is_active 토글·reorder·테마 전환 모두 정상. admin_logs 에 home_block CRUD 기록됨",
    ],
  },
  {
    version: "1.5.245", date: "2026-05-21", tag: "기능",
    items: [
      "Stage 4 Phase 3 — 홈 page.tsx block-driven 리팩토",
      "  · home_blocks 배열 fetch → kind 별 dispatch (8 종류 switch 렌더)",
      "  · hero.payload.layout 이 site_settings.HOME_HERO_LAYOUT 보다 우선",
      "  · 모르는 kind 는 silent skip — admin 이 미구현 종류 만들어도 본문 안 깨짐",
      "  · quick_links / meditation 분리: 각자 독립 섹션 (admin 자유 재정렬)",
    ],
  },
  {
    version: "1.5.244", date: "2026-05-21", tag: "기능",
    items: [
      "Stage 4 Phase 2 — home_blocks 백엔드",
      "  · home_blocks 테이블 (kind·sort_order·is_active·payload jsonb)",
      "  · /api/home/blocks (공개) + admin CRUD + reorder, log_action 감사 로그",
      "  · 8 ALLOWED_KINDS: hero·quick_links·meditation·construction·board_tabs·gallery·banner·quote",
      "  · main.py 시드: 현재 홈과 동일한 default 9 블록 (빈 테이블일 때만)",
    ],
  },
  {
    version: "1.5.243", date: "2026-05-21", tag: "기능",
    items: [
      "Stage 4 Phase 1 — 홈 페이지 테마 시스템 (warm/modern/classic)",
      "  · site_settings.HOME_THEME 추가 (/api/public/site-config 에 노출)",
      "  · home page wrapper 에 data-home-theme=\"...\" 주입. globals.css 에 모던·클래식 CSS 변수 오버라이드",
      "  · /admin/home 신설 — 테마 picker (현재) + 블록 빌더 자리 표시 (다음 phase)",
      "  · 가톨릭 전례 시기 스킨(data-season)과 직교 — 두 스킨 시스템이 독립 동작",
    ],
  },
  {
    version: "1.5.242", date: "2026-05-21", tag: "디자인",
    items: [
      "동적 페이지 레이아웃 스키마 — admin 폼이 layout 별로 동적 구성",
      "  · pages.py 에 LAYOUT_SPECS 추가 — 각 레이아웃이 사용하는 필드(title·subtitle·group_label·body·sections·page_photos) 와 body_format(markdown/html) 명시",
      "  · GET /api/pages/layout-specs 노출 (인증 불필요, 정적 메타)",
      "  · admin/pages: layout-specs fetch 후 currentSpec.uses 로 필드 조건부 렌더 — html 레이아웃은 subtitle·group_label 자동 숨김 (실제로 안 쓰이는 필드라 혼란 제거)",
      "  · 레이아웃 선택 직후 안내 문구 '이 레이아웃은 OO·OO 를 사용합니다' 표시 → 사용자가 무엇을 채워야 할지 즉각 파악",
      "  · 본문 textarea placeholder 도 spec.body_placeholder 에서 동적 — 옛 하드코딩 분기 제거",
    ],
  },
  {
    version: "1.5.241", date: "2026-05-21", tag: "인프라",
    items: [
      "공지사항 통합 완료 — 옛 notices 테이블 잔재 정리",
      "  · v1.5.69 에서 boards/posts 로 어댑터 전환했으나 옛 notices 테이블 3건이 마이그레이션되지 않고 살아 있었음",
      "  · /api/notices/ 가 0건 반환 → 사용자에게 보여야 할 공지가 안 보이는 잠재 버그",
      "  · 누락된 3건을 posts (board.slug='notice') 로 이전. attachments 는 0건이라 손실 없음",
      "  · 옛 notices·notice_attachments 테이블 DROP, app/models/notice.py 제거, app/models/__init__·alembic env.py 임포트 정리",
      "  · main.py 의 옛 DDL·인덱스 블록 제거 (CREATE TABLE notice_attachments·idx_notices_*)",
      "  · onboarding.py: first_notice 체크가 옛 notices 테이블을 보던 것 → posts where board.slug='notice' 로 수정",
      "  · CLAUDE.md 갱신: '공지사항 (notices 테이블 직접 조회)' → '(boards.slug=notice 의 posts)'",
    ],
  },
  {
    version: "1.5.240", date: "2026-05-21", tag: "기능",
    items: [
      "동적 페이지 변수 치환에 배너 추가 — {{ BANNER:slug }} 문법",
      "  · banner_groups 에 slug 컬럼 추가 (unique·nullable) — admin/banners 에서 slug 입력 가능",
      "  · {{ BANNER:my_slug }} → 해당 그룹 첫 이미지를 <img>/<a class=dynamic-banner-image/link> 로 렌더",
      "  · 미발견 slug 는 빈 문자열 (안전 fallback). 본문이 깨지지 않음",
      "  · admin/pages 변수 안내에 BANNER 항목 추가",
      "  · _PATTERN 정규식 확장 — `{{ NAMESPACE:key }}` 형식 지원 (향후 추가 namespace 확장 기반)",
    ],
  },
  {
    version: "1.5.239", date: "2026-05-21", tag: "인프라",
    items: [
      "감사 로그 확대 — menus·notices CRUD 도 admin_logs 기록",
      "  · menus.py: 13개 endpoint (그룹·항목 CRUD + 이미지 업로드/삭제 + reorder/move) 전부 log_action 추가. target_type='menu_group'|'menu_item'",
      "  · notices.py: 5개 endpoint (CRUD + 첨부 업로드/삭제) 전부 log_action 추가. target_type='notice'",
      "  · 효과: 메뉴 라벨 변경·메뉴 항목 삭제·공지 삭제 모두 admin/logs 에서 시간순 추적 가능. 'test/새내기' 사례 같은 데이터 미스터리 재발 방지",
      "  · 별도 보고: 전체 점검 결과 15개 endpoint 파일(content·bulletins·archive·banners·construction·parish·parish_staff·page_photos·home_banner·saints·settings_api·setup·transport_routes·issue_reports·일부 boards·members)이 audit log 미적용 — 다음 단계에서 점검 예정",
    ],
  },
  {
    version: "1.5.238", date: "2026-05-21", tag: "인프라",
    items: [
      "동적 페이지 안전장치 — admin 감사 로그 + 고아 페이지 가시화",
      "  · 원인: 'test/새내기' 처럼 사용자가 삭제 의도였는데도 9일간 살아남은 사례 추적 결과, pages.py CRUD 가 admin_logs 에 기록하지 않아 사용자가 본인 작업 결과를 검증할 방법 자체가 없었음",
      "  · Fix A: pages.py create/update/delete 에 log_action 호출 추가 (events·boards·members 와 같은 패턴). admin_logs.target_type='dynamic_page' 로 추적 가능",
      "  · Fix B: GET /api/pages/admin/all 에 menu_item_count 포함 → admin/pages 목록 각 항목에 '⚠ 메뉴 미연결' (빨강) 또는 '메뉴 N곳' (회색) 뱃지 표시. menu_items.href = '/p/{slug}' 매칭으로 카운트",
      "  · 효과: 어느 페이지가 사이드바·헤더에서 접근 불가한 '고아' 인지 한눈에 식별 가능. 삭제 의도 vs 실제 결과 격차도 admin_logs 로 사후 확인",
    ],
  },
  {
    version: "1.5.237", date: "2026-05-21", tag: "인프라",
    items: [
      "라벨 일관성 정리 — '본당 가족'·'세종성베드로성당' 하드코딩 제거",
      "  · '본당 가족' → '현재 사목자' (parish_staff·photos·archive·onboarding·main.py·CLAUDE.md·pastor 페이지)",
      "  · '본당 가족' 자연어 → '신자분들·신자들' (seed_photo_posts·seed_liturgy_posts·search·SearchHero)",
      "  · '세종성베드로성당' 16건 → site_settings.PARISH_NAME 동적 참조 또는 일반화. build_pptx.py 는 site_settings → env var 폴백 추가",
      "  · 부수: menu_groups id=2 label '본당 공동체2' → '본당 공동체' (테스트 라벨 복원)",
      "  · 부수: dynamic_pages id=2 (test/새내기) 폐기 테스트 데이터 삭제",
      "  · CLAUDE.md PageHeader group 예시를 현재 DB 메뉴 그룹 라벨로 동기화 + group prop 이 fallback 임을 명시",
    ],
  },
  {
    version: "1.5.205", date: "2026-05-20", tag: "수정",
    items: [
      "Credentials(일반) 로그인 — 헤더 우측 아바타 누락 해소",
      "  · 증상: 일반 회원 로그인 시 헤더 우측에 이름 첫 글자만 표시되고 프로필 사진 안 보임. 소셜 로그인은 정상",
      "  · 원인: auth.ts Credentials authorize 가 image(avatar_url) 를 안 넘겼고, jwt callback Credentials 분기에서도 token.picture 미설정 → session.user.image 가 항상 undefined",
      "  · 수정: authorize return 에 image=data.member.avatar_url 추가. jwt callback 에서 token.name + token.picture 명시 설정 (상대 경로 /uploads/... 는 ${API} 절대 URL 로 변환)",
      "  · MemberInfo 타입에 social_provider 필드 추가 — v1.5.203 의 frontend social_provider 체크 type 정합",
      "  · 적용을 위해 prod 재빌드 필요. 사용자는 한 번 로그아웃 후 재로그인하면 새 token 으로 picture 반영",
    ],
  },
  {
    version: "1.5.204", date: "2026-05-19", tag: "디자인",
    items: [
      "이메일 인증·비밀번호 재설정 메일 — HTML 버튼 디자인 적용",
      "  · 증상: 메일 본문에 verify URL 이 plain 텍스트로만 표시 → Gmail/Naver 등에서 자동 링크화 안 되거나 클릭 어려움",
      "  · 수정: _send_email 시그니처에 html_body 추가 → multipart/alternative 로 plain + HTML 동시 첨부 (HTML 우선, plain fallback)",
      "  · 디자인: brand primary(#1a365d) 헤더 + 흰 카드 + 「이메일 인증하기」/「비밀번호 재설정하기」 CTA 버튼 + 푸터 백업 링크",
      "  · 인라인 CSS 로 작성 — Gmail·Naver 가 외부 stylesheet 를 제거하므로 style 속성 직접 사용. 시즌별 색상 변동과 무관한 고정 색",
      "  · _send_verification_email, _send_reset_email 두 함수 모두 동일 템플릿 사용",
    ],
  },
  {
    version: "1.5.203", date: "2026-05-19", tag: "수정",
    items: [
      "운영 prod 시연 중 발견된 회원·설정 관련 이슈 일괄 해결",
      "  · /admin/settings 저장 실패 — site_settings 비어 있을 때 PATCH 가 404. upsert 패턴으로 변경 + NOT NULL 컬럼(label/group_name/is_secret) default 자동 채움 (SMTP_PASSWORD 같은 키는 이름에 SECRET/PASSWORD/TOKEN/KEY 포함 시 자동 is_secret=true)",
      "  · social 가입자 이메일 인증 무한 안내 — Google/Kakao OAuth provider 가 이미 검증한 이메일임에도 is_email_verified=false 로 저장돼 마이페이지에 인증 안내가 계속 표시. social-login 핸들러에서 신규/연동 모두 is_email_verified=true 자동 처리. 기존 social 회원 3명도 DB UPDATE 로 일괄 verified 처리",
      "  · 마이페이지 안내 조건 보강 — member.social_provider 있으면 인증 안내 미표시 (이중 안전망)",
      "  · NextAuth UntrustedHost (prod 한정) — 임시 회피: AUTH_TRUST_HOST=true 환경변수. 운영에서는 NEXTAUTH_URL=https://도메인 으로 자동 trust",
    ],
  },
  {
    version: "1.5.202", date: "2026-05-19", tag: "수정",
    items: [
      "운영 빌드(npm run build) 차단 오류 2건 해결 — 첫 prod 빌드 성공 (~22s, 54 routes)",
      "  · pastor/page.tsx:53 — <PageHeader> 의 required subtitle 누락 → '본당의 영성을 이끄시는 사목자' 추가",
      "  · components/Footer.tsx — <ReportLink>(useSearchParams 사용) 가 <Suspense> 미감싸 → 모든 페이지의 정적 prerender 차단(CSR bail-out). <Suspense fallback={null}> 로 감쌈",
      "  · 검증: npm run build 성공. Compiled 11.0s + TS 9.9s + Page generation 0.7s (54/54)",
      "  · 모든 페이지가 ƒ(Dynamic, server-rendered on demand) — force-dynamic 패턴과 일치",
    ],
  },
  {
    version: "1.5.201", date: "2026-05-19", tag: "인프라",
    items: [
      "갤러리/일반 게시판 라우트 통합 — /gallery → /boards 흡수 (근본 정리)",
      "  · 배경: v1.5.197~200 으로 보조 패치(redirect·boardKind·scroll-top·loading.tsx)를 쌓았으나 깜빡임이 가중. 원인은 '글 상세(/boards) ↔ 갤러리 목록(/gallery)' 의 segment 비대칭으로, 매번 layout 통째 unmount + RSC 0.3s 잔상 발생",
      "  · 통합: 모든 게시판이 /boards/{slug} 단일 라우트로. board.kind==='gallery' 이면 /boards/[slug] 페이지가 자동으로 photo 그리드 뷰를 디폴트로 표시 (BoardList 의 기존 photo view 재사용)",
      "  · 백엔드 menus.py: board 메뉴 href 매핑에서 /gallery 분기 제거 → 항상 /boards/{slug}",
      "  · /gallery/[slug]·/[postId]·/write 3개 페이지: redirect-only 페이지로 단순화 (옛 URL 호환). loading.tsx 제거",
      "  · 보조 패치 원복: /boards/[slug] 의 v1.5.197 redirect 제거, PostDetail 의 boardKind prop·scroll-top onClick(v1.5.198~199) 제거, PostPage 의 getBoardKind fetch 제거",
      "  · 결과: '목록으로' 클릭 시 segment 전환이 일어나지 않아 깜빡임·footer 잔상·skeleton 등 모든 증상이 근본적으로 사라짐",
    ],
  },
  {
    version: "1.5.200", date: "2026-05-19", tag: "디자인",
    items: [
      "/gallery/[slug] loading.tsx 추가 — '목록으로' 진입 시 footer 잔상 완전 해소",
      "  · v1.5.199(클릭 즉시 scroll-top) 의 보강. Next.js App Router 의 자동 loading UI 로 RSC 응답 도착 전 즉시 표시",
      "  · 구성: PageHeader 자리 스페이서 + 사이드바 폭 reserve + 6개 aspect-square 사진 skeleton (실제 그리드 grid-cols-2 sm:grid-cols-3 gap-3 구조 그대로 → mount 시 layout shift 최소)",
      "  · 효과: 갤러리 게시판(전례·행사)의 클릭→로딩→마운트 동안 이전 페이지 잔상 없이 매끄러운 전환",
    ],
  },
  {
    version: "1.5.199", date: "2026-05-19", tag: "수정",
    items: [
      "게시글 상세 '목록으로' — footer 잔상 깜빡임 해소",
      "  · 증상: 갤러리 게시판(전례·행사)에서 '목록으로' 클릭 시 RSC 응답 대기 중(~0.3s) 이전 페이지의 footer 위치가 그대로 보이다 새 페이지 mount 후 상단으로 점프 → 깜빡임 인식",
      "  · 원인: Next.js App Router 의 client-side navigation 동작 — 새 페이지 RSC 응답 도착 전까지 이전 화면 유지. 갤러리는 본문이 길어 footer 위치가 다른 게시판보다 두드러짐",
      "  · 수정: Link onClick 에서 window.scrollTo({top:0, behavior:'instant'}) 즉시 호출 → 클릭 즉시 상단으로 시각 이동 → 페이지 전환이 매끄러움",
      "  · 모든 게시판에 동일 적용",
    ],
  },
  {
    version: "1.5.198", date: "2026-05-19", tag: "수정",
    items: [
      "갤러리 게시판 '목록으로' — redirect 우회로 깜빡임·딜레이·scroll 튕김 해소",
      "  · 증상(v1.5.197 도입 부작용): 갤러리 게시글 상세에서 '목록으로' 클릭 시 /boards/{slug} → 307 → /gallery/{slug} 추가 round-trip 발생 → 깜빡임 + 약간의 딜레이 + scroll 위치가 상단으로 튕김",
      "  · 수정: PostDetail 의 backToListHref 가 처음부터 올바른 경로로 가도록 boardKind prop 추가 — 갤러리면 /gallery/{slug} 로 직행",
      "  · PostPage(서버) 에서 getBoardKind() 로 kind 를 추가 fetch 후 prop 전달",
      "  · /boards/[slug] 의 redirect(v1.5.197) 는 직접 URL 접근·외부 링크 대비 안전망으로 그대로 유지",
    ],
  },
  {
    version: "1.5.197", date: "2026-05-19", tag: "수정",
    items: [
      "갤러리 종류 게시판 — /boards/{slug} → /gallery/{slug} 자동 리다이렉트",
      "  · 증상: 전례 사진(/boards/liturgy) 등 갤러리 게시판의 게시글 상세에서 '목록으로' 클릭 시 list 뷰로 표시되고 사이드바도 누락",
      "  · 원인: PostDetail 의 backToListHref 가 항상 /boards/{slug} 로 하드코딩 + /boards/[slug] 페이지는 갤러리 종류여도 list 뷰 기본 + 메뉴 매칭 안 됨",
      "  · 수정: /boards/[slug] 진입 시 board.kind === 'gallery' 이면 /gallery/{slug} 로 redirect (page·q·sort·category 쿼리 보존)",
      "  · 결과: '목록으로' 클릭 → /boards/{slug} → 307 → /gallery/{slug} → 사이드바 + photo 그리드 정상",
    ],
  },
  {
    version: "1.5.196", date: "2026-05-19", tag: "수정",
    items: [
      "사이드바 토글 누락(v1.5.195 부작용) 보완",
      "  · 증상: width+opacity 트랜지션 추가하며 wrapper 에 md:overflow-hidden 을 줬는데, 토글(absolute, top:calc(-2rem-1px)) 이 wrapper 밖으로 튀어나간 부분이 잘려서 안 보임",
      "  · 수정: wrapper 의 md:overflow-hidden 제거 → SectionSidebar 만 inner div 의 md:overflow-hidden 으로 잘림 처리",
      "  · 토글은 wrapper 의 default overflow-visible 안에서 PageHeader 구분선 위로 자유롭게 노출",
      "  · 트랜지션 자체는 v1.5.195 그대로 유지",
    ],
  },
  {
    version: "1.5.195", date: "2026-05-19", tag: "디자인",
    items: [
      "사이드바 접기/펼치기 — 300ms width+opacity 트랜지션",
      "  · 사이드바 wrapper 에 md:transition-[width,opacity] duration-300 ease-out 적용",
      "  · collapsed: md:w-0 + md:opacity-0 + md:overflow-hidden",
      "  · 펼침: md:w-[var(--sidebar-w)] + md:opacity-100",
      "  · 본문은 flex-1 의 자연스러운 재계산으로 함께 부드럽게 확장/축소",
      "  · 모바일은 md:* 한정이라 영향 없음(상단 chips 그대로)",
      "  · aria-hidden={collapsed} 로 접근성 보조 표시 추가",
      "  · SectionLayout 표준·/calendar 양쪽 동일 적용",
    ],
  },
  {
    version: "1.5.194", date: "2026-05-19", tag: "디자인",
    items: [
      "사이드바 접기 — 데스크탑에서 본문 풀폭 확장",
      "  · 증상: 접어도 사이드바 wrapper 폭(170px)이 그대로 남아 본문이 확장되지 않음",
      "  · 수정: 사이드바 wrapper 에 collapsed 시 md:hidden 적용 → 데스크탑에서 wrapper 자체가 사라져 본문이 풀폭",
      "  · 펼치기 토글: 본문 영역에 별도 absolute 로 표시 (collapsed 시 사이드바 자리가 없으므로) — 본문 div 에 md:relative + collapsed 조건부 렌더",
      "  · 모바일은 영향 없음 — wrapper 의 md:hidden 은 md+ 한정",
      "  · SectionLayout 표준·/calendar 양쪽 동일 적용",
    ],
  },
  {
    version: "1.5.193", date: "2026-05-19", tag: "디자인",
    items: [
      "사이드바 접기 토글 — 「PageHeader 구분선에 걸친 탭」 모양으로 복원 + 사이드바 영역에 absolute 배치",
      "  · 모양: border-t-0 + rounded-b-md + bg-white + top:calc(-2rem - 1px) (v1.5.187/188 형태)",
      "  · 위치: 사이드바 wrapper 안 absolute → layout 공간을 차지하지 않아 사이드바 사진이 밀려 내려가지 않음",
      "  · 기준점: 사이드바 wrapper 에 md:relative 추가 (absolute 자식 위치)",
      "  · SectionLayout 표준·/calendar 양쪽 동일 적용",
    ],
  },
  {
    version: "1.5.192", date: "2026-05-19", tag: "디자인",
    items: [
      "사이드바 접기 토글 — 위치를 사이드바 상단 이미지 위로 이동, 모양은 단순 rounded 버튼으로 복원",
      "  · 모양: border + rounded + bg-white 단순 박스 (v1.5.185 형태)",
      "  · 위치: 사이드바 영역 안 사진 직전 (mb-3 으로 사진과 간격)",
      "  · 사이드바 wrapper 폭을 sidebar_width_px 로 고정 → collapsed 여도 wrapper 자리는 유지되어 토글이 그 자리에 그대로 보임 (사이드바만 hidden)",
      "  · SectionLayout 표준·/calendar 자체 구현 양쪽 동일 적용",
    ],
  },
  {
    version: "1.5.191", date: "2026-05-19", tag: "수정",
    items: [
      "/calendar 에 사이드바 접기 토글 누락 — 보완",
      "  · 원인: /calendar 는 SectionLayout 을 우회하고 SectionSidebar 를 자체 호출하기 때문",
      "  · 수정: SectionLayout 의 useSidebarCollapsed 훅과 SidebarCollapseTab 컴포넌트를 export 로 분리 → /calendar 에서 import 사용",
      "  · 동일 localStorage 키('section-sidebar-collapsed')를 공유하므로 다른 페이지에서 접은 상태가 그대로 유지됨",
      "  · 사이드바 wrapper 에 collapsed 시 md:hidden + 본문 div 에 md:relative + 토글 컴포넌트 한 줄 추가",
    ],
  },
  {
    version: "1.5.190", date: "2026-05-19", tag: "수정",
    items: [
      "SectionSidebar 폭 — flex item 직속/wrapper 끼움 두 환경에서 불일치 문제 해소",
      "  · 증상: /calendar(SectionSidebar 자체 호출) vs /boards/notice(SectionLayout 경유)에서 사이드바 폭이 크게 다르게 그려짐",
      "  · 원인: w-full + shrink-0 + max-w-[170px] 조합에서 aside 가 flex item 직속이면 w-full(=flex-basis 100%)이 max-w cap을 우회하는 케이스 발생 — wrapper div 가 한 단계 끼면 wrapper 가 flex item 이 되어 정상 cap",
      "  · 수정: md:max-w-[var(--sidebar-w)] → md:w-[var(--sidebar-w)] 로 변경 (명시적 width). 두 환경에서 동일 폭 보장",
      "  · 모바일은 w-full 유지 (column 레이아웃에서 자연스러운 풀폭)",
    ],
  },
  {
    version: "1.5.189", date: "2026-05-19", tag: "디자인",
    items: [
      "/calendar 본문 컨테이너 폭을 SectionLayout 표준에 맞춤 (max-w-6xl → max-w-5xl)",
      "  · 증상: '공지사항(/boards/notice)' 과 '행사 일정(/calendar)' 의 사이드바 위치·본문 폭이 어긋남",
      "  · 원인: 두 페이지 모두 같은 menu_group(알림과 게시판, sidebar_width_px=170) 인데 /calendar 만 자체 max-w-6xl 컨테이너 사용 → 사이드바 자체 폭은 같아도 컨테이너 폭이 달라 시각적 어긋남",
      "  · 수정: /calendar 의 컨테이너를 max-w-5xl 로 변경 → SectionLayout 표준과 일치",
      "  · 검토 결과: 사이드바와 폭 불일치 페이지는 /calendar 단 한 곳. 나머지 max-w-3xl·4xl·6xl 사용 페이지(/meditation/archive·/sitemap·/search·write/edit·/members/me 등)는 모두 사이드바 없는 독립 페이지로 의도된 폭",
    ],
  },
  {
    version: "1.5.188", date: "2026-05-19", tag: "디자인",
    items: [
      "사이드바 접기 탭 — 위쪽으로 「뚫린」 모양 보정",
      "  · 증상: 탭이 PageHeader 구분선과 정확히 같은 y 좌표에 있어 1px border 가 탭 위쪽 가장자리에 살짝 비침",
      "  · 수정: 탭의 top 을 calc(-2rem - 1px) 로 1px 더 위로 올려 PageHeader border 가 탭의 흰 배경에 완전히 덮이게 함",
      "  · 결과: 탭이 위로 열려 있고, PageHeader 구분선은 탭 양옆에서만 보이는 모양",
    ],
  },
  {
    version: "1.5.187", date: "2026-05-19", tag: "디자인",
    items: [
      "사이드바 접기 토글 — PageHeader 하단 구분선에 직접 걸친 「탭」 모양으로 위치 변경",
      "  · 이전(v1.5.186): 본문 안 자체 가로 구분선 위에 탭 — 구분선이 한 줄 더 있어 시각적 부담",
      "  · 변경: 본문 안 자체 구분선 제거 + 탭만 absolute -top-8 로 SectionLayout 상단(py-8 만큼)에 끌어올림",
      "  · 결과: PageHeader 의 border-b 가 탭의 위쪽 모서리처럼 자연스럽게 이어짐 (border-t-0 + bg-white)",
      "  · 본문 div 에 md:relative 추가 — absolute 탭의 위치 기준점",
    ],
  },
  {
    version: "1.5.186", date: "2026-05-19", tag: "디자인",
    items: [
      "사이드바 접기 토글 — 「구분선에 걸친 아래 탭」 모양으로 시각화",
      "  · 본문 영역 상단에 가로 구분선 1줄 + 그 위에 걸친 흰 배경 탭 버튼",
      "  · 탭 모양: border-t-0 + rounded-b-md + bg-white — 구분선이 탭 양옆에서만 보이고 탭 부분에서 끊긴 효과",
      "  · 위치: 본문 좌측 상단(left-4) — 사이드바와 본문 경계 근처라 자연스러운 시선 흐름",
      "  · 동작/접근성/저장은 v1.5.185 그대로 (localStorage 전역, aria-pressed/label)",
    ],
  },
  {
    version: "1.5.185", date: "2026-05-19", tag: "기능",
    items: [
      "사이드바 접기/펼치기 토글 — 모든 SectionLayout 페이지에 적용",
      "  · 본문 좌상단에 「« 메뉴 접기」/「» 메뉴 펼치기」 버튼 (데스크탑 md+ 한정 노출)",
      "  · 상태 저장: localStorage 키 'section-sidebar-collapsed' — 전역(한 번 접으면 다른 페이지에서도 접힘)",
      "  · 모바일은 사이드바가 본문 위에 column 으로 와 navigation 필수 → 토글 영향 없음",
      "  · 매칭 메뉴 그룹이 없거나 chipsOnly 모드면 토글 미노출 (의미 없음)",
      "  · 접근성: aria-pressed + aria-label/title 라벨",
      "  · 의도: /photos·/calendar 등 사이드바 추가 후에도 사용자가 풀폭 보기를 선택 가능",
    ],
  },
  {
    version: "1.5.184", date: "2026-05-19", tag: "디자인",
    items: [
      "/photos — 메뉴에 연결되면 해당 그룹 사이드바 자동 표시",
      "  · 변경 전: 의도적으로 풀폭 (사이드바 없음)",
      "  · 변경: PhotosClient 본문을 SectionLayout 으로 감싸서 useNavigation 자동 매칭 활성화",
      "  · 결과: '본당 공동체' 메뉴 그룹에 등록된 /photos 가 그 그룹 사이드바(모든날 모든순간·본당 사목지표 등)와 함께 노출",
      "  · 메뉴에 등록 안 된 경우는 SectionLayout 의 fallback(풀폭)으로 자연스럽게 동작",
      "  · autoHero=false — PhotosClient 자체가 PageHeader+사진을 갖고 있어 hero 슬라이드쇼는 생략",
      "  · /calendar 는 자체 SectionSidebar 패턴 사용 중이라 별개 처리 (이번 변경 범위 밖)",
    ],
  },
  {
    version: "1.5.183", date: "2026-05-19", tag: "수정",
    items: [
      "menu_items 부정합 차단 — link_type ↔ 참조필드 일관성 강제",
      "  · 증상: link_type='external' + external_url=NULL 인 잘못된 행이 backend href fallback으로 '동작'해 admin UI에서 부정합 발견 불가",
      "  · 원인: 본인이 직접 SQL INSERT로 메뉴를 만들 때 admin API의 검증을 우회 + _compute_href 의 'external_url or href' fallback이 잘못된 상태를 침묵시킴",
      "  · 정리: /saints(id=76), /photos(id=69) 잔여 [외부] 행 삭제 → 사용자가 admin에서 만든 정상 [페이지] 행만 유지",
      "  · backend/app/api/menus.py:_compute_href — external/page 의 href fallback 제거 (board는 보드 삭제 graceful 처리 유지)",
      "  · backend/main.py — DB CHECK 제약 menu_items_link_consistency 추가 (external→external_url, page→static_page_slug, board→board_id 필수)",
      "  · 효과: 앞으로 SQL 직접 INSERT 도 차단, 잘못된 상태는 즉시 빈 링크로 노출되어 발견",
      "  · 후속 안내: /admin/menus 에서 본당 공동체의 '세례명·축일 사전'(/saints) 이 비활성 상태입니다. 노출하려면 '활성' 체크 후 저장.",
    ],
  },
  {
    version: "1.5.182", date: "2026-05-19", tag: "기능",
    items: [
      "성인 사전 — 가중치 기반 정렬 + 인기 뱃지",
      "  · saints.popularity INTEGER(0~100) 컬럼 추가 — 자동 시드 + admin 수정 가능",
      "  · 자동 가중치: 사도 80·복음사가 75·대천사 70·박사 65·교황 50 + 한국 흔한 세례명 +25 (cap 100)",
      "  · 명시 핵심: 베드로/바오로 6/29, 요셉 3/19, 성모 마리아 8/15, 김대건 7/5 등 50여 항목",
      "  · API: /api/saints/?sort=popular|name|feast (default popular) — list·by-name·by-feast·suggest 모두 popularity 적용",
      "  · /saints 공개 페이지: 정렬 토글(인기/이름/축일) + popularity ≥ 80 카드에 ★ 뱃지",
      "  · /admin/saints: 목록·등록·수정에 '인기' 컬럼 추가 (인기 ≥ 80 강조 표시)",
    ],
  },
  {
    version: "1.5.181", date: "2026-05-19", tag: "기능",
    items: [
      "세례명·축일 사전 (Phase 1) — /saints 공개 페이지 + /admin/saints 관리",
      "  · saints 테이블 신설: korean_name, latin_name, feast_month, feast_day, title, bio_short, patronage, rank_within_name",
      "  · 시드 1,626명 자동 주입 — 한국 천주교 보편 전례력 사실(이름·라틴명·축일·신분) 한정",
      "  · 출처: 가톨릭교리통신교육회(CDCC) 목록 참고, 생애·출생지·순교지 등 사이트 고유 표기는 미수집(저작권·DB권리 회피)",
      "  · API: GET /api/saints/ 검색·페이지네이션, /suggest 자동완성, /by-name/{name} 동명 후보, /by-feast 축일별, /{id} 상세 + admin CRUD",
      "  · /saints 공개 페이지: 한글명/라틴명 검색 + 월별 필터 칩 + 페이지네이션 + 카드 그리드 (말씀과 기도 그룹)",
      "  · /admin/saints 관리: 검색·월 필터·인라인 수정·다중선택 삭제·신규 등록",
      "  · 메뉴 항목 'word' 그룹에 '세례명·축일 사전' 추가",
    ],
  },
  {
    version: "1.5.180", date: "2026-05-18", tag: "수정",
    items: [
      "/admin/content 분과·단체 저장 500 에러 — slug 빈 문자열 UniqueViolation 해소",
      "  · 증상: 단체 항목 '저장' 클릭 시 500 → CORS 헤더 누락 → 'Failed to fetch'",
      "  · 원인: editForm.slug='' 그대로 PUT → unique index 'ix_community_groups_slug' 위반 (빈 문자열이 이미 여러 행에 있음)",
      "  · 수정: CommunityGroupIn 에 field_validator 추가 — 빈 문자열을 None 으로 자동 정규화",
      "  · 적용 필드: slug · link_url · board_slug · description · activity_time · activities",
      "  · 효과: frontend 가 '' 보내든 null 보내든 일관되게 NULL 저장",
    ],
  },
  {
    version: "1.5.179", date: "2026-05-18", tag: "기능",
    items: [
      "관련 사이트 대표 사진 — SVG 형식 허용",
      "  · backend: 허용 ext 에 .svg 추가",
      "  · admin: file input accept 에 image/svg+xml,.svg 명시 + 안내 문구 갱신",
      "  · 보안: <img> 태그로만 렌더해 SVG 내부 script 비활성 (XSS 회피)",
    ],
  },
  {
    version: "1.5.178", date: "2026-05-18", tag: "디자인",
    items: [
      "Footer '관련 사이트' — 바로가기 칼럼 안 장애 신고 아래로 이동",
      "  · 이전: 3-col grid 바깥 전체 폭 영역",
      "  · 변경: 3번째 칼럼(바로가기) 안 → quickLinks → 장애 신고 → 관련 사이트 순",
      "  · 좁은 칼럼 폭에 맞춰 h-8 사진 + 작은 간격(gap-x-3) 으로 압축",
      "  · 그룹 라벨은 h3 → h4(text-xs), separator 도 mt-5 pt-4 로 약화",
    ],
  },
  {
    version: "1.5.177", date: "2026-05-18", tag: "기능",
    items: [
      "/admin/menus — 메뉴 항목별 대표 사진 업로드 + Footer 원형 출력",
      "  · menu_items.image_url 컬럼 신설 (VARCHAR 500, NULL 허용)",
      "  · 백엔드: POST /api/menus/items/{id}/image (파일), DELETE /api/menus/items/{id}/image",
      "  · 업로드 경로: /uploads/menu_items/ — sidebar 그룹 이미지(/uploads/menu_groups/)와 분리",
      "  · admin/menus 항목 편집 모달에 대표 사진 미리보기·교체·제거 UI (item.id 있을 때만 노출)",
      "  · Footer '관련 사이트' 영역에서 image_url 있는 항목은 h-9 w-9 rounded-full + 호버 시 primary 보더, 없으면 라벨만",
      "  · 새 항목 만들기 시점에는 사진 업로드 안 됨 — 저장 후 다시 열어 업로드 (안내 문구 표시)",
    ],
  },
  {
    version: "1.5.176", date: "2026-05-18", tag: "기능",
    items: [
      "Footer '관련 사이트' 영역 — 외부 링크를 DB 관리 시스템으로 (menu_groups 확장)",
      "  · menu_groups.show_in_footer 컬럼 신설 (Boolean, default false) — 헤더와 독립적",
      "  · admin/menus 의 그룹 편집 화면에 Footer 표시 토글 추가",
      "  · Footer.tsx 가 show_in_footer=true 인 그룹들을 '바로가기' 영역 아래 새 섹션으로 렌더",
      "  · 외부 링크는 새 탭 + '↗' 마커 표시. 항목 없으면 영역 자체 미노출",
      "  · useNavigation: footer 전용 그룹은 사이드바 매칭 풀에서 제외 (외부 링크 모음이 본문 사이드바로 안 새도록)",
      "  · '관련 사이트' 그룹 신설(id=10, key=related_sites). '수호성인 찾기' 메뉴(id=72) 를 본당 공동체 → 관련 사이트로 이동",
      "  · 향후 가톨릭 외부 자료 늘릴 때 admin/menus 에서 같은 UI 로 추가 가능",
    ],
  },
  {
    version: "1.5.175", date: "2026-05-18", tag: "기능",
    items: [
      "/photos — '섞어서/모아서' 모드가 뒤로가기·앞으로가기에 유지",
      "  · mode·seed 를 URL query (?mode=shuffle&seed=xxx) 로 동기화 — 브라우저 history 가 단일 진실원",
      "  · 모드 토글 시 router.replace 로 URL 업데이트 (history push 아님 — 토글 반복으로 뒤로가기 회로 막힘 회피)",
      "  · 첫 shuffle fetch 응답의 seed 를 URL 에 자동 박음 → 같은 셔플 순서 복원 (다시 섞이지 않음)",
      "  · 뒤로가기 → URL 변경 → useSearchParams 변경 → state sync → fetch 재실행",
      "  · 모드 토글은 seed 비움 → 새 모드는 항상 fresh seed (사용자가 다시 섞고 싶을 가능성 존중)",
    ],
  },
  {
    version: "1.5.174", date: "2026-05-18", tag: "수정",
    items: [
      "/photos click_href — board.kind 기반 prefix (menus._compute_href 와 동일 정책)",
      "  · 이전(v1.5.171): menu_items.href LOOKUP — menu_items.href 컬럼이 stale 일 수 있어 menus API 응답과 불일치",
      "  · 변경: boards.kind='gallery' 면 /gallery/ prefix, 아니면 /boards/. menus._compute_href 와 동일 정책",
      "  · 효과: liturgy·events·building_photo 모두 /gallery/{slug}/{id} 로 정확히 가서 사이드바 매칭 성공",
    ],
  },
  {
    version: "1.5.173", date: "2026-05-18", tag: "수정",
    items: [
      "/photos — 무한 retry loop + SQL placeholder 충돌 두 건 해소",
      "  · 증상 1: 첫 fetch 실패(예: rate limit) 시 hasMore 유지 → IntersectionObserver 가 또 trigger → 무한 retry → 새 한도(2000/min)까지 도달 → 200/min 올려도 '변화 없음'",
      "  · 수정 1: PhotosClient fetchPage catch 에서 setHasMore(false) — 자동 retry 중단, 사용자가 모드 토글·새로고침으로 명시 재시도",
      "  · 증상 2: photos.py SQL 주석의 '{slug}' 표기가 Python str.format() placeholder 로 인식 → KeyError 500",
      "  · 수정 2: 주석 표기를 '<slug>' 로 변경 (SQL 코드는 || b.slug 그대로)",
      "  · 검증: list_photos 직접 호출 200, items 정상 반환",
    ],
  },
  {
    version: "1.5.172", date: "2026-05-18", tag: "인프라",
    items: [
      "slowapi 분당 요청 한도를 환경변수화 (HTTP 429 회피)",
      "  · 증상: /photos 무한스크롤·admin 다중 패널이 빠르게 200/min 한도 초과 → 429",
      "  · 변경: settings.RATE_LIMIT_PER_MINUTE (default 200, dev .env 에서 상향 가능)",
      "  · main.py 의 Limiter default_limits 를 settings 기반으로 분기",
      "  · dev .env: RATE_LIMIT_PER_MINUTE=2000 (운영은 .env 미지정 → 200 기본)",
    ],
  },
  {
    version: "1.5.171", date: "2026-05-18", tag: "수정",
    items: [
      "/photos — 게시판 이동 시 사이드바 누락 해소",
      "  · 증상: /photos 사진 클릭 → /boards/{slug}/{id} → SectionLayout 의 useNavigation 이 메뉴 매칭 실패 → currentGroup=null → 사이드바·칩 모두 사라짐",
      "  · 원인: '전례 사진'(liturgy)·'성전 건축 사진'(building_photo) 은 메뉴에 /gallery/{slug} 로 등록 — /boards/{slug} prefix 와 매칭 안 됨",
      "  · 변경: photos.py SQL 의 click_href 가 menu_items 에서 '/gallery/{slug}' 가 등록된 경우 그 경로로 분기, 아니면 '/boards/{slug}' fallback",
      "  · 효과: 갤러리성 게시판의 사진 클릭이 메뉴와 동일 경로로 가서 사이드바 정상 노출",
      "  · 잔여: events 게시판은 메뉴에 미등록 → 별도 확인 필요 (관리자 결정)",
    ],
  },
  {
    version: "1.5.170", date: "2026-05-18", tag: "수정",
    items: [
      "AI 추출 라우팅 — 캘린더 events (title, event_date) 중복 INSERT 방지",
      "  · 증상: 매주 주보에 같은 행사가 추출돼 캘린더에 중복 카드 (5/20·5/22·6/5 '구역 미사' 2개씩)",
      "  · 원인: _apply_extraction_routing 3a/3c 분기가 source_bulletin 무관 중복 검사 없음",
      "  · 변경: _find_existing_event helper — 같은 (title, event_date) 가 있으면 기존 id 재사용",
      "  · approve_extraction_as_event(사용자 명시 액션)는 의도 존중 — 검사 안 함",
      "  · split-by-dates 도 자동 보호 (분리 후 새 extraction 들이 같은 라우팅 경로 거침)",
      "  · 기존 중복 3건(id=204,205,206) cleanup. 백업: cathedral_…_pre-dedupe-cleanup.sql",
      "/photos — 'test' 슬러그 page_photos 3건 정리",
      "  · 사용자에게 '삭제된 줄 아는 사진'으로 노출되던 page_photo_slugs.test (slug, 사진 3장, 디스크 파일) 일괄 삭제",
    ],
  },
  {
    version: "1.5.169", date: "2026-05-18", tag: "디자인",
    items: [
      "/admin/bulletin/extractions — '날짜별 분리' 버튼 가시성 조건 추가",
      "  · 이전: 모든 추출 건(vision 제외)에 항상 표시 → 단일 날짜 항목에선 의미 없음",
      "  · 변경: 본문에 서로 다른 M/D 패턴이 2개 이상일 때만 노출",
      "  · 백엔드 _DATE_PATTERN 과 동일한 정규식·(월,일) 쌍 dedupe 로 프론트 카운트",
      "  · 버튼 title 에 '본문에서 N개의 M/D 날짜 패턴이 발견됨' 표시",
    ],
  },
  {
    version: "1.5.168", date: "2026-05-18", tag: "수정",
    items: [
      "주보 삭제 500 에러 — ForeignKeyViolation 해소",
      "  · 증상: 자르기해서 갤러리 라우팅된 사진이 있는 주보 삭제 시 500 (Failed to fetch)",
      "  · 원인: posts.source_bulletin_id CASCADE → posts 삭제 시도 → attachments.post_id NO ACTION 가 거절",
      "  · 해결: delete_bulletin 에서 source_bulletin_id 로 연결된 posts 를 ORM 으로 명시 삭제",
      "  · _remove_post_attachment_files 재사용 (boards.py) → 디스크 파일 unlink + Post.attachments cascade 로 DB row 정리",
      "  · 이전에 보고된 '자르기 사진이 주보 삭제 후에도 남음' 증상도 동시 해소",
    ],
  },
  {
    version: "1.5.167", date: "2026-05-18", tag: "기능",
    items: [
      "주보 묵상 추출 — 본문 끝 '글 | 작성자' 표기를 author 컬럼으로 자동 분리",
      "  · 정규식 매치: '글' + (| / │ / ｜ / ㅣ / ： / : / · / -) + 작성자",
      "  · 매치 시 본문 정제 + author 저장, 미매치 시 원본 그대로 (본문 손실 방지)",
      "  · 추출된 본문은 출처 footer 와 함께 깔끔히 저장. 트레일링 빈 줄 정리.",
      "  · 적용 위치: _apply_extraction_routing 묵상 분기 (신규 INSERT 시)",
      "  · 기존 묵상 1건(id=17) 일괄 마이그 — author='주임신부 김준영 안드레아' 추출, 본문 정제",
      "  · admin/content meditation 탭에 이미 author 입력 폼 존재 — 추가 작업 없음",
    ],
  },
  {
    version: "1.5.166", date: "2026-05-18", tag: "인프라",
    items: [
      "게시판/게시글/임시저장 삭제 — 첨부 unlink 실패를 로그로 남김",
      "  · 기존: try/except: pass 로 silent 무시 → 대량 정리 시 어떤 파일이 안 지워졌는지 추적 불가",
      "  · 변경: 파일 누락은 info, unlink 예외는 warning 로그 (post_id·attachment_id·path·err 포함)",
      "  · 게시글 삭제 동작 자체는 그대로 — 디스크 정리 실패가 DB 삭제를 막지 않음",
    ],
  },
  {
    version: "1.5.165", date: "2026-05-18", tag: "수정",
    items: [
      "AI 추출 데이터 created_at — 항상 주보 발행일(정오)로 저장",
      "  · 과거 주보를 늦게 등록해도 등록 시점이 created_at 으로 박혀 정렬·표시가 어긋나던 문제 해소",
      "  · 적용 대상: posts(ai-extract·매핑·갤러리 라우팅·이벤트 카드) · attachments(주보 출신) · events(AI 라우팅·승인) · meditations",
      "  · 미적용: bulletin_extractions(추출 작업 기록) · visions(created_at 컬럼 없음) · notices(source_bulletin_id 없음, 현재 posts 로 일원화)",
      "  · 신규 INSERT 7곳에 created_at=published_ts 명시 (2곳은 published_ts 변수 새로 계산)",
      "  · 기존 데이터 일괄 UPDATE: posts 2건 + attachments 1건 정정. 백업: backups/cathedral_…_pre-ai-created-at-migration.sql",
    ],
  },
  {
    version: "1.5.164", date: "2026-05-18", tag: "디자인",
    items: [
      "/photos 라벨 변경 — '모든 사진' → '모든 날 모든 기억'",
      "  · 메뉴(menu_items) · PhotosClient PageHeader · 안내 박스 PageHeader 3곳 동시 변경",
    ],
  },
  {
    version: "1.5.163", date: "2026-05-18", tag: "기능",
    items: [
      "/photos — 페이지 접근 권한 설정 (공개 / 회원만)",
      "  · site_settings.PHOTOS_VIEW_SCOPE 키 신설 (기본 public)",
      "  · 공개: 기존 동작 (게시판 권한 따라 필터링)",
      "  · 회원만 + 비로그인: 인라인 안내 박스 + '로그인하러 가기' 버튼 (callbackUrl=/photos)",
      "  · 회원만 + 로그인: PhotosClient 렌더 (기존 동작 그대로)",
      "  · 사진 데이터 자체는 페이지 권한과 무관하게 항상 게시판 정책 따라 필터링",
      "  · 백엔드: GET /api/photos/access 경량 endpoint + PhotosOut.view_scope",
      "  · 어드민: /admin/settings 사이트 그룹에 라디오 select 노출",
      "  · 페이지 구조: server component(page.tsx) → 분기 → client component(PhotosClient.tsx)",
    ],
  },
  {
    version: "1.5.162", date: "2026-05-18", tag: "인프라",
    items: [
      "lib/api.ts — resolveClientApi() helper export",
      "  · client component 에서 NEXT_PUBLIC_API_URL 빈 값 함정 회피용 공용 helper",
      "  · /photos 의 inline 함수를 helper 로 이관 (중복 제거)",
      "  · 기존 66곳 ?? 패턴은 현재 동작 중이라 회귀 회피 위해 유지 — 새 코드에서만 helper 사용 권장",
    ],
  },
  {
    version: "1.5.161", date: "2026-05-18", tag: "수정",
    items: [
      "/photos — API base 해석 강건화 (env 빈 값일 때도 절대 URL 보장)",
      "  · resolveApiBase() 헬퍼: NEXT_PUBLIC_API_URL → window.location → localhost:8000 폴백",
      "  · 이전: ?? 폴백은 빈 문자열 못 잡아 상대 경로 /api/photos 로 가서 Next.js 404",
      "  · LAN/공인 IP 접속에서도 hostname 그대로 8000 포트 사용",
    ],
  },
  {
    version: "1.5.160", date: "2026-05-18", tag: "기능",
    items: [
      "/photos — 등록된 모든 사진 모아보기 페이지 신설",
      "  · 출처 통합: page_photos · 공개 게시판 첨부 · 주보 추출 · 역대 사목자/수녀 · 본당 출신 사제 · 본당 가족 · 공사 단계/일지 (7개)",
      "  · 권한: members_only_read / exclude_from_search / is_active=false 게시판 자동 제외, 회원 프로필 사진 미포함",
      "  · '섞어서 / 모아서' 모드 토글 — 시드 기반 결정론적 셔플(페이지 넘어가도 중복·누락 없음)",
      "  · 반명함 비율(3:4) 격자 + 여백 0 + 무한 스크롤(IntersectionObserver, rootMargin 400px)",
      "  · 모바일 4열 / sm 6열 / md 8열 / lg 10열, 클릭 시 등록 위치(게시글·페이지·아카이브)로 이동",
      "  · 백엔드: GET /api/photos?mode=shuffle|grouped&offset&limit&seed (UNION ALL + window COUNT)",
      "  · 메뉴: '사진 갤러리' 그룹 첫 항목으로 등록",
    ],
  },
  {
    version: "1.5.159", date: "2026-05-18", tag: "수정",
    items: [
      "/vision 역대 본당 사목지표 목록 — 최근 등록이 항상 가장 위",
      "  · year DESC + id DESC 명시적 정렬 (백엔드 정렬에 의존하지 않음)",
      "  · 같은 year 에 여러 등록 시에도 마지막 INSERT 가 위로",
    ],
  },
  {
    version: "1.5.158", date: "2026-05-18", tag: "수정",
    items: [
      "/vision 페이지 '올해' 배지 — 최근 등록 1건만 부여",
      "  · 기존: DB 의 is_current=TRUE 인 모든 행에 배지 (여러 건이 함께 노출 가능)",
      "  · 변경: year DESC + id DESC 정렬 첫 번째 1건에만 배지",
      "  · 신규 vision 등록 시 자동으로 배지가 새 항목으로 이동",
    ],
  },
  {
    version: "1.5.157", date: "2026-05-18", tag: "수정",
    items: [
      "delete_bulletin 시 uploads/bulletin-extracted/{id} 디렉터리 자동 정리",
      "  · DB cascade 와 별개로 디스크 폴더가 남던 문제 해결 (shutil.rmtree)",
      "  · 이전 잔여 폴더 4개 (22·23·35·36) 수동 정리",
    ],
  },
  {
    version: "1.5.156", date: "2026-05-18", tag: "기능",
    items: [
      "AI 추출 검토 화면에 '📅 날짜별 분리' 버튼 추가",
      "  · 본문에서 M/D(요일) 패턴 자동 탐지 (예: 5/20(수), 6/5(금))",
      "  · 미리보기 confirm → 같은 제목·내용으로 N개 항목 분리 (event_date 만 다름)",
      "  · 발행일 기준 연도, 6개월 이상 이전이면 다음 해로 자동 처리",
      "  · POST /api/bulletins/extractions/{id}/split-by-dates (dry_run 지원)",
    ],
  },
  {
    version: "1.5.155", date: "2026-05-18", tag: "기능",
    items: [
      "/calendar — 운영자 이상이 캘린더 날짜 클릭 시 일정 등록",
      "  · 월간/주간 뷰: 날짜 숫자 호버·클릭 → 신규 등록 모달 (그 날짜로 자동 인입)",
      "  · 일간 뷰: 헤더 우측 '+ 일정 추가' 버튼",
      "  · 목록 뷰: 상단 '+ 새 일정 추가' 버튼 (오늘 날짜 인입)",
      "  · 폼: 제목·시작일·종료일·시간·장소·분류(행사/모임)·카테고리·설명",
    ],
  },
  {
    version: "1.5.154", date: "2026-05-18", tag: "기능",
    items: [
      "/calendar 상세 모달 — 운영자 이상 권한으로 행사 인라인 수정·삭제",
      "  · 권한: admin_token (슈퍼관리자) 또는 session.isAdmin (운영자)",
      "  · 수정: 모달 내 인라인 폼 (제목·날짜·시간·장소·설명) → PUT /api/events/{id}",
      "  · 삭제: confirm 후 DELETE → 로컬 state 갱신 + 모달 닫기",
    ],
  },
  {
    version: "1.5.153", date: "2026-05-18", tag: "수정",
    items: [
      "MarkdownContent 에 remarkBreaks 적용 — single newline 도 줄바꿈으로 렌더링",
      "  · 캘린더 상세 모달 등 AI 추출 본문의 줄바꿈이 한 덩어리로 보이던 문제 해결",
      "  · DB 의 \\n 은 정상 저장되어 있었으나 markdown 표준이 single newline 을 공백으로 처리해 발생",
      "  · MeditationCard 와 일관성 확보 (이미 remarkBreaks 사용 중)",
    ],
  },
  {
    version: "1.5.152", date: "2026-05-18", tag: "기능",
    items: [
      "PDF 추출 사진 분류 선택지를 모든 활성 게시판으로 확장",
      "  · 기존: 갤러리 메뉴 + 건축 슬라이드 + 무시",
      "  · 변경: optgroup 으로 '갤러리(📷)' / '게시판(📋)' 분리 표시 + 모든 활성 게시판 노출",
      "  · ai-extract 등 시스템 전용 게시판은 자동 제외",
    ],
  },
  {
    version: "1.5.151", date: "2026-05-18", tag: "인프라",
    items: [
      "Next.js Turbopack 캐시 이슈 (require is not defined) 자동 복구 인프라:",
      "  · frontend/package.json 에 'dev:fresh' 스크립트 추가 (rm -rf .next && next dev)",
      "  · ~/.claude/commands/reset-dev.md slash command — /reset-dev 한 단어로 자동 복구",
      "  · CLAUDE.md 서버 실행 섹션에 캐시 복구 안내 추가",
    ],
  },
  {
    version: "1.5.150", date: "2026-05-18", tag: "수정",
    items: [
      "복음 구절 가져오기 정규식 보완 — 굿뉴스 측 '복음의 끝입니다' 오기에도 매칭",
      "  · 2026-05-17 (주님 승천 대축일) 페이지에서 시작 표기가 '복음의 끝입니다' 로 잘못 표기되어 NULL 반환되던 문제 해결",
      "  · /admin/bulletin/new + /meditation 묵상 페이지 + /meditation SVG 중앙정렬",
    ],
  },
  {
    version: "1.5.149", date: "2026-05-18", tag: "수정",
    items: [
      "AI 추출 시스템 추가 보강 3건:",
      "  · result 페이지 polling timeout 후 '↻ 다시 분석' 버튼 강제 노출 — 막다른 골목 회피 (운영 영향)",
      "  · AI 통계 페이지 '↻ 새로고침' 버튼 추가 + cache: no-store",
      "  · routed-counts/batch 응답에 not_found 분리 (bulk-reject 와 일관성)",
    ],
  },
  {
    version: "1.5.148", date: "2026-05-18", tag: "수정",
    items: [
      "AI 추출 시스템 사소한 보강 6건:",
      "  · status != 'rejected' dead filter 2곳 제거 (v1.5.143 이후 의미 없는 필터)",
      "  · routed-counts/batch IN 절을 expanding bindparam 으로 명시 (SQLAlchemy 표준)",
      "  · AI 통계 페이지 빈 데이터 시 안내 박스 + '주보 등록' 진입",
      "  · 출처 footer 날짜 포맷 YYYY-MM-DD → YYYY.MM.DD 로 issue_label 과 통일",
      "  · alembic/README 가이드 작성 — 신규 schema 변경 정책 명시",
      "  · AdminSidebar 의 주보 메뉴에 'AI 분석 통계' 진입 추가",
    ],
  },
  {
    version: "1.5.147", date: "2026-05-18", tag: "인프라",
    items: [
      "AI 추출 시스템 P3 완성도 보강 3건:",
      "  · attachments.source_bulletin_id (ON DELETE SET NULL) — 갤러리 사진 출처 추적, 주보 삭제 시 사진 보존",
      "  · /admin/bulletin/stats AI 분석 통계 페이지 — 성공률·p50·p95·재시도·에러 패턴·event_type 분포·최근 5건",
      "  · GET /api/bulletins/ai-stats 통계 endpoint",
      "  · Alembic 도입 — alembic/env.py + 0001_baseline + main.py startup 자동 upgrade (단일 진입점)",
      "  · 누락 모델 6개 추가 — AdminLog·EmailVerificationToken·PasswordResetToken·ParishPastor·ParishPriest·SearchTermCount",
      "  · Bulletin.ai_retry_count·Meditation.source_bulletin_id·Vision.source_bulletin_id 모델 정의",
      "  · 인덱스 drift 는 main.py startup CREATE INDEX 가 처리 (별도 마일스톤)",
    ],
  },
  {
    version: "1.5.146", date: "2026-05-18", tag: "기능",
    items: [
      "AI 추출 시스템 완성도 보강 5건 (P2):",
      "  · POST /api/bulletins/routed-counts/batch — 다건 삭제 다이얼로그 집계 N+1 회피",
      "  · 미러 게시판 셀렉트 is_active=true 필터 (백엔드 404 회피)",
      "  · 출처 footer markdown 일관성 점검 (rehypeRaw 모든 노출 지점 적용 확인 — 변경 불필요)",
      "  · bulletins.ai_retry_count + 일시 오류(timeout/connection/throttle) 1회 자동 재시도 (5초 후)",
      "  · 승인된 extractions 영구 보존 정책 (감사 로그 가치 + cascade 로 정리됨)",
    ],
  },
  {
    version: "1.5.145", date: "2026-05-18", tag: "기능",
    items: [
      "AI 추출 시스템 완성도 보강 9건 (P0+P1):",
      "  · source_bulletin_id 인덱스 4개 (cascade DELETE 속도)",
      "  · /admin/bulletin/[id]/result AI 분석 폴링 5분 timeout",
      "  · 공지 분기 fallback (notice 게시판 부재 시 ai-extract 으로 graceful)",
      "  · reanalyze 동시 실행 락 (SELECT FOR UPDATE + ai_status 검사 → 409)",
      "  · bulletin_extractions.created_vision_id 컬럼 + RETURNING id 추적",
      "  · ExtractionOut 응답에 created_vision_id 노출",
      "  · ExtractionPatchBody + 인라인 편집 UI 에 group_name 필드",
      "  · 인라인 편집 폼에 event_type 분류 셀렉트 (오추출 수정)",
      "  · bulk-approve 각 건 savepoint 격리 (부분 실패 시 세션 안전)",
      "  · _repin_latest_meditation commit 호출자 책임 (savepoint 호환)",
    ],
  },
  {
    version: "1.5.144", date: "2026-05-17", tag: "기능",
    items: [
      "주보 삭제 시 분산 저장 결과물 cascade 삭제 — posts/events/meditations/visions 에 source_bulletin_id FK ON DELETE CASCADE 추가",
      "AI 추출 데이터 전체 초기화 (bulletins·extractions·notices·events·meditations·visions·ai-extract posts)",
      "/admin/bulletin 삭제 다이얼로그 — 함께 사라질 결과물 카운트 미리 보여줌 (routed-counts 엔드포인트)",
      "Event ORM 모델 추가 (events 테이블 metadata 등록 — FK 무결성)",
      "bulletin_extraction.bulletin relationship passive_deletes=True (DB CASCADE 신뢰)",
    ],
  },
  {
    version: "1.5.143", date: "2026-05-17", tag: "기능",
    items: [
      "AI 추출 거부 = 즉시 삭제로 변경 — rejected status 보존 폐기 (이전 legacy 1건 정리)",
      "/admin/bulletin/extractions 일괄 거부(삭제) 버튼 추가 — bulk-reject 엔드포인트",
    ],
  },
  {
    version: "1.5.142", date: "2026-05-17", tag: "인프라",
    items: ["/admin/docs CHANGELOG v1.5.138~141 동기화 + 백업"],
  },
  {
    version: "1.5.141", date: "2026-05-17", tag: "인프라",
    items: [
      "회원 영명축일 (members.name_day_month/day) — 가입·수정 폼 + DELETE /me/name-day",
      "CORS LAN IP(121.152.118.40) 허용 — 같은 Wi-Fi 휴대폰 접속",
      "BACKEND_INTERNAL_URL 환경변수 fallback 패턴 일괄 적용 (Footer·fetchServerMenus 등)",
      "gospel 복음 본문 파싱 개선 — board_layout 컨테이너 단위 정확 추출",
      "모바일 폰트·페이지 폴리시 50여 곳 (boards·meditation·groups·pastors·gallery 등)",
      "icons 컴포넌트(BulletinIcon·ChurchIcon·GroupsIcon) 추출 + SearchHero를 components/ 로 이동",
      "AdminSidebar 메인 사진 항목 추가, 발표 자료 스크린샷 4종",
    ],
  },
  {
    version: "1.5.140", date: "2026-05-17", tag: "기능",
    items: [
      "본당 교통 안내 — TransportRoute 모델 + /api/transport-routes CRUD (admin 자유 편집·정렬)",
      "/admin/parish/info 에 교통 안내 섹션(라벨·설명·정렬), /info 페이지에 출발지별 노선 카드",
      "미사 시간 렌더링을 lib/mass.ts 로 분리 (재사용 가능)",
    ],
  },
  {
    version: "1.5.139", date: "2026-05-17", tag: "기능",
    items: [
      "장애 신고 시스템 — IssueReport 모델 + /api/reports CRUD (비회원 신고 허용, 운영자 상태 관리)",
      "/report 공개 페이지(신고 폼) + /admin/reports (상태·메모 관리)",
      "Footer 에 ReportLink (페이지 URL 자동 수집) + AdminSidebar 진입점",
    ],
  },
  {
    version: "1.5.138", date: "2026-05-17", tag: "기능",
    items: [
      "[묶음] 게시판 카드 뷰 신규 — admin 글 관리 카드 디자인 차용, 작성자(이름+아바타) 우측 배치",
      "[묶음] 게시판별 뷰 토글 노출 제어 — boards.show_view_list/card/photo, 활성 뷰 1개 이하면 토글 숨김, URL ?view= 비활성 뷰면 활성으로 폴백",
      "[묶음] 홈에서 잘못 호출되던 youth_council fetch 제거 — 404 백엔드 로그 노이즈 정리",
      "[묶음] 게시판 검색폼 노출 여부 admin 제어 — boards.show_search_form, 공개 페이지에서 form 조건부 렌더",
      "[묶음] 게시글 공유 기능 — POST /api/boards/{slug}/posts/{id}/share (Web Share API + 클립보드 폴백), boards.share_enabled + posts.share_allowed 이중 토글, 작성·편집 폼 \"공유 허용\" 체크박스, 목록 🔗 공유수 컬럼",
      "[묶음] 운영자 권한 통일 — 글 수정·삭제·이동·복사·핀 토글 + 댓글 수정·삭제 모두 운영자(is_admin=True 회원) 통과, 공개 글 상세에 이동·복사 버튼(운영자 전용), UI 명칭 \"위임관리자\" → \"운영자\" 일괄 (DB 컬럼·JWT 키는 호환 유지)",
      "[묶음] 회원 비활성화·삭제 endpoint 자기 자신 가드 — 백엔드 400 + 프론트 본인 버튼 disabled",
      "[묶음] admin API URL 환경변수 정리 — dashboard·members·bulletin/new·bulletin/extractions 하드코딩 → NEXT_PUBLIC_API_URL, /admin/members 자체 아바타에 API 호스트 자동 prepend",
    ],
  },
  {
    version: "1.5.137", date: "2026-05-16", tag: "인프라",
    items: ["/admin/docs CHANGELOG v1.5.112~136 일괄 동기화 + 백업"],
  },
  {
    version: "1.5.136", date: "2026-05-16", tag: "기능",
    items: [
      "게시판 형식(일반/한줄/갤러리)을 수정 폼에서 변경 가능 (변경 시 라우팅 경로 안내 confirm)",
      "게시판 어드민 그룹화: board_admin_groups 테이블 신설 + /admin/boards 에 그룹 CRUD 섹션·이동 셀렉트",
      "그룹 섹션 아코디언 (디폴트 모두 접힘, 한 번에 한 그룹) + 전체선택 옆 '모두 펼치기/접기' 토글",
      "게시글 상단 고정 (📌): PATCH /api/boards/{slug}/posts/{post_id}/pin 신규, 슈퍼관리자·moderator 만 가능",
      "어드민 글 관리 패널에 핀 토글 + 핀 뱃지, 토글 후 silent fetch 로 깜빡임 없이 정렬 갱신",
      "공개 /boards/[slug] (TableView·PhotoView) + /gallery/[slug] 핀 글에 📌 표시",
    ],
  },
  {
    version: "1.5.135", date: "2026-05-16", tag: "디자인",
    items: ["헤더 — 현재 페이지가 속한 그룹 라벨을 항상 강조 (데스크톱 2px primary 바, 모바일 좌측 3px 보더)"],
  },
  {
    version: "1.5.134", date: "2026-05-16", tag: "디자인",
    items: ["/pastor (본당 가족) 타임라인 스토리식 새 디자인 — 좌·우 교차 배치, 행 사이 ✦ 장식"],
  },
  {
    version: "1.5.133", date: "2026-05-16", tag: "기능",
    items: ["/admin/content community 분과 순서를 /admin/menus 의 menu_items 순서로 동기화 — 단일 출처화"],
  },
  {
    version: "1.5.132", date: "2026-05-15", tag: "수정",
    items: ["게시판 댓글·좋아요는 회원 세션 토큰만 사용 (admin 토큰 거부 403 회피)"],
  },
  {
    version: "1.5.131", date: "2026-05-15", tag: "수정",
    items: ["게시판 글 삭제·목록으로 시 원래 페이지·필터 복원"],
  },
  {
    version: "1.5.130", date: "2026-05-15", tag: "디자인",
    items: ["게시판 동영상 아이콘을 밝고 반짝이는 디자인으로 변경"],
  },
  {
    version: "1.5.129", date: "2026-05-15", tag: "기능",
    items: ["게시판 동영상 포함 글에 목록 TV 아이콘(📺) 표시"],
  },
  {
    version: "1.5.128", date: "2026-05-15", tag: "기능",
    items: ["게시판 naver.me 단축 URL 도 자동 임베드 (백엔드 resolver)"],
  },
  {
    version: "1.5.127", date: "2026-05-15", tag: "기능",
    items: ["게시판 게시글 본문에 YouTube·Naver TV 동영상 자동 임베드"],
  },
  {
    version: "1.5.126", date: "2026-05-15", tag: "수정",
    items: ["보안 — 게시글 수정·삭제에 admin 감사 로깅 추가"],
  },
  {
    version: "1.5.125", date: "2026-05-15", tag: "수정",
    items: ["게시판 글 수정 — admin 토큰 늦게 인식돼 forbidden 가 풀리지 않던 문제"],
  },
  {
    version: "1.5.124", date: "2026-05-15", tag: "수정",
    items: ["MarkdownContent — template literal 닫는 따옴표 누락 수정"],
  },
  {
    version: "1.5.123", date: "2026-05-15", tag: "디자인",
    items: ["게시판 게시글 본문 글자 크기 16px (text-base) 로 상향"],
  },
  {
    version: "1.5.122", date: "2026-05-15", tag: "기능",
    items: ["admin 이 공개 페이지에서도 모든 게시글 수정·삭제 가능"],
  },
  {
    version: "1.5.121", date: "2026-05-15", tag: "기능",
    items: ["게시판 목록에 작성자 프로필 사진 표시"],
  },
  {
    version: "1.5.120", date: "2026-05-15", tag: "기능",
    items: ["게시판 목록 표시 컬럼 admin 토글 (list_show_*)"],
  },
  {
    version: "1.5.119", date: "2026-05-15", tag: "기능",
    items: ["게시글 다중 게시판 복사 기능 (admin)"],
  },
  {
    version: "1.5.118", date: "2026-05-15", tag: "수정",
    items: ["보안 P3 — Draft 발행·이동·삭제에 admin 감사 로깅"],
  },
  {
    version: "1.5.117", date: "2026-05-15", tag: "수정",
    items: ["보안 P2 — admin layout 공통 토큰 가드"],
  },
  {
    version: "1.5.116", date: "2026-05-15", tag: "수정",
    items: ["보안 P0 — 권한 누수 차단"],
  },
  {
    version: "1.5.115", date: "2026-05-15", tag: "디자인",
    items: ["모바일 Step 3·4 — 터치 타깃 통일 + 배너 인디케이터"],
  },
  {
    version: "1.5.114", date: "2026-05-15", tag: "디자인",
    items: ["모바일/캘린더 Step 2 — 모바일(<768px) 첫 진입 시 자동 'list' 뷰"],
  },
  {
    version: "1.5.113", date: "2026-05-15", tag: "디자인",
    items: ["모바일 Step 1 — 60대 가독성 위해 작은 폰트 일괄 상향"],
  },
  {
    version: "1.5.112", date: "2026-05-15", tag: "인프라",
    items: ["/admin/docs CHANGELOG v1.5.111 동기화"],
  },
  {
    version: "1.5.111", date: "2026-05-15", tag: "디자인",
    items: ["헤더 검색 입력 폭을 placeholder 끝에 맞춤 (-20%, w-[142px] lg:w-[181px])"],
  },
  {
    version: "1.5.110", date: "2026-05-15", tag: "디자인",
    items: ["헤더 검색 입력 폭 -2% 미세 조정 (177/226px)"],
  },
  {
    version: "1.5.109", date: "2026-05-15", tag: "디자인",
    items: ["헤더 검색 입력 폭 +3% (181/231px)"],
  },
  {
    version: "1.5.108", date: "2026-05-15", tag: "디자인",
    items: ["헤더 데스크톱 검색 입력 폭 20% 축소 — 그룹 라벨 노출 여유 확보"],
  },
  {
    version: "1.5.107", date: "2026-05-15", tag: "디자인",
    items: ["/calendar 사이드바 형식 메뉴로 변경 — max-w-6xl 래퍼 + SectionSidebar(chipsOnly 제거)"],
  },
  {
    version: "1.5.106", date: "2026-05-15", tag: "디자인",
    items: ["전례·행사 갤러리에 사이드바 형식 메뉴 적용 (chipsOnly 제거)"],
  },
  {
    version: "1.5.105", date: "2026-05-15", tag: "기능",
    items: ["/admin/bulletin/extractions 다중 선택 일괄 승인 + 카테고리 필터 + 인라인 편집"],
  },
  {
    version: "1.5.104", date: "2026-05-15", tag: "기능",
    items: ["AI 추출 자동 라우팅 → 관리자 검토·승인 워크플로 (모두 pending, _apply_extraction_routing 헬퍼 + bulk-approve + PATCH)"],
  },
  {
    version: "1.5.103", date: "2026-05-15", tag: "기능",
    items: ["캘린더 필터 칩에 봉사·순례·피정·강의·기타 추가 + 이벤트 색 일관화 (KIND_BAR/CHIP/FILTER 색 매핑)"],
  },
  {
    version: "1.5.102", date: "2026-05-15", tag: "기능",
    items: ["AI 분류설정 백엔드 연결 — /admin/event-mapping 매핑이 실제 추출 라우팅에 적용"],
  },
  {
    version: "1.5.101", date: "2026-05-15", tag: "인프라",
    items: ["백업 사전 작업으로 /admin/docs CHANGELOG v1.5.100 동기화 (v1.5.95~v1.5.100 추가)"],
  },
  {
    version: "1.5.100", date: "2026-05-15", tag: "기능",
    items: ["헤더 대메뉴(그룹 라벨) 클릭 시 페이지 이동 — admin/menus 의 landing_href 설정, 없으면 첫 sub 항목 자동 fallback"],
  },
  {
    version: "1.5.99", date: "2026-05-15", tag: "수정",
    items: ["/admin/content?tab=community 분과 그룹 기본을 접힌 상태로 — collapsed → open 모델 반전"],
  },
  {
    version: "1.5.98", date: "2026-05-15", tag: "인프라",
    items: ["presentation/DEPLOY_CAFE24.md §15 'Claude Code 활용 방식' 추가 (서버 설치 / 로컬 SSH / 혼합 비교)"],
  },
  {
    version: "1.5.97", date: "2026-05-15", tag: "인프라",
    items: ["DEPLOY_CAFE24.md 를 Cafe24 자동 설치 구성에 맞춰 재작성 (Python 3.12·uv·Uvicorn·PG17 사전 설치 반영)"],
  },
  {
    version: "1.5.96", date: "2026-05-15", tag: "인프라",
    items: ["presentation/DEPLOY_CAFE24.md 신설 — Cafe24 VPS 배포 시나리오 12단계 + 부록"],
  },
  {
    version: "1.5.95", date: "2026-05-15", tag: "인프라",
    items: ["백업 사전 작업으로 /admin/docs CHANGELOG 동기화 (v1.5.93·v1.5.94 추가)"],
  },
  {
    version: "1.5.94", date: "2026-05-15", tag: "기능",
    items: ["/admin/docs 변경 이력을 날짜별 그룹화 + 접기/펼치기 (모두 펼치기·접기 단축 버튼 포함)"],
  },
  {
    version: "1.5.93", date: "2026-05-15", tag: "인프라",
    items: ["/admin/docs 변경 이력을 v1.5.92 까지 갱신 (66개 항목 추가, prefix→tag 매핑)"],
  },
  {
    version: "1.5.92", date: "2026-05-15", tag: "기능",
    items: ["전례 시기 자동 계산 + 자동/수동 모드 토글 — Gauss 알고리즘 부활절 기준, /admin/season 토글로 매일 자동 갱신"],
  },
  {
    version: "1.5.91", date: "2026-05-15", tag: "디자인",
    items: ["footer 배경에 전례 시기 테마 색 적용 (--color-surface-warm)"],
  },
  {
    version: "1.5.90", date: "2026-05-15", tag: "수정",
    items: ["캘린더 주 보기에서도 lane 영역 column 세로선 누락 — 빈 div 7개로 세로선 강제 표시"],
  },
  {
    version: "1.5.89", date: "2026-05-15", tag: "기능",
    items: ["SectionLayout chipsOnly 패턴 추가 + 갤러리 적용 (풀폭 본문 + 가로 칩 메뉴)"],
  },
  {
    version: "1.5.88", date: "2026-05-15", tag: "수정",
    items: ["캘린더 멀티데이 lane 영역의 column 세로선 누락 — 빈 div 7개로 세로선 유지"],
  },
  {
    version: "1.5.87", date: "2026-05-15", tag: "기능",
    items: ["/calendar 풀폭 본문 보존 + PageHeader 아래 가로 칩 메뉴 (SectionSidebar chipsOnly)"],
  },
  {
    version: "1.5.86", date: "2026-05-15", tag: "디자인",
    items: ["/search 검색 후에도 '무엇을 찾고 계신가요?' 헤더 유지 — 진입 경험 일관성"],
  },
  {
    version: "1.5.85", date: "2026-05-15", tag: "수정",
    items: ["SectionSidebar가 스크롤을 따라 움직이도록 sticky top 단순화 (md:top-28, PopularCard와 동일)"],
  },
  {
    version: "1.5.84", date: "2026-05-15", tag: "기능",
    items: ["/admin/menus 새로고침 후 현재 선택 그룹 유지 (localStorage 영속)"],
  },
  {
    version: "1.5.83", date: "2026-05-15", tag: "수정",
    items: ["admin/menus 그룹 PUT 본문에 sidebar_height_px·sidebar_image_position 누락 — 9방향 그리드 클릭이 저장 안 되던 문제"],
  },
  {
    version: "1.5.82", date: "2026-05-15", tag: "기능",
    items: ["사이드바 상단 이미지 위치(object-position) 9방향 선택 — admin/menus 3x3 그리드"],
  },
  {
    version: "1.5.81", date: "2026-05-15", tag: "기능",
    items: ["사이드바 상단 이미지 세로 크기 지정 (sidebar_height_px, NULL=자동 5:4 비율)"],
  },
  {
    version: "1.5.80", date: "2026-05-15", tag: "수정",
    items: ["배너 그룹 위치 변경이 select에서 깜빡이며 안 고정되는 문제 — optimistic update 적용"],
  },
  {
    version: "1.5.79", date: "2026-05-15", tag: "기능",
    items: [
      "배너 노출 위치 확장 (home_main 1개 → 8개): home·about·calendar·bulletin·gallery",
      "그룹별 크기(aspect_ratio) · 슬라이드 전환 · 딜레이(2~30초) · 캡션 오버레이 설정",
    ],
  },
  {
    version: "1.5.78", date: "2026-05-15", tag: "인프라",
    items: ["사이드바·페이지 '주임 신부님' → '사목자' 일관성 (사목 인원 전체 의미 정확화)"],
  },
  {
    version: "1.5.77", date: "2026-05-15", tag: "인프라",
    items: [
      "admin '본당 가족' 표현 → '현재 사목자' 정리 (parish-staff·pastors)",
      "검색 카테고리에서 '페이지 콘텐츠' 제외 (UI 폐기 + 데이터 동결)",
    ],
  },
  {
    version: "1.5.76", date: "2026-05-15", tag: "수정",
    items: ["admin 사이드바 accordion — 다른 그룹 열면 기존 열린 그룹 자동 닫힘"],
  },
  {
    version: "1.5.75", date: "2026-05-15", tag: "수정",
    items: ["admin 사이드바 그룹 접기를 '기본 닫힘 + 클릭 시 열림' 모델로 반전"],
  },
  {
    version: "1.5.74", date: "2026-05-15", tag: "인프라",
    items: [
      "admin 사이드바 8그룹 재편 + 라벨 정리 + 성전 건축 단독 배치",
      "대분류·중분류 접기 UI (localStorage 영속) + AI 텍스트 뱃지",
      "a11y 4건: h2 그룹 헤더, aria-current=page, 이모지 aria-hidden, 뱃지 sr-only",
      "parish 라우트 분리: /admin/parish/info, /admin/parish/mass-times",
      "content 페이지 'pages' 탭 폐기 + 탭별 동적 h1, 단체·분과 페이지 분과 접기",
    ],
  },
  {
    version: "1.5.73", date: "2026-05-14", tag: "디자인",
    items: ["kind='default' 게시판을 텍스트 한 줄 리스트로 일관화"],
  },
  {
    version: "1.5.72", date: "2026-05-14", tag: "디자인",
    items: ["/gallery/[slug] 에 SectionLayout 적용 — 사이드바 활성화"],
  },
  {
    version: "1.5.71", date: "2026-05-14", tag: "기능",
    items: ["게시판 간 글 이동 (admin)"],
  },
  {
    version: "1.5.70", date: "2026-05-14", tag: "기능",
    items: ["게시판 카테고리 자유입력 + 필터"],
  },
  {
    version: "1.5.69", date: "2026-05-14", tag: "인프라",
    items: ["공지사항을 boards 시스템으로 통합"],
  },
  {
    version: "1.5.68", date: "2026-05-14", tag: "기능",
    items: ["admin/boards 글 관리 패널에 자체 검색 추가"],
  },
  {
    version: "1.5.67", date: "2026-05-14", tag: "기능",
    items: ["게시판 자체 검색·정렬·이전다음 글·추천 UI"],
  },
  {
    version: "1.5.66", date: "2026-05-14", tag: "수정",
    items: ["게시판 권한 일관화 + 검색 IP 디바운스"],
  },
  {
    version: "1.5.65", date: "2026-05-14", tag: "기능",
    items: ["공지사항 페이지네이션 — 페이지당 20건 + 핀은 항상 상단"],
  },
  {
    version: "1.5.64", date: "2026-05-14", tag: "기능",
    items: ["배너 슬라이드 전환 효과 9종 — admin 그룹별 선택 (fade/slide/zoom/ken-burns 등)"],
  },
  {
    version: "1.5.63", date: "2026-05-14", tag: "디자인",
    items: ["배너 슬라이더 카드를 고정 비율(3:2)로 고정 — 이미지 크기에 따른 흔들림 제거"],
  },
  {
    version: "1.5.62", date: "2026-05-14", tag: "인프라",
    items: ["동적 /gallery/[slug] 라우트 + boards.kind='gallery' 통합"],
  },
  {
    version: "1.5.61", date: "2026-05-14", tag: "인프라",
    items: ["/admin/gallery 제거, 게시판 시스템으로 통합"],
  },
  {
    version: "1.5.60", date: "2026-05-14", tag: "수정",
    items: ["create_post가 슈퍼관리자(admin)를 거부하던 버그 수정"],
  },
  {
    version: "1.5.59", date: "2026-05-14", tag: "수정",
    items: ["/admin/gallery가 사용하는 liturgy·photo 게시판 자동 생성"],
  },
  {
    version: "1.5.58", date: "2026-05-14", tag: "디자인",
    items: ["홈 미사 시간 표기를 24시간 형식으로 변경"],
  },
  {
    version: "1.5.57", date: "2026-05-14", tag: "기능",
    items: ["위치별 슬라이드 배너 시스템 — banner_groups·banner_images 신설"],
  },
  {
    version: "1.5.56", date: "2026-05-14", tag: "기능",
    items: ["홈 메인 레이아웃 4종 select로 확장"],
  },
  {
    version: "1.5.55", date: "2026-05-14", tag: "디자인",
    items: ["홈 시즌 배너를 복음 카드 안 → 독립 배너 카드로 분리"],
  },
  {
    version: "1.5.54", date: "2026-05-14", tag: "기능",
    items: ["첫영성체 시즌 배너 + 설정 select 박스"],
  },
  {
    version: "1.5.53", date: "2026-05-14", tag: "기능",
    items: ["홈 메인 레이아웃을 admin에서 wide/even 토글"],
  },
  {
    version: "1.5.52", date: "2026-05-14", tag: "디자인",
    items: ["홈 메인 3단 → 사진 확장 + 복음·미사 우측 2단 스택"],
  },
  {
    version: "1.5.51", date: "2026-05-14", tag: "디자인",
    items: ["묵상 슬라이드의 마크다운 문법 노출 제거"],
  },
  {
    version: "1.5.50", date: "2026-05-14", tag: "디자인",
    items: ["인기 검색어 sticky top 80→112px — 헤더 가림 회피"],
  },
  {
    version: "1.5.49", date: "2026-05-14", tag: "디자인",
    items: ["/search '우리 안에 있는 모든 것을 찾아드립니다' 부제 제거"],
  },
  {
    version: "1.5.48", date: "2026-05-14", tag: "디자인",
    items: ["인기 검색어 카드를 self-start + sticky로 고정"],
  },
  {
    version: "1.5.47", date: "2026-05-14", tag: "디자인",
    items: ["/search '우리 안에 있는 모든 것을 찾아드립니다' 부제 추가"],
  },
  {
    version: "1.5.46", date: "2026-05-14", tag: "디자인",
    items: ["/search 2-column 분기를 lg → md로 낮춤, 사이드 폭 280 → 260px"],
  },
  {
    version: "1.5.45", date: "2026-05-14", tag: "디자인",
    items: ["브라우저 기본 검색 X 버튼 숨김 — 자체 X와 중복 노출 제거"],
  },
  {
    version: "1.5.44", date: "2026-05-14", tag: "디자인",
    items: ["데스크톱 레이아웃 유지 폭 10% 확대 (md: 768 → 691.2px)"],
  },
  {
    version: "1.5.43", date: "2026-05-14", tag: "기능",
    items: ["인기 검색어 사이드 카드 + 추천 검색어 admin 편집"],
  },
  {
    version: "1.5.42", date: "2026-05-14", tag: "기능",
    items: ["헤더 상시 검색바 + /search 큰 입력란·추천 검색어"],
  },
  {
    version: "1.5.41", date: "2026-05-14", tag: "기능",
    items: ["admin 사이드바를 노션 방식으로 — pinned·peek hover·⌘\\ 토글"],
  },
  {
    version: "1.5.40", date: "2026-05-14", tag: "기능",
    items: ["통합 검색에 prayer·meditation·council·page·construction·pastor·priest 보강"],
  },
  {
    version: "1.5.39", date: "2026-05-14", tag: "기능",
    items: ["주요 기도문 24건 시드 — 7개 카테고리 전부 채움"],
  },
  {
    version: "1.5.38", date: "2026-05-14", tag: "기능",
    items: ["기도문 카테고리 시스템 — 7개 카테고리·검색·prev/next·admin CRUD"],
  },
  {
    version: "1.5.37", date: "2026-05-14", tag: "인프라",
    items: ["메뉴 라벨을 사이트 전역 단일 진실 소스로 통합"],
  },
  {
    version: "1.5.36", date: "2026-05-14", tag: "디자인",
    items: ["pentecost 라벨 확장 + 상단 정보 바에 시즌 surface-warm 배경"],
  },
  {
    version: "1.5.35", date: "2026-05-14", tag: "디자인",
    items: ["전례 시기 칩을 상단 좌측 끝으로 이동"],
  },
  {
    version: "1.5.34", date: "2026-05-14", tag: "기능",
    items: ["전례 시기 칩을 공개 사이트 헤더 우측 끝에 표시"],
  },
  {
    version: "1.5.33", date: "2026-05-14", tag: "기능",
    items: ["묵상 아카이브 검색·압축 페이지네이션·prev/next 네비·OG 메타·focus 강조"],
  },
  {
    version: "1.5.32", date: "2026-05-14", tag: "인프라",
    items: ["글로벌 작업 흐름으로 가는 다리 한 줄 추가"],
  },
  {
    version: "1.5.31", date: "2026-05-14", tag: "기능",
    items: ["전례 시기 스킨 admin 토글 — site_settings 기반 사이트 전체 적용"],
  },
  {
    version: "1.5.30", date: "2026-05-14", tag: "인프라",
    items: ["가톨릭 전례 5절기 시즈널 스킨 예시 추가"],
  },
  {
    version: "1.5.29", date: "2026-05-14", tag: "인프라",
    items: ["admin 스킨 인프라 — data-skin 속성 + CSS 변수 오버라이드 자리"],
  },
  {
    version: "1.5.28", date: "2026-05-14", tag: "인프라",
    items: ["admin 로그인/인증 영역을 별도 sub-group으로 분리"],
  },
  {
    version: "1.5.27", date: "2026-05-14", tag: "인프라",
    items: [
      "admin·공개 영역을 Route Group으로 분리 — 공개 Header 누수 차단",
      "root layout 슬림화 + (public)/layout.tsx 신설",
    ],
  },
  {
    version: "1.5.26", date: "2026-05-13", tag: "기능",
    items: [
      "주보 AI 추출 카테고리 확장 — '묵상' / '지표' 추가",
      "묵상은 주보 발행일로 meditations에 자동 INSERT (scripture 필드 포함)",
      "본당 사목지표는 추출만 pending 상태로 보관, admin이 visions에 수동 등록",
      "Bedrock client read_timeout 60→300초, max_tokens 4096→8192 (긴 묵상 본문 잘림 방지)",
    ],
  },
  {
    version: "1.5.25", date: "2026-05-13", tag: "수정",
    items: [
      "AI 추출 항목 누락 버그 — _fingerprint에 title 추가",
      "이전: (group_name, event_date, event_type)만 사용 → 날짜·그룹 없는 항목이 같은 event_type이면 한 fp로 뭉쳐 첫 건만 저장됨",
      "75호 사례: 성모 신심미사·성체 강복·병자(영성체)·유아세례 4건이 1건으로 합쳐졌던 문제. 재분석 시 10건 모두 정상 등록",
    ],
  },
  {
    version: "1.5.24", date: "2026-05-13", tag: "수정",
    items: [
      "통합검색 공백 무시 매칭 — '구역 미사' = '구역미사' 동일 결과",
      "검색어와 검색 대상 모두 공백 제거 후 ILIKE (posts/notices/history/vision/community/comments/events)",
    ],
  },
  {
    version: "1.5.23", date: "2026-05-12", tag: "기능",
    items: [
      "/calendar 헤더 년월 라벨을 클릭하면 빠른 선택 팝오버 — 년도 ‹›·12개월 그리드",
      "빠른 점프 버튼: -10년 / -5년 / 작년 / 올해 — 과거 일정 빠르게 접근",
      "오늘 위치 강조 + 현재 보고 있는 월 강조, 바깥 클릭 시 자동 닫힘",
    ],
  },
  {
    version: "1.5.22", date: "2026-05-12", tag: "수정",
    items: [
      "통합검색에 행사·캘린더 결과 포함 — events 테이블의 title/description/location ILIKE 매칭",
      "결과 라벨 '행사·캘린더' + 날짜·종류(행사/모임) 뱃지 표시, 클릭 시 /calendar 이동",
    ],
  },
  {
    version: "1.5.21", date: "2026-05-12", tag: "수정",
    items: [
      "AI 생성 공지·행사의 created_at을 등록 시각이 아닌 주보 발행일로 설정",
      "과거 주보(예: 2025-11-30)를 오늘 업로드해도 게시판/캘린더에서 해당 날짜로 자연 정렬",
      "기존에 오늘 날짜로 잘못 등록된 AI 데이터(notices 10건·events 6건) 발행일로 보정",
    ],
  },
  {
    version: "1.5.20", date: "2026-05-12", tag: "수정",
    items: [
      "주보 수동 재분석(/analyze)도 자동 라우팅까지 수행 — 공지 → notices INSERT, 행사·모임 → events INSERT, 나머지 → ai-extract 게시판",
      "라우팅 로직을 _route_and_save_events 헬퍼로 분리해 자동 분석·수동 분석 양쪽이 동일 동작",
      "이전 manual /analyze는 status='pending'만 만들고 라우팅 누락 — UI '등록 완료' 라벨과 실제 DB 상태가 불일치하던 버그 해결",
    ],
  },
  {
    version: "1.5.19", date: "2026-05-12", tag: "수정",
    items: [
      "주보 AI 추출 0건 문제 해결 — 네이버 카페 등에서 인쇄한 PDF(본문이 이미지인 경우) 자동 인식",
      "is_text_sparse 강화 — URL·페이지번호·시간도장 제거 후 의미 있는 글자 수 카운트",
      "텍스트 분석 0건이면 Vision fallback 자동 — 본문이 이미지인 PDF도 정상 추출",
      "claude_analyzer 진단 로그 추가 — Bedrock 응답 길이/시작 + 파싱 결과 로그",
    ],
  },
  {
    version: "1.5.18", date: "2026-05-12", tag: "기능",
    items: [
      "분과·단체 대표 이미지 — community_groups.representative_photo_url 컬럼 + 업로드/삭제 API",
      "/groups 카드 좌측에 원형 대표 이미지 표시 (없으면 ✝ 아이콘)",
      "/admin/content?tab=community 수정 폼에 대표사진 업로드/변경/삭제 영역 추가",
      "사이드바 hover popup 안정화 — 가로 스크롤 제거 + 동적 maxHeight로 viewport 끝단 접근 가능",
    ],
  },
  {
    version: "1.5.17", date: "2026-05-12", tag: "기능",
    items: [
      "공지에 사진 등록 가능 — 여러 장 업로드, 미리보기, 개별 삭제 (notice_attachments 테이블)",
      "공지 공개 상세 페이지에 사진 갤러리 + 클릭 시 원본 보기",
      "공지 목록에서 사진 첨부 여부를 📷 N 뱃지로 표시",
      "POST/DELETE /api/notices/{id}/attachments — 다중 업로드, 공지 삭제 시 파일 자동 정리",
    ],
  },
  {
    version: "1.5.16", date: "2026-05-12", tag: "기능",
    items: [
      "공지사항 등록 날짜 강제 지정 — 과거 공지를 그 날짜로 등록 가능",
      "날짜 미지정 시 현재 시각 자동 적용, 수정 시 빈 값이면 기존 날짜 유지",
      "NoticeIn.created_at(Optional) + admin 폼에 날짜 입력 추가 (정오 12:00 저장으로 정렬 안정화)",
    ],
  },
  {
    version: "1.5.15", date: "2026-05-12", tag: "기능",
    items: [
      "성당 기본 정보 동적화 — /admin/parish에 성당명 입력 폼 + 로고 업로드/삭제 폼 추가",
      "parishes.logo_url 컬럼 + POST/DELETE /api/parish/logo 엔드포인트",
      "Header 로고/성당명 동적화 — 로고 등록 시 ✝ 자리에 이미지, 텍스트는 parish.name",
      "lib/parish.ts 공통 헬퍼(React cache) — Header·Footer·layout·22개 페이지가 동일 데이터 공유",
      "layout.tsx + 22개 페이지를 generateMetadata로 전환 — 성당명 변경 시 모든 메타/본문 즉시 반영",
      "PageHeader subtitle 하드코딩 일괄 정리 (saint/history/sisters/priests/pastors/info)",
      "주보 카카오 공유 제목·about alt·info 버스 안내도 동적 성당명 사용",
    ],
  },
  {
    version: "1.5.14", date: "2026-05-12", tag: "기능",
    items: [
      "본당 사목지표 본문에 마크다운 에디터(MarkdownEditor) 적용 — 제목(##)·작은 제목(###)·카드 섹션(>)·구분선(---) 지원",
      "/vision 공개 페이지에 MarkdownContent 렌더 — 줄바꿈·단락·카드 박스 자동 시각화",
      "MarkdownContent의 blockquote 스타일 강화 — 좌측 강조 보더 + 따뜻한 배경 + 라운드. 게시판·동적 페이지 인용에도 일관 적용",
    ],
  },
  {
    version: "1.5.13", date: "2026-05-12", tag: "기능",
    items: [
      "본당 사목지표에 본문(body) 입력 추가 — 슬로건 외에 신부님의 한 해 사목 방향·말씀을 단락으로 기록 가능",
      "/vision 공개 페이지에 올해 지표 본문 카드 노출 (줄바꿈 보존)",
      "/admin/content?tab=vision 생성/수정 폼에 textarea 추가, no-store로 즉시 반영",
    ],
  },
  {
    version: "1.5.12", date: "2026-05-12", tag: "기능",
    items: [
      "한 줄 게시판 시스템 — boards.kind('default'|'line') 도입, 게시판 생성/수정 시 형식 선택 가능",
      "한 줄 게시판 전용 UI — 카드 그리드, 종류(위령/감사/청원/기타)·대상·메시지 입력 폼, 페이지네이션",
      "'함께 기도합니다' 추천 토글 — 회원당 1회, 낙관적 UI 업데이트, post_likes 테이블 + UNIQUE 제약",
      "'한줄 봉헌'(/boards/build_offering) 게시판을 line 형식으로 전환 — 메뉴 그룹 '성전건축' 안에서 즉시 활용",
    ],
  },
  {
    version: "1.5.11", date: "2026-05-12", tag: "기능",
    items: [
      "헤더 메뉴 그룹 '성전건축' 신설 — 성전 건축 현황 / 한줄 봉헌 / 성전 사진 3개 항목",
      "게시판 2개 신설: '한줄 봉헌'(/boards/build_offering), '성전 사진'(/boards/build_photo)",
      "공사 일지 → '성전 건축 현황'으로 라벨 일관 통일 (페이지/위젯/관리자 사이드바)",
      "홈 위젯 헤더 '새 성당 짓는 중' → '새 성전 건축'",
    ],
  },
  {
    version: "1.5.10", date: "2026-05-12", tag: "기능",
    items: [
      "성당 건축 공사 일지 시스템 — 단계 마일스톤 + 한 줄 일지 + 정점 사진 슬라이드쇼 (/construction)",
      "홈에 '공사 진행 현황' 위젯 — 등록된 단계가 있을 때만 자동 노출 (현재 단계·전체 진행률·최신 일지)",
      "관리 페이지 /admin/construction — 단계 CRUD, 진행률 입력, 사진 업로드, 일지 작성",
      "기술문서·소유권 탭 → 사용권 탭으로 재구성 (사용 허가·개발 주체·외부 API·호스팅 면책)",
    ],
  },
  {
    version: "1.5.9", date: "2026-05-12", tag: "기능",
    items: [
      "회원 관심 분과·단체 시스템 — 가입 후 첫 로그인 시 /onboarding/interests 자동 안내",
      "단체 선택 시 부모 분과 자동 포함, 분과 해제 시 등록된 소속단체 함께 해제 confirm",
      "마이페이지 섹션 + /groups/[slug] 관심 등록 패널 + 카톡 알림 수신 동의 (발송은 채널 개설 후)",
      "마이페이지 일시적 오류 수정 (SessionSync deps 무한 루프 → 429 → TypeError)",
    ],
  },
  {
    version: "1.5.8", date: "2026-05-12", tag: "기능",
    items: [
      "세션 만료 정책 정비 — 기본 12시간 + idle 30분 자동 로그아웃, '로그인 상태 유지' 체크 시 7일",
      "운영자 해제된 회원에게 헤더 '관리페이지' 링크 노출 차단",
      "SessionSync로 권한 변경 즉시 동기화 (재로그인 없이 반영)",
    ],
  },
  {
    version: "1.5.7", date: "2026-05-11", tag: "수정",
    items: [
      "데스크톱 사이드바 sticky 고정 + 페이지 로드 시 위치 즉시 고정",
      "게시판 글 상세·동적 페이지에 SectionLayout 적용 — 사이드바 메뉴 자동 노출",
    ],
  },
  {
    version: "1.5.6", date: "2026-05-11", tag: "기능",
    items: [
      "동적 페이지 시스템 — 코드 없이 관리자에서 페이지 생성 + 레이아웃 선택",
    ],
  },
  {
    version: "1.5.5", date: "2026-05-10", tag: "수정",
    items: [
      "메뉴 시스템 안정화 — 한글 IME 조합 깨짐, sort_order 자동 정규화, reorder 엔드포인트 충돌",
      "외부 링크 여부(is_external) href 편집 시 자동 동기화",
      "삭제된 source의 auto menu_item 물리 삭제 + auto:* 뱃지 표시",
      "boards-list 500 에러 해결, ai-extract 게시판 메뉴에서 숨김",
    ],
  },
  {
    version: "1.5.4", date: "2026-05-10", tag: "기능",
    items: [
      "메뉴 관리 시스템 — Header/Sidebar 동적 통합, 백엔드 메뉴 인프라 (/admin/menus)",
      "3-deep 트리 메뉴 + 메가메뉴 + 2-row 모바일 칩",
      "게시판/분과 자동 메뉴 동기화 (link_type 기반 3-way: 페이지·게시판·외부 URL)",
      "SSR fetch + MenusProvider context로 FOUC 제거",
    ],
  },
  {
    version: "1.5.3", date: "2026-05-09", tag: "수정",
    items: [
      "분과 페이지 모바일 레이아웃 보정 — 사이드바 칩 변환, 사진 2열 유지, 칩 nav sticky 위치 정정",
    ],
  },
  {
    version: "1.5.2", date: "2026-05-09", tag: "기능",
    items: [
      "분과·단체 시스템 — 트리(분과 → 소속단체) + 상세 페이지 (/groups, /groups/[slug])",
      "분과별 사진 표시 방식 선택 (슬라이드쇼 / 격자), 1장 업로드 시 가로 전체 16:9",
    ],
  },
  {
    version: "1.5.1", date: "2026-05-08", tag: "수정",
    items: [
      "9개 관리자 페이지 다중 선택 + 일괄 삭제 UI 모바일 보정",
    ],
  },
  {
    version: "1.5.0", date: "2026-05-08", tag: "기능",
    items: [
      "본당 인물 아카이브 — 역대 사목자(/admin/pastors), 본당 출신 사제(/priests, /admin/priests)",
      "9개 관리자 페이지에 다중 선택·일괄 삭제 패턴 통일",
      "게시판별 게시글 인라인 다중 선택·일괄 삭제",
      "주보 페이지 카카오 공유 버튼 + 기술문서·도움말 페이지 (/admin/docs)",
    ],
  },
  {
    version: "1.4.1", date: "2026-05-06", tag: "수정",
    items: [
      "모바일 iOS Safari 가로 스크롤 버그 수정 (SVG isolation 처리)",
      "관리자 페이지 콘텐츠 중앙 정렬 일괄 적용 (mx-auto)",
      "갤러리 '사진 올리기' 버튼 비로그인 시 완전 숨김",
    ],
  },
  {
    version: "1.4.0", date: "2026-05-01", tag: "기능",
    items: [
      "운영자 지정 기능 — is_admin 회원에게 운영자 권한 부여·회수 (최고관리자만)",
      "활동 로그 페이지 (/admin/logs) — 관리자 행동 자동 기록 조회",
      "갤러리 관리 페이지 (/admin/gallery) — 다중 사진 업로드",
      "공개 갤러리 페이지 (/gallery/liturgy, /gallery/events)",
    ],
  },
  {
    version: "1.3.0", date: "2026-04-15", tag: "기능",
    items: [
      "주보 AI 분석 기능 — Claude claude-haiku-4-5로 행사·공지 자동 추출",
      "행사 캘린더 관리 페이지 (/admin/calendar)",
      "주보 추출 승인(게시글·캘린더)·거부 워크플로우",
    ],
  },
  {
    version: "1.2.0", date: "2026-04-01", tag: "기능",
    items: [
      "회원 가입·로그인·이메일 인증 시스템",
      "게시판 CRUD, 댓글, 첨부파일 업로드 (10 MB 제한)",
      "비밀번호 찾기·재설정 (이메일 링크)",
      "프로필 아바타 업로드",
    ],
  },
  {
    version: "1.1.0", date: "2026-03-15", tag: "기능",
    items: [
      "공지 관리 — 상단 고정 포함",
      "본당 정보 편집 — 미사 시간·주임 신부 소개·사진",
      "사목 방향·단체·성당 역사 콘텐츠 관리",
      "사목평의회 위원 관리 (사진 포함)",
      "묵상 글 관리 — 날짜별 발행",
    ],
  },
  {
    version: "1.0.0", date: "2026-03-01", tag: "인프라",
    items: [
      "최초 배포 — Cafe24 VPS + Nginx + Uvicorn",
      "주보 PDF 업로드·목록 페이지",
      "최고관리자 로그인 (/admin)",
      "홈페이지 기본 구조 (Next.js 15 + FastAPI)",
    ],
  },
];

// ─── 보조 컴포넌트 ─────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" }) {
  const c = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-green-100 text-green-700",
    PUT: "bg-yellow-100 text-yellow-700",
    PATCH: "bg-orange-100 text-orange-700",
    DELETE: "bg-red-100 text-red-700",
  }[method];
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${c}`}>
      {method}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 border-l-4 border-blue-400 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 rounded-r-lg">
      {children}
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 rounded-r-lg">
      {children}
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="my-3 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
            {i + 1}
          </span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Accordion({
  icon, title, badge, children,
}: {
  icon: string; title: string; badge?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-[var(--color-surface-warm)] transition-colors"
      >
        <span className="text-xl">{icon}</span>
        <span className="flex-1 font-semibold text-[var(--color-primary)]">{title}</span>
        {badge && (
          <span className="mr-2 rounded-full bg-[var(--color-surface-warm)] border border-[var(--color-border)] px-2.5 py-0.5 text-xs text-[var(--color-text-muted)]">
            {badge}
          </span>
        )}
        <span className="text-[var(--color-text-muted)] text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] bg-white px-5 py-4 text-[var(--color-text)] text-sm leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

function ApiRow({ method, path, desc, auth }: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  desc: string;
  auth?: "관리자" | "회원" | "최고관리자";
}) {
  const authColor = auth === "최고관리자"
    ? "bg-yellow-100 text-yellow-700"
    : auth === "관리자"
    ? "bg-purple-100 text-purple-700"
    : auth === "회원"
    ? "bg-green-100 text-green-700"
    : "";
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-warm)]">
      <td className="px-3 py-2.5 w-20"><MethodBadge method={method} /></td>
      <td className="px-3 py-2.5 font-mono text-xs text-[var(--color-primary)]">{path}</td>
      <td className="px-3 py-2.5 text-xs text-[var(--color-text)]">{desc}</td>
      <td className="px-3 py-2.5 w-20">
        {auth && (
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${authColor}`}>{auth}</span>
        )}
      </td>
    </tr>
  );
}

function ApiTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--color-surface-warm)] border-b border-[var(--color-border)]">
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">메서드</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">경로</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">설명</th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-[var(--color-text-muted)]">권한</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ─── 탭 콘텐츠 ─────────────────────────────────────────────────────────────

function GuideTab() {
  return (
    <div className="space-y-3">

      <Accordion icon="🔐" title="관리자 인증" badge="2가지 유형">
        <p className="mb-3 text-[var(--color-text-muted)]">이 시스템에는 <strong>두 종류의 관리자</strong>가 있습니다.</p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="font-semibold text-yellow-800 mb-1">⭐ 최고관리자 (Super Admin)</p>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>• ID/PW로 <code>/admin</code> 직접 로그인</li>
              <li>• 회원 운영자 권한 부여·회수 가능</li>
              <li>• localStorage: <code>admin_is_super = "true"</code></li>
              <li>• 게시글 작성 시 author = null (성당 명의)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <p className="font-semibold text-purple-800 mb-1">👤 운영자 (Delegated Admin)</p>
            <ul className="text-xs text-purple-700 space-y-1">
              <li>• 회원 로그인 → 관리자 페이지 접근</li>
              <li>• 최고관리자가 회원에게 권한 부여</li>
              <li>• 회원 권한 부여·회수 불가</li>
              <li>• 게시글 작성 시 author = 해당 회원</li>
            </ul>
          </div>
        </div>
        <Tip>로그아웃은 최고관리자에게만 표시됩니다. 운영자는 브라우저 탭을 닫거나 <code>localStorage</code>를 직접 삭제하세요.</Tip>
        <p className="text-xs text-[var(--color-text-muted)]">세션 저장 키: <code>admin_token</code>, <code>admin_display_name</code>, <code>admin_role</code>, <code>admin_is_super</code></p>
      </Accordion>

      <Accordion icon="📤" title="주보 관리" badge="/admin/bulletin">
        <p className="mb-2 font-medium">주보 업로드</p>
        <Steps items={[
          "/admin/bulletin/new 페이지로 이동",
          "발행일, 호수, 전례시기, 복음 구절 입력",
          "PDF 파일 선택 후 업로드",
          "업로드 완료 후 대시보드에서 확인",
        ]} />
        <p className="mb-2 font-medium mt-4">AI 행사 추출</p>
        <Steps items={[
          "주보 목록에서 '분석' 버튼 클릭",
          "Claude Haiku가 PDF 텍스트를 분석하여 행사·공지 추출",
          "/admin/bulletin/extractions 에서 추출 결과 확인",
          "각 항목을 '게시글로 등록' 또는 '캘린더 행사로 등록' 또는 '무시'",
        ]} />
        <Tip>최신 업로드된 주보가 홈페이지와 /bulletin 페이지에 자동으로 표시됩니다.</Tip>
      </Accordion>

      <Accordion icon="📢" title="공지 관리" badge="/admin/notices">
        <Steps items={[
          "+ 공지 작성 버튼 클릭",
          "제목·내용 입력, 상단 고정 여부 선택",
          "저장하면 /boards/notice 게시판에 즉시 표시",
          "수정/삭제는 목록의 각 행 버튼으로 처리",
        ]} />
        <Tip>상단 고정(is_pinned)된 공지는 목록 최상단에 고정 표시됩니다.</Tip>
      </Accordion>

      <Accordion icon="💬" title="게시판·게시글 관리" badge="/admin/boards">
        <p className="mb-2 font-medium">게시판 생성</p>
        <Steps items={[
          "게시판 이름·slug(영문 소문자) 입력. slug는 URL에 사용됨 (예: free → /boards/free)",
          "members_only_read: 로그인 회원만 읽기 가능",
          "members_only_write: 로그인 회원만 쓰기 가능",
          "posts_per_page: 페이지당 게시글 수 설정",
        ]} />
        <p className="mb-2 font-medium mt-4">게시글·댓글 삭제</p>
        <p>최고관리자·운영자는 모든 게시판의 게시글·댓글을 삭제할 수 있습니다. 게시판관리자는 자기 보드 내, 작성자는 자기 글에 한해 삭제 가능합니다. 게시글 상세 페이지에서 권한이 있는 사용자에게만 삭제 버튼이 표시됩니다.</p>
        <Warn>게시글 삭제 시 첨부파일과 댓글이 함께 삭제됩니다. 복구 불가합니다.</Warn>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">기본 게시판 slug: <code>notice</code>, <code>free</code>, <code>news</code>, <code>liturgy</code>, <code>photo</code></p>
      </Accordion>

      <Accordion icon="🎴" title="게시판 뷰 형식 (목록/카드/사진)" badge="v1.5.138">
        <p className="mb-3 text-[var(--color-text-muted)]">
          공개 게시판은 <strong>목록·카드·사진</strong> 3가지 뷰를 가지며, 게시판마다 어떤 뷰 버튼을 노출할지 admin에서 선택할 수 있습니다.
        </p>
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs">
            <p className="font-semibold mb-1">📃 목록</p>
            <p className="text-[var(--color-text-muted)]">한 줄 텍스트 — 제목 + 댓글수, 사진/동영상 아이콘. list_show_* 토글에 따라 메타 노출</p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs">
            <p className="font-semibold mb-1">🪪 카드</p>
            <p className="text-[var(--color-text-muted)]">admin 글 관리 패널과 동일한 카드 디자인. 좌 썸네일 + 가운데 제목/메타 + 우측 작성자(이름·아바타)</p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-3 text-xs">
            <p className="font-semibold mb-1">🖼️ 사진</p>
            <p className="text-[var(--color-text-muted)]">2~3열 그리드. 썸네일 없으면 📄 또는 🎬 아이콘. 카드 하단에 제목·작성자·날짜</p>
          </div>
        </div>
        <p className="mb-2 font-medium">노출 제어 컬럼 (boards 테이블)</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1 mb-3">
          <li>• <code>show_view_list / show_view_card / show_view_photo</code> — 각 뷰의 토글 노출 여부 (default true)</li>
          <li>• <strong>활성 뷰가 2개 이상</strong>일 때만 토글 UI 표시. <strong>1개 이하</strong>면 토글 자체 숨김</li>
          <li>• <strong>URL <code>?view=X</code>가 비활성 뷰</strong>이면 → 활성 뷰 중 첫 번째로 자동 폴백</li>
          <li>• <strong>모두 끄면</strong> list 폴백</li>
        </ul>
        <Tip>갤러리 게시판(<code>kind=&quot;gallery&quot;</code>)은 이 페이지를 안 쓰고 별도 <code>/gallery/&#123;slug&#125;</code> 라우트로 분기되므로 영향 없음.</Tip>
      </Accordion>

      <Accordion icon="🔍" title="게시판 검색폼 노출" badge="v1.5.139">
        <p className="mb-3 text-[var(--color-text-muted)]">
          게시판마다 검색 input + 검색 버튼의 표시 여부를 admin에서 토글할 수 있습니다. 정렬·뷰 토글·카테고리 칩·글쓰기 버튼은 영향 없습니다.
        </p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
          <li>• 컬럼: <code>boards.show_search_form</code> (BOOLEAN NOT NULL DEFAULT TRUE)</li>
          <li>• /admin/boards 게시판 수정 폼의 &quot;검색폼 표시&quot; 체크박스로 제어</li>
          <li>• 끄면 공개 페이지의 <code>&lt;form&gt;</code> 자체가 렌더링되지 않음</li>
        </ul>
      </Accordion>

      <Accordion icon="🔗" title="게시글 공유" badge="v1.5.140">
        <p className="mb-3 text-[var(--color-text-muted)]">
          글 상세에 공유 버튼을 노출하고 외부 공유(SNS·문자·링크 복사) 횟수를 카운트합니다. <strong>이중 토글</strong>(게시판 + 글)을 통과해야 노출됩니다.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
            <p className="font-semibold text-blue-800 mb-1">게시판 (admin)</p>
            <ul className="text-blue-700 space-y-0.5">
              <li>• <code>boards.share_enabled</code> 토글 (default true)</li>
              <li>• &quot;공유 기능 사용&quot; 체크박스로 제어</li>
              <li>• 끄면 그 게시판 전체에서 공유 버튼·카운트 숨김</li>
            </ul>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-xs">
            <p className="font-semibold text-purple-800 mb-1">글 (작성자)</p>
            <ul className="text-purple-700 space-y-0.5">
              <li>• <code>posts.share_allowed</code> 토글 (default false)</li>
              <li>• 글쓰기·편집 폼의 &quot;이 글의 공유를 허용합니다&quot; 체크박스</li>
              <li>• 체크해야 상세 페이지에 🔗 공유 버튼 노출</li>
            </ul>
          </div>
        </div>
        <p className="mb-2 font-medium">공유 방식</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1 mb-3">
          <li>• <strong>Web Share API</strong>(<code>navigator.share</code>) 우선 — 모바일에서 OS 공유 메뉴(카톡·문자·SNS 등)</li>
          <li>• 지원 안 되는 PC 브라우저는 <strong>클립보드 복사</strong> + &quot;링크가 복사되었습니다&quot; 토스트</li>
          <li>• 사용자가 공유 다이얼로그를 취소(AbortError)하면 카운트 미증가</li>
        </ul>
        <p className="mb-2 font-medium">목록 공유수 컬럼</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
          <li>• <code>boards.list_show_shares</code> + <code>boards.share_enabled</code> 모두 true일 때만 노출</li>
          <li>• 목록(List) 우측 메타 + 카드(Card) 메타 라인에 <code>🔗 N</code> 표시</li>
        </ul>
      </Accordion>

      <Accordion icon="👥" title="회원 관리" badge="/admin/members">
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          {[
            { label: "활성화", desc: "이메일 미인증 또는 비활성 회원을 수동으로 로그인 가능 상태로 전환" },
            { label: "비활성화", desc: "로그인을 차단하되 데이터는 보존. 언제든 재활성화 가능" },
            { label: "초기 비밀번호 재설정", desc: "임시 비밀번호 0629 로 초기화. 회원에게 별도 안내 필요" },
            { label: "삭제", desc: "회원 계정·게시글·댓글 완전 삭제. 복구 불가" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-[var(--color-border)] p-3">
              <p className="font-medium text-xs mb-1">{item.label}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>
        <Warn>운영자 지정·회수는 최고관리자만 가능합니다. 운영자에게는 해당 버튼이 표시되지 않습니다.</Warn>
      </Accordion>

      <Accordion icon="🛡️" title="운영자 권한 매트릭스" badge="v1.5.141">
        <p className="mb-3 text-[var(--color-text-muted)]">
          역할별로 게시글·댓글에 대한 권한이 다릅니다. 최고관리자·운영자는 게시글의 모든 권한을 가지며, 게시판관리자(moderator)는 자기 보드의 글 수정·삭제, 작성자는 자기 글 수정·삭제만 가능합니다.
        </p>
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--color-surface-warm)]">
                <th className="text-left px-3 py-2 font-semibold">역할</th>
                <th className="px-2 py-2">글쓰기</th>
                <th className="px-2 py-2">수정 (자기)</th>
                <th className="px-2 py-2">수정 (타인)</th>
                <th className="px-2 py-2">삭제</th>
                <th className="px-2 py-2">이동</th>
                <th className="px-2 py-2">복사</th>
                <th className="px-2 py-2">핀</th>
                <th className="px-2 py-2">댓글 관리 (타인)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-medium">최고관리자</td>
                <td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td>
              </tr>
              <tr className="border-t border-[var(--color-border)] bg-purple-50/40">
                <td className="px-3 py-2 font-medium">운영자</td>
                <td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td>
              </tr>
              <tr className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-medium">게시판관리자 (해당 보드)</td>
                <td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center">✅</td><td className="text-center text-red-500">✗</td>
              </tr>
              <tr className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-medium">작성자</td>
                <td className="text-center">✅</td><td className="text-center">✅</td><td className="text-center text-gray-400">—</td><td className="text-center">자기만</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td>
              </tr>
              <tr className="border-t border-[var(--color-border)]">
                <td className="px-3 py-2 font-medium">일반 회원</td>
                <td className="text-center">보드 정책</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td><td className="text-center text-red-500">✗</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Tip>글쓰기 가능 여부는 게시판 설정(<code>members_only_write</code>, <code>moderator_only_write</code>)에 따라 회원에게 추가 제약이 걸립니다.</Tip>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          공개 글 상세 페이지의 액션 바: [이동][복사][수정][삭제][목록으로] — 이동/복사는 최고관리자·운영자에게만, 수정/삭제는 권한 있는 역할에게만 노출됩니다.
        </p>
      </Accordion>

      <Accordion icon="🚫" title="자기 자신 비활성화·삭제 방지" badge="v1.5.142">
        <p className="mb-3 text-[var(--color-text-muted)]">
          운영자가 본인 행에서 [비활성화] 또는 [삭제] 버튼을 누르면 자기 세션이 즉시 무효화되어 admin 페이지 접근이 막힙니다(<code>is_active=false</code> 조건의 인증 헬퍼). 이 사고를 방지하기 위한 이중 가드입니다.
        </p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1 mb-3">
          <li>• <strong>백엔드</strong>: <code>PUT /api/members/admin/&#123;id&#125;/deactivate</code>, <code>DELETE /api/members/admin/&#123;id&#125;</code> 가 <code>isinstance(_admin, Member) and _admin.id == target.id</code> 이면 <strong>400 반환</strong></li>
          <li>• <strong>프론트</strong>: /admin/members 의 본인 행 [비활성화] [삭제] [권한 회수] 버튼이 <code>disabled</code>, 호버 시 &quot;자신에게는 적용할 수 없습니다&quot; 툴팁</li>
          <li>• 슈퍼관리자는 <code>Admin</code> 테이블이라 Member 목록에 자기 행이 없어 별도 가드 불필요</li>
        </ul>
        <Warn>비활성화는 강한 조치입니다 — 신규 로그인 차단 + <strong>기존 발급된 JWT까지 즉시 무효화</strong>. 모든 인증 헬퍼가 <code>Member.is_active == True</code>로 필터링하기 때문입니다.</Warn>
      </Accordion>

      <Accordion icon="⛪" title="본당 정보" badge="/admin/parish">
        <Steps items={[
          "미사 시간 텍스트 수정 (평일·토요일·주일·공휴일 등)",
          "주임 신부 이름·소개글 수정",
          "신부님 사진 업로드 후 목록에서 '대표 선택' 클릭",
          "저장하면 홈페이지·/about 페이지에 즉시 반영",
        ]} />
        <Tip>사진은 여러 장 업로드 후 하나를 대표로 선택할 수 있습니다. 대표 사진만 공개 페이지에 표시됩니다.</Tip>
      </Accordion>

      <Accordion icon="📄" title="페이지 콘텐츠 관리" badge="/admin/content">
        <p className="text-xs text-[var(--color-text-muted)] mb-3">탭 선택으로 각 콘텐츠 영역을 관리합니다.</p>
        {[
          { label: "성당 역사", desc: "연도·제목·설명 항목으로 /history 페이지 구성" },
          { label: "사목 방향", desc: "연도별 사목 목표·슬로건. /vision 페이지에 최신 항목 표시" },
          { label: "단체 목록", desc: "/groups 페이지의 본당 단체·분과 정보" },
          { label: "정적 페이지", desc: "성 베드로 (/saint), 사목평의회 (/council), 묵상 (/meditation), 기도문 (/prayer) 본문 편집" },
          { label: "묵상 글", desc: "날짜별 묵상. 발행일 기준으로 /meditation/archive 에 목록 표시" },
          { label: "사목평의회 위원", desc: "사진 포함 위원 목록. /council 페이지에 표시" },
        ].map((item) => (
          <div key={item.label} className="flex gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
            <span className="font-medium text-xs w-28 shrink-0">{item.label}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{item.desc}</span>
          </div>
        ))}
      </Accordion>

      <Accordion icon="🧭" title="메뉴 관리" badge="/admin/menus">
        <p className="mb-3 text-[var(--color-text-muted)]">
          홈페이지 상단 헤더(드롭다운/메가메뉴)와 페이지 사이드바에 노출되는 모든 메뉴를 한 곳에서 관리합니다.
          코드 수정 없이 메뉴 구성을 바꿀 수 있습니다.
        </p>

        <p className="mb-2 font-medium">기본 구조</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1 mb-4">
          <li>• <strong>그룹</strong>(예: 성당 소개, 본당 공동체) — 헤더의 큰 카테고리. 사이드바 최상위.</li>
          <li>• <strong>항목</strong> — 그룹 안의 메뉴. 항목 아래 자식 항목까지 <strong>최대 2-deep</strong> 서브메뉴 가능</li>
          <li>• 같은 그룹/항목 데이터가 헤더와 사이드바 양쪽에 동시에 사용됩니다</li>
        </ul>

        <p className="mb-2 font-medium">새 항목 만들기 — 3가지 연결 방식</p>
        <div className="rounded-lg border border-[var(--color-border)] overflow-hidden mb-4">
          {[
            {
              type: "정적 페이지",
              code: "page",
              desc: "내부 페이지 경로. 화이트리스트(/about, /history 등)에서 선택하거나 /groups/{slug} 같은 동적 경로 직접 입력. 같은 페이지는 한 메뉴 항목에만 연결 가능.",
            },
            {
              type: "게시판",
              code: "board",
              desc: "드롭다운에서 게시판 선택. 라벨은 게시판 이름이 자동 매핑됨. 한 게시판은 한 메뉴 항목에만 연결.",
            },
            {
              type: "외부 URL",
              code: "external",
              desc: "https://… 형태의 외부 링크. 새 탭으로 자동 열림. 중복 허용.",
            },
          ].map((row, i) => (
            <div key={row.code} className={`px-4 py-3 text-xs ${i % 2 === 0 ? "bg-white" : "bg-[var(--color-surface-warm)]"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[var(--color-primary)]">{row.type}</span>
                <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text)]">{row.code}</code>
              </div>
              <p className="text-[var(--color-text-muted)]">{row.desc}</p>
            </div>
          ))}
        </div>

        <p className="mb-2 font-medium">메뉴 라벨 — 사이트 전역 단일 진실 소스</p>
        <Steps items={[
          "메뉴 라벨은 항상 직접 입력 (필수). 페이지/게시판 이름 자동 모드는 폐기됨",
          "여기에 적은 라벨이 헤더 네비, 그룹 사이드바, 페이지 제목(브레드크럼+H1), 사이트맵에 일괄 적용",
          "메뉴에 등록되지 않은 동적/하위 페이지(예: 게시글 상세, 묵상 아카이브)는 페이지 자체의 title 유지",
        ]} />

        <p className="mb-2 font-medium mt-4">사이드바 전용 설정 (그룹 단위)</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
          <li>• <strong>sidebar_image_url</strong> — 사이드바 상단에 표시되는 배너 이미지</li>
          <li>• <strong>sidebar_width_px</strong> — 160~400px 범위. 모바일은 자동으로 가로 스크롤 칩으로 변환</li>
          <li>• <strong>show_in_header</strong> 해제 시 헤더에서만 숨김 (사이드바에는 여전히 노출)</li>
        </ul>

        <p className="mb-2 font-medium mt-4">순서·이동·표시 제어</p>
        <Steps items={[
          "↑↓ 버튼으로 항목/그룹 순서 변경 (sort_order 자동 정규화)",
          "항목의 '그룹 이동' 드롭다운으로 다른 그룹으로 이동 가능",
          "is_active 해제 = 공개 메뉴에서 숨김. 관리자 페이지에서는 여전히 보임",
        ]} />

        <p className="mb-2 font-medium mt-4">자동 동기화 항목 (auto:*)</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          새 게시판이나 분과(/admin/boards · /admin/community)를 추가하면
          해당 메뉴 항목이 <strong>자동으로 생성</strong>되어 적절한 그룹에 들어갑니다.
          관리 화면에서 <code className="font-mono">auto:boards</code>, <code className="font-mono">auto:groups</code> 등의 뱃지로 표시됩니다.
        </p>
        <Tip>
          원본(게시판·분과)을 삭제하면 자동 메뉴 항목도 함께 사라집니다.
          자동 항목도 라벨·순서·그룹은 자유롭게 바꿀 수 있고, 그 설정은 보존됩니다.
        </Tip>

        <p className="mb-2 font-medium mt-4">자주 쓰는 흐름</p>
        <Steps items={[
          "정적 페이지 추가: /admin/pages 에서 페이지 생성 → 자동으로 메뉴 후보 등장 → /admin/menus에서 그룹 선택",
          "외부 링크 추가: + 항목 추가 → link_type=외부 URL → https://… 입력 → 저장",
          "그룹 새로 만들기: + 그룹 추가 → 키(영문)·라벨 입력 → 사이드바 이미지·폭 선택",
          "메뉴에서 임시로 숨기기: 항목 행에서 is_active 체크 해제",
        ]} />
        <Warn>
          한 페이지/게시판은 한 메뉴 항목에만 연결할 수 있습니다 (중복 등록 차단).
          외부 URL은 같은 주소를 여러 곳에 두는 것이 허용됩니다.
        </Warn>
      </Accordion>

      <Accordion icon="🖼️" title="갤러리 관리" badge="/admin/gallery">
        <Steps items={[
          "상단에서 게시판 선택: 전례 사진(liturgy) 또는 행사 사진(photo)",
          "제목 입력 + 사진 파일 다중 선택",
          "업로드 버튼 클릭 → 게시글 생성 후 이미지 자동 첨부",
          "삭제: 갤러리 카드에 마우스를 올리면 나타나는 ✕ 버튼 클릭",
        ]} />
        <Tip>업로드된 사진은 /gallery/liturgy 또는 /gallery/events 공개 페이지에 즉시 표시됩니다. 로그인 회원만 갤러리에 직접 사진을 올릴 수 있습니다 (관리자 외).</Tip>
      </Accordion>

      <Accordion icon="📅" title="행사 캘린더" badge="/admin/calendar">
        <Steps items={[
          "+ 행사 등록 버튼 클릭",
          "행사명, 날짜(시작·종료), 유형, 설명 입력",
          "저장하면 /calendar 페이지 해당 월에 표시",
          "행사 완료 후 상태를 '기록대기' → '기록됨'으로 변경 가능",
        ]} />
        <p className="text-xs text-[var(--color-text-muted)] mt-2">행사 상태: <span className="text-blue-600">예정</span> → <span className="text-orange-600">기록대기</span> → <span className="text-green-600">기록됨</span></p>
        <Tip>주보 AI 분석 결과를 '캘린더 행사로 등록' 승인하면 자동으로 이 목록에 추가됩니다.</Tip>
      </Accordion>

      <Accordion icon="📚" title="아카이브 관리" badge="/admin/pastors · /admin/priests">
        <p className="mb-2 font-medium">역대 사목자 (/admin/pastors)</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">이름, 직함(주임신부·보좌신부 등), 부임일, 이임일(현직이면 비워둠), 소개글, 사진</p>
        <p className="mb-2 font-medium">본당 출신 사제 (/admin/priests)</p>
        <p className="text-xs text-[var(--color-text-muted)] mb-3">이름, 직책/현황(예: 대전교구 ○○본당 주임), 사제서품일(필수), 세례일(선택), 소개글, 사진</p>
        <Tip>사진은 등록 후 목록에서 '사진' 버튼으로 별도 업로드합니다.</Tip>
      </Accordion>

      <Accordion icon="💚" title="회원 관심 분과·단체" badge="자동 온보딩 + 카톡 알림 대상">
        <p className="mb-3 text-[var(--color-text-muted)]">
          회원이 관심 있는 분과·단체를 선택해두면, 향후 그 분과의 새 글·행사 알림을 카톡으로 받을 수 있습니다.
          카톡 발송 자체는 채널 개설 후 활성화 예정입니다.
        </p>
        <p className="mb-2 font-medium">동작 흐름</p>
        <Steps items={[
          "신규 회원 첫 로그인 → OnboardingGate가 /onboarding/interests로 자동 redirect",
          "분과(parent) 또는 소속단체(child)를 자유롭게 선택. 단체만 선택해도 백엔드가 부모 분과를 자동 INSERT",
          "응답('완료' 또는 '선택 안함') 시 interest_prompt_completed=true 마킹 → 다음 로그인부터 묻지 않음",
          "이후 마이페이지 '내 관심 분과·단체' 섹션에서 언제든 수정",
          "/groups/[slug] 분과 상세 페이지에서도 단건 등록·해제 가능",
        ]} />
        <p className="mb-2 mt-4 font-medium">데이터 모델</p>
        <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
          <li>• <code>members.interest_prompt_completed</code> (bool) — 온보딩 응답 여부</li>
          <li>• <code>members.notify_kakao</code> (bool) — 카톡 알림 수신 동의 (글로벌)</li>
          <li>• <code>member_community_interests(member_id, community_group_id, UNIQUE)</code> — 다대다</li>
        </ul>
        <Tip>
          분과 해제 시 등록된 소속단체가 있으면 <strong>confirm</strong> 후 함께 해제됩니다.
          백엔드 부모 자동 포함 정책과 충돌 방지를 위함입니다.
        </Tip>
        <Warn>
          카톡 발송 로직은 미구현(stub)입니다. 카카오 비즈니스 채널 개설 후 어댑터를 연결해 활성화합니다.
        </Warn>
      </Accordion>

      <Accordion icon="🔒" title="세션 만료 정책" badge="12h 기본 / 7d 옵션">
        <p className="mb-3 text-[var(--color-text-muted)]">관리자·회원 공통 정책입니다.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="font-semibold text-sm mb-1">기본 (체크 안 함)</p>
            <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
              <li>• 토큰 만료: <strong>12시간</strong></li>
              <li>• <strong>30분 무활동</strong> 시 경고 + 5분 카운트 후 자동 로그아웃</li>
              <li>• 재부팅 후 다음날 접속 시 만료</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="font-semibold text-sm mb-1">로그인 상태 유지 체크</p>
            <ul className="text-xs text-[var(--color-text-muted)] space-y-1">
              <li>• 토큰 만료: <strong>7일</strong></li>
              <li>• idle 타이머 비활성</li>
              <li>• 명시적으로 선택한 경우만</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-3">
          관리자 admin_authed 쿠키 max-age와 localStorage admin_token_exp가 동시에 토큰 만료에 맞춰 설정됩니다.
          페이지 로드 시 만료된 토큰은 자동 정리됩니다.
        </p>
      </Accordion>

      <Accordion icon="📋" title="활동 로그" badge="/admin/logs">
        <p className="text-[var(--color-text-muted)] mb-2">관리자가 수행한 모든 주요 행동이 자동으로 기록됩니다.</p>
        <p className="font-medium mb-2">기록되는 항목</p>
        <div className="grid grid-cols-2 gap-1 text-xs text-[var(--color-text-muted)]">
          {["관리자 로그인", "주보 업로드·삭제", "공지 생성·수정·삭제", "회원 활성화·비활성화", "관리자 권한 부여·회수", "게시글·댓글 삭제", "본당 정보 수정", "행사 등록·수정·삭제"].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] shrink-0" />
              {i}
            </div>
          ))}
        </div>
        <Tip>로그는 삭제되지 않으며 페이지네이션으로 전체 이력을 조회할 수 있습니다.</Tip>
      </Accordion>

    </div>
  );
}

function TechTab() {
  return (
    <div className="space-y-6">
      {/* 기술 스택 카드 */}
      <div>
        <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">기술 스택</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: "Frontend", icon: "🖥️",
              items: ["Next.js 16 (App Router · Turbopack)", "TypeScript", "Tailwind CSS", "NextAuth.js 5", "Kakao Maps/Share JS SDK"],
            },
            {
              label: "Backend", icon: "⚙️",
              items: ["FastAPI 0.110+", "SQLAlchemy 2 (ORM)", "Alembic (마이그레이션)", "Pydantic v2", "python-jose (JWT)", "bcrypt"],
            },
            {
              label: "Database", icon: "🗄️",
              items: ["PostgreSQL 15", "psycopg2-binary"],
            },
            {
              label: "AI", icon: "🤖",
              items: ["Claude claude-haiku-4-5 (Anthropic)", "주보 PDF 텍스트·이미지 분석", "행사·공지 자동 추출"],
            },
            {
              label: "인프라", icon: "🚀",
              items: ["Cafe24 VPS (Linux)", "Nginx (리버스 프록시)", "Uvicorn (ASGI)", "로컬 /uploads/ 파일 저장"],
            },
            {
              label: "인증", icon: "🔑",
              items: ["관리자: FastAPI JWT (localStorage)", "회원: NextAuth HTTP-only cookie", "세션: 기본 12h + idle 30분 / 유지 옵션 7일", "권한 변경 즉시 동기화 (SessionSync)", "이메일 인증 토큰 · Google·Kakao 소셜 로그인"],
            },
          ].map((stack) => (
            <div key={stack.label} className="rounded-xl border border-[var(--color-border)] p-4 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span>{stack.icon}</span>
                <span className="font-semibold text-sm text-[var(--color-primary)]">{stack.label}</span>
              </div>
              <ul className="space-y-1">
                {stack.items.map((item) => (
                  <li key={item} className="text-xs text-[var(--color-text-muted)] flex items-start gap-1.5">
                    <span className="mt-1 w-1 h-1 rounded-full bg-[var(--color-border-dark)] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* 환경 변수 */}
      <div>
        <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">환경 변수</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Frontend (.env.local)</p>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {[
                { key: "NEXT_PUBLIC_API_URL", desc: "백엔드 API 기본 URL (예: http://localhost:8000)" },
                { key: "NEXT_PUBLIC_KAKAO_MAP_KEY", desc: "카카오 JS API 키 — 지도 + 공유 버튼 공용" },
                { key: "NEXTAUTH_SECRET", desc: "NextAuth 세션 JWT 서명 키 (랜덤 32자 이상)" },
                { key: "NEXTAUTH_URL", desc: "배포 공개 URL (예: https://sjpeter.org)" },
              ].map((env, i) => (
                <div key={env.key} className={`px-4 py-3 text-xs ${i % 2 === 0 ? "bg-white" : "bg-[var(--color-surface-warm)]"}`}>
                  <code className="font-mono font-bold text-[var(--color-primary)]">{env.key}</code>
                  <p className="text-[var(--color-text-muted)] mt-0.5">{env.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2 uppercase tracking-wide">Backend (.env)</p>
            <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
              {[
                { key: "DATABASE_URL", desc: "PostgreSQL 연결 문자열 (postgresql+psycopg2://...)" },
                { key: "SECRET_KEY", desc: "JWT 서명 키 (관리자·회원 토큰 공용)" },
                { key: "ANTHROPIC_API_KEY", desc: "Claude API 키 — 주보 AI 분석에 사용" },
                { key: "UPLOAD_DIR", desc: "업로드 파일 저장 경로 (기본: ./uploads)" },
                { key: "ADMIN_ID / ADMIN_PASSWORD", desc: "최고관리자 ID·비밀번호 (해시 저장)" },
              ].map((env, i) => (
                <div key={env.key} className={`px-4 py-3 text-xs ${i % 2 === 0 ? "bg-white" : "bg-[var(--color-surface-warm)]"}`}>
                  <code className="font-mono font-bold text-[var(--color-primary)]">{env.key}</code>
                  <p className="text-[var(--color-text-muted)] mt-0.5">{env.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 디렉토리 구조 */}
      <div>
        <h2 className="text-sm font-bold text-[var(--color-primary)] mb-3">주요 디렉토리 구조</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-gray-950 text-green-300 p-4 font-mono text-xs leading-6">
            <p className="text-gray-500 mb-2"># Frontend</p>
            <p>frontend/</p>
            <p>├── app/</p>
            <p>│&nbsp;&nbsp; ├── admin/        # 관리자 패널</p>
            <p>│&nbsp;&nbsp; ├── boards/       # 게시판·게시글</p>
            <p>│&nbsp;&nbsp; ├── gallery/      # 갤러리</p>
            <p>│&nbsp;&nbsp; ├── groups/       # 분과·단체 + 관심 등록</p>
            <p>│&nbsp;&nbsp; ├── members/      # 회원 인증·마이페이지</p>
            <p>│&nbsp;&nbsp; ├── onboarding/   # 관심분과 첫 선택</p>
            <p>│&nbsp;&nbsp; └── ...           # 공개 페이지</p>
            <p>├── components/       # SessionSync·OnboardingGate 등</p>
            <p>├── lib/              # API 타입·유틸</p>
            <p>└── auth.ts           # NextAuth (isAdmin·interestPromptCompleted)</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-gray-950 text-green-300 p-4 font-mono text-xs leading-6">
            <p className="text-gray-500 mb-2"># Backend</p>
            <p>backend/</p>
            <p>├── app/</p>
            <p>│&nbsp;&nbsp; ├── api/          # 라우터 모듈</p>
            <p>│&nbsp;&nbsp; ├── models/       # SQLAlchemy 모델</p>
            <p>│&nbsp;&nbsp; └── deps.py       # 의존성 (auth 등)</p>
            <p>├── alembic/          # DB 마이그레이션</p>
            <p>├── uploads/          # 업로드 파일</p>
            <p>└── main.py           # FastAPI 앱 진입점</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiTab() {
  return (
    <div className="space-y-6 text-sm">
      <p className="text-[var(--color-text-muted)] text-xs">기본 URL: <code className="font-mono">{"{NEXT_PUBLIC_API_URL}"}/api</code> — 권한 없는 항목은 <code>Authorization: Bearer {"{token}"}</code> 헤더 필요</p>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">인증 (Auth)</h3>
        <ApiTable>
          <ApiRow method="POST" path="/auth/admin-login" desc="최고관리자 또는 운영자 로그인 (identifier, password)" />
          <ApiRow method="POST" path="/auth/admin-session" desc="회원 JWT → 관리자 토큰 교환 (운영자용)" auth="회원" />
          <ApiRow method="GET"  path="/auth/admin-me" desc="현재 관리자 정보 조회" auth="관리자" />
          <ApiRow method="POST" path="/members/login" desc="회원 로그인 (email, password)" />
          <ApiRow method="POST" path="/members/register" desc="회원 가입" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">주보 (Bulletins)</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/bulletins/" desc="주보 목록 (skip, limit)" />
          <ApiRow method="GET"  path="/bulletins/latest" desc="최신 주보 1건" />
          <ApiRow method="POST" path="/bulletins/" desc="주보 업로드 (multipart: date, issue_number, season, gospel_ref, file)" auth="관리자" />
          <ApiRow method="DELETE" path="/bulletins/{id}" desc="주보 삭제" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/{id}/analyze" desc="AI 분석 트리거" auth="관리자" />
          <ApiRow method="GET"  path="/bulletins/extractions/pending" desc="미처리 추출 목록" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/extractions/{id}/approve" desc="추출 → 게시글 등록" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/extractions/{id}/approve-as-event" desc="추출 → 캘린더 행사 등록" auth="관리자" />
          <ApiRow method="POST" path="/bulletins/extractions/{id}/reject" desc="추출 거부" auth="관리자" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">회원 (Members)</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/members/me" desc="내 프로필 (interest_prompt_completed, notify_kakao 포함)" auth="회원" />
          <ApiRow method="PUT"  path="/members/me" desc="프로필 수정 (name, nickname, phone, password)" auth="회원" />
          <ApiRow method="DELETE" path="/members/me" desc="계정 삭제" auth="회원" />
          <ApiRow method="POST" path="/members/me/avatar" desc="아바타 업로드" auth="회원" />
          <ApiRow method="GET"  path="/members/me/interests" desc="내 관심 분과·단체 + 카톡 알림 설정" auth="회원" />
          <ApiRow method="PUT"  path="/members/me/interests" desc="관심분과 덮어쓰기 (단체 선택 시 부모 자동 포함)" auth="회원" />
          <ApiRow method="POST" path="/members/me/interests/skip" desc="'관심분과 선택 안함' 온보딩 응답 마킹" auth="회원" />
          <ApiRow method="GET"  path="/members/admin/stats" desc="대시보드 통계" auth="관리자" />
          <ApiRow method="GET"  path="/members/admin/list" desc="회원 목록 (page, q, is_active)" auth="관리자" />
          <ApiRow method="PUT"  path="/members/admin/{id}/activate" desc="회원 활성화" auth="관리자" />
          <ApiRow method="PUT"  path="/members/admin/{id}/deactivate" desc="회원 비활성화" auth="관리자" />
          <ApiRow method="PATCH" path="/members/admin/{id}/reset-password" desc="비밀번호 임시 발급 (1회 표시)" auth="관리자" />
          <ApiRow method="PATCH" path="/members/admin/{id}/grant-admin" desc="관리자 권한 부여" auth="최고관리자" />
          <ApiRow method="PATCH" path="/members/admin/{id}/revoke-admin" desc="관리자 권한 회수" auth="최고관리자" />
          <ApiRow method="DELETE" path="/members/admin/{id}" desc="회원 삭제" auth="관리자" />
          <ApiRow method="GET"  path="/members/admin/logs" desc="활동 로그 (page, size)" auth="관리자" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">게시판·게시글 (Boards)</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/boards" desc="게시판 목록" />
          <ApiRow method="POST" path="/boards" desc="게시판 생성" auth="관리자" />
          <ApiRow method="PUT"  path="/boards/{slug}" desc="게시판 수정" auth="관리자" />
          <ApiRow method="DELETE" path="/boards/{slug}" desc="게시판 삭제" auth="관리자" />
          <ApiRow method="GET"  path="/boards/{slug}/posts" desc="게시글 목록 (page)" />
          <ApiRow method="POST" path="/boards/{slug}/posts" desc="게시글 작성" auth="회원" />
          <ApiRow method="GET"  path="/boards/{slug}/posts/{id}" desc="게시글 상세 (조회수 증가)" />
          <ApiRow method="PUT"  path="/boards/{slug}/posts/{id}" desc="게시글 수정" auth="회원" />
          <ApiRow method="DELETE" path="/boards/{slug}/posts/{id}" desc="게시글 삭제 (작성자 또는 관리자)" auth="회원" />
          <ApiRow method="POST" path="/boards/{slug}/posts/{id}/comments" desc="댓글 작성" auth="회원" />
          <ApiRow method="DELETE" path="/boards/{slug}/posts/{id}/comments/{cid}" desc="댓글 삭제" auth="회원" />
          <ApiRow method="POST" path="/boards/{slug}/posts/{id}/attachments" desc="첨부파일 업로드 (10 MB 제한)" auth="회원" />
        </ApiTable>
      </div>

      <div>
        <h3 className="font-semibold text-[var(--color-primary)] mb-2">공지·본당·콘텐츠·이벤트·아카이브</h3>
        <ApiTable>
          <ApiRow method="GET"  path="/notices/" desc="공지 목록 (상단 고정 우선)" />
          <ApiRow method="POST" path="/notices/" desc="공지 생성" auth="관리자" />
          <ApiRow method="PUT"  path="/notices/{id}" desc="공지 수정" auth="관리자" />
          <ApiRow method="DELETE" path="/notices/{id}" desc="공지 삭제" auth="관리자" />
          <ApiRow method="GET"  path="/parish/" desc="본당 정보 (미사 시간·신부님)" />
          <ApiRow method="PUT"  path="/parish/" desc="본당 정보 수정" auth="관리자" />
          <ApiRow method="POST" path="/parish/photos/upload" desc="신부님 사진 업로드" auth="관리자" />
          <ApiRow method="GET"  path="/events" desc="월별 행사 목록 (year, month)" />
          <ApiRow method="POST" path="/events" desc="행사 등록" auth="관리자" />
          <ApiRow method="PATCH" path="/events/{id}/status" desc="행사 상태 변경" auth="관리자" />
          <ApiRow method="GET"  path="/archive/pastors" desc="역대 사목자 목록" />
          <ApiRow method="POST" path="/archive/pastors" desc="사목자 등록" auth="관리자" />
          <ApiRow method="POST" path="/archive/pastors/{id}/photo" desc="사목자 사진 업로드" auth="관리자" />
          <ApiRow method="GET"  path="/archive/priests" desc="본당 출신 사제 목록" />
          <ApiRow method="POST" path="/archive/priests" desc="사제 등록" auth="관리자" />
          <ApiRow method="POST" path="/archive/priests/{id}/photo" desc="사제 사진 업로드" auth="관리자" />
          <ApiRow method="GET"  path="/gospel/today" desc="오늘의 복음 (캐시 24h)" />
          <ApiRow method="GET"  path="/search" desc="전체 검색 (q)" />
          <ApiRow method="GET"  path="/health" desc="헬스체크" />
        </ApiTable>
      </div>
    </div>
  );
}

function ChangelogTab() {
  const tagColor: Record<Tag, string> = {
    기능: "bg-blue-100 text-blue-700",
    수정: "bg-red-100 text-red-700",
    디자인: "bg-purple-100 text-purple-700",
    인프라: "bg-gray-100 text-gray-700",
  };

  // 날짜별 그룹화 — CHANGELOG는 최신순이라 등장 순서대로 그룹 키 유지
  const groups: { date: string; versions: typeof CHANGELOG }[] = [];
  for (const v of CHANGELOG) {
    const last = groups[groups.length - 1];
    if (last && last.date === v.date) {
      last.versions.push(v);
    } else {
      groups.push({ date: v.date, versions: [v] });
    }
  }

  // 가장 최근 날짜만 디폴트로 펼침. 사용자가 토글 가능.
  const [openDates, setOpenDates] = useState<Set<string>>(
    () => new Set(groups[0] ? [groups[0].date] : []),
  );

  function toggle(date: string) {
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function expandAll() {
    setOpenDates(new Set(groups.map((g) => g.date)));
  }
  function collapseAll() {
    setOpenDates(new Set());
  }

  return (
    <div className="space-y-1">
      <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-3 text-xs text-[var(--color-text)] space-y-1">
        <p className="font-semibold text-[var(--color-primary)]">버전 규칙</p>
        <ul className="space-y-0.5 text-[var(--color-text-muted)]">
          <li>· 모든 변경은 <strong>patch +1</strong>로 누적합니다 (기능·수정 모두)</li>
          <li>· <span className="inline-block px-1 rounded bg-blue-100 text-blue-700">기능</span> / <span className="inline-block px-1 rounded bg-red-100 text-red-700">수정</span> 태그로 성격 구분</li>
          <li>· minor bump(1.5 → 1.6)는 큰 마일스톤에서만</li>
        </ul>
        <p className="text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)] mt-1">
          새 항목은 <code className="font-mono">frontend/app/admin/docs/page.tsx</code> 상단 <code className="font-mono">CHANGELOG</code> 배열 맨 앞에 추가하세요.
        </p>
      </div>

      {/* 전체 펼치기/접기 */}
      <div className="flex items-center justify-end gap-3 mb-2 text-xs">
        <button
          type="button"
          onClick={expandAll}
          className="text-[var(--color-primary)] hover:underline"
        >
          모두 펼치기
        </button>
        <span className="text-[var(--color-border-dark)]">·</span>
        <button
          type="button"
          onClick={collapseAll}
          className="text-[var(--color-text-muted)] hover:underline"
        >
          모두 접기
        </button>
      </div>

      {/* 날짜별 그룹 */}
      <div className="space-y-2">
        {groups.map((g, gi) => {
          const open = openDates.has(g.date);
          const totalItems = g.versions.reduce((sum, v) => sum + v.items.length, 0);
          return (
            <section
              key={g.date}
              className="rounded-lg border border-[var(--color-border)] bg-white overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(g.date)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface-warm)] transition-colors text-left"
              >
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span className="font-mono text-sm font-semibold text-[var(--color-text)]">
                    {g.date}
                  </span>
                  {gi === 0 && (
                    <span className="rounded-full bg-[var(--color-primary)] text-white text-[10px] px-1.5 py-0.5 font-semibold">
                      최신
                    </span>
                  )}
                  <span className="text-xs text-[var(--color-text-muted)]">
                    v{g.versions[g.versions.length - 1].version} ~ v{g.versions[0].version}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    · {g.versions.length}개 버전 · {totalItems}개 항목
                  </span>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? "" : "-rotate-90"}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {open && (
                <div className="px-4 pb-4 pt-1 border-t border-[var(--color-border)]">
                  {g.versions.map((v, vi) => (
                    <div key={v.version} className="flex gap-4">
                      {/* 타임라인 선 */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full border-2 mt-1 ${gi === 0 && vi === 0 ? "bg-[var(--color-primary)] border-[var(--color-primary)]" : "bg-white border-[var(--color-border-dark)]"}`} />
                        {vi < g.versions.length - 1 && <div className="w-px flex-1 bg-[var(--color-border)] mt-1" />}
                      </div>
                      {/* 내용 */}
                      <div className="pb-4 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`text-base font-bold ${gi === 0 && vi === 0 ? "text-[var(--color-primary)]" : "text-[var(--color-text)]"}`}>
                            v{v.version}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${tagColor[v.tag]}`}>{v.tag}</span>
                        </div>
                        <ul className="space-y-1">
                          {v.items.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-border-dark)] shrink-0" />
                              <span className="text-[var(--color-text)]">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function PhilosophyTab() {
  return (
    <div className="space-y-10 text-sm max-w-2xl mx-auto py-4">

      {/* 헤더 — 소유권 탭과 동일한 Cephas 카드 + 핵심 문구 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-6 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-3">소프트웨어 이름</p>
        <p className="font-serif text-4xl font-bold tracking-widest text-[var(--color-primary)] mb-1">Cephas</p>
        <p className="text-lg text-[var(--color-text-muted)] mb-4">세파스</p>
        <div className="mx-auto max-w-lg border-t border-[var(--color-border)] pt-4 space-y-1.5 text-xs text-[var(--color-text-muted)] leading-relaxed">
          <p>
            아람어 <span className="font-semibold text-[var(--color-text)]">כֵּיפָא (Kēpā)</span>에서 온 말로
            <span className="font-semibold text-[var(--color-text)]"> &ldquo;반석&rdquo;</span>을 뜻합니다.
            요한복음 1,42에서 예수님이 시몬에게 직접 붙여주신 이름으로,
            그리스어 Petros(페트로스), 한국어 베드로에 해당합니다.
          </p>
          <p className="italic text-[var(--color-text-muted)]">
            &ldquo;너는 베드로이다. 내가 이 반석 위에 내 교회를 세울 것이다.&rdquo; — 마태오 16,18
          </p>
        </div>
        <p className="mt-5 font-serif text-base text-[var(--color-primary)] italic leading-relaxed">
          &ldquo;우리 성당이 무엇을 소중히 여기는가&rdquo;를 기록하는 것.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-4 py-1.5 text-xs text-[var(--color-text-muted)]">
          <span className="font-mono font-semibold text-[var(--color-primary)]">v{CURRENT_VERSION}</span>
          <span>·</span>
          <span>세종 성베드로 성당 본당 홈페이지 소프트웨어</span>
        </div>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* 철학 1 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">1</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            홈페이지는 &ldquo;디지털 안내판&rdquo;이지 &ldquo;포털&rdquo;이 아니다
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            화려한 기능이 많을수록 좋은 홈페이지가 아닙니다.
            방문자가 <strong>10초 안에 필요한 정보를 찾을 수 있는 것</strong>이 좋은 홈페이지입니다.
          </p>
          <p>
            미사 시간, 이번 주 주보, 오늘의 복음. 신자가 성당 홈페이지에 들어오는 이유는
            대부분 이 세 가지 중 하나입니다. 세파스는 이 단순한 진실을 중심에 놓고 설계되었습니다.
          </p>
          <p className="text-[var(--color-text-muted)]">
            외형은 정보 전달. 내면은 역사 기록과 보존. 이 두 가지가 하나의 동작으로 이루어지도록
            구조를 설계했습니다.
          </p>
        </div>
      </div>

      {/* 철학 2 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">2</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            오늘을 기록하면 역사가 된다
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            &ldquo;역사를 기록해야겠다&rdquo;고 마음먹고 앉아서 하는 일은 지속되지 않습니다.
            대부분의 기록은 의도가 아니라 <strong>습관에서 태어납니다.</strong>
          </p>
          <p>
            세파스에서 관리자는 별도의 &ldquo;역사 기록&rdquo; 작업을 하지 않습니다.
            이번 주 주보를 올리고, 행사를 등록하고, 사진을 올리는 것.
            <strong>평소 하던 일을 그대로 하면, 역사가 쌓입니다.</strong>
          </p>
          <p className="text-[var(--color-text-muted)]">
            입력은 한 번. 역할은 두 가지 — 지금 이 순간의 정보 전달, 그리고 시간이 지난 뒤의 아카이브.
            10년 후 이 성당의 누군가가 오늘을 찾아볼 수 있도록.
          </p>
        </div>
      </div>

      {/* 철학 3 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">3</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            모든 기록은 주보와 연결된다
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            주보는 단순한 인쇄물이 아닙니다.
            매주 한 번, 공동체가 함께 나눈 말씀과 삶의 기록입니다.
            세파스는 <strong>주보를 공동체 역사의 축(軸)</strong>으로 설정합니다.
          </p>
          <p>
            주보 한 장을 올리면, AI가 그 안에 담긴 행사와 공지를 읽어내고,
            캘린더에 등록되고, 게시판에 공지됩니다.
            <strong>&ldquo;주보 하나 올리면, 나머지는 시스템이 한다.&rdquo;</strong>
          </p>
          <p className="text-[var(--color-text-muted)]">
            본당 사목지표, 행사 기록, 공지, 사진 — 이 모든 것이 주보를 중심으로 연결될 때,
            하나하나는 파편이 아니라 하나의 이야기가 됩니다.
          </p>
        </div>
      </div>

      {/* 철학 4 */}
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">4</span>
          <p className="font-serif font-bold text-base text-[var(--color-primary)] leading-snug">
            우리 성당이 무엇을 소중히 여기는가
          </p>
        </div>
        <div className="pl-9 space-y-2 text-[var(--color-text)] leading-relaxed">
          <p>
            모든 기획의 끝에는 이 질문이 있습니다.
            홈페이지의 구조, 기능의 우선순위, 데이터의 형태 —
            세파스의 모든 설계는 이 질문으로 수렴합니다.
          </p>
          <p>
            미사를 드리고, 말씀을 나누고, 함께 밥을 먹고, 아픈 이를 돕고,
            세상을 떠난 이를 기억하는 것.
            세파스가 기록하는 것은 결국 <strong>그 공동체가 살아낸 방식</strong>입니다.
          </p>
          <p className="text-[var(--color-text-muted)]">
            오늘 올린 주보, 오늘 등록한 사진, 오늘 남긴 공지 하나가
            언젠가 누군가에게 &ldquo;우리가 어떻게 살았는가&rdquo;를 말해줄 것입니다.
          </p>
        </div>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* 마무리 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-warm)] px-6 py-6 text-center space-y-3">
        <p className="text-[var(--color-text)] leading-relaxed">
          세파스는 소프트웨어입니다. 하지만 그 안에 담기는 것은
        </p>
        <p className="font-serif text-lg font-bold text-[var(--color-primary)]">
          세종 성베드로 성당 공동체의 시간과 기억입니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          &ldquo;너는 베드로이다. 내가 이 반석 위에 내 교회를 세울 것이다.&rdquo; — 마태오 16,18
        </p>
      </div>

    </div>
  );
}

function OwnershipTab() {
  return (
    <div className="space-y-6 text-sm max-w-2xl mx-auto">

      {/* 1. 가톨릭 교회 무료 사용 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-6 py-5">
        <h2 className="font-bold text-[var(--color-primary)] mb-3">사용 허가</h2>
        <p className="leading-relaxed text-[var(--color-text)]">
          본 소프트웨어 <strong>세파스(Cephas)</strong>는 <strong>가톨릭 교회</strong>에 한하여
          누구나 <strong>무료</strong>로 사용할 수 있습니다.
          본당·교구·수도회 단위로 자체 운영하실 수 있으며 별도의 사용료가 발생하지 않습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          단, <strong>상업적 용도</strong>로는 사용할 수 없습니다.
        </p>
      </div>

      {/* 2. 개발·배포 주체 */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-6 py-5">
        <h2 className="font-bold text-[var(--color-primary)] mb-3">개발·배포 주체</h2>
        <p className="leading-relaxed text-[var(--color-text)]">
          본 소프트웨어의 설계·구현·유지보수 책임은 개발자에게 있습니다.
          가톨릭 교회의 무료 사용 권리와는 별개로,
          소프트웨어 자체의 저작자(authorship) 권리는 개발자에게 있습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          본 시스템을 통해 등록·관리되는 모든 데이터(주보·사진·게시글·회원 정보 등)의 소유권은
          이를 운영하는 본당 — 본 사이트의 경우 <strong>세종 성베드로 성당</strong> — 에 있습니다.
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-3 leading-relaxed">
          본 소프트웨어가 사용하는 <strong>외부 API·서비스</strong>(카카오, AWS Bedrock(Claude) 등)의
          정책 변경·중단·요금 변동, 그리고 <strong>호스팅·서버 관리 및 장애 대응</strong>에 대한
          동작 보장 및 유지보수 의무는 개발자에게 없습니다.
        </p>
      </div>

      {/* 3. 개인정보 처리 고지 */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5">
        <h2 className="font-bold text-amber-800 mb-2">개인정보 처리 고지</h2>
        <p className="text-amber-800 leading-relaxed">
          본 시스템은 회원 가입 시 이름·이메일·연락처 등 개인정보를 수집합니다.
          수집된 개인정보는 본당 서비스 제공 목적으로만 사용되며,
          「개인정보 보호법」에 따라 <strong>세종 성베드로 성당</strong>이 처리 책임을 집니다.
          개인정보 관련 문의는 본당 사무실 또는 관리자 이메일로 연락하시기 바랍니다.
        </p>
      </div>

      {/* 4. 하단 © */}
      <div className="border-t border-[var(--color-border)] pt-4 text-xs text-[var(--color-text-muted)] text-center space-y-1">
        <p>
          <span className="font-medium text-[var(--color-text)]">소프트웨어·설계</span> © 강태훈 야고보 (hunskang@gmail.com · 010-5099-9979)
          <span className="mx-2 text-[var(--color-border-dark)]">·</span>
          <span className="font-medium text-[var(--color-text)]">데이터·콘텐츠</span> © 세종 성베드로 성당
        </p>
        <p>최초 작성: 2026-5</p>
      </div>

    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

const TABS = [
  { id: "philosophy", label: "세파스는",   icon: "✝"  },
  { id: "guide",      label: "기능 가이드", icon: "📖" },
  { id: "tech",       label: "기술 스택",   icon: "⚙️" },
  { id: "api",        label: "API",         icon: "🔌" },
  { id: "changelog",  label: "변경 이력",   icon: "📝" },
  { id: "ownership",  label: "사용권",      icon: "©️"  },
] as const;

type TabId = typeof TABS[number]["id"];

export default function AdminDocsPage() {
  const [tab, setTab] = useState<TabId>("philosophy");
  const [isSuper, setIsSuper] = useState(false);
  useEffect(() => {
    setIsSuper(typeof window !== "undefined" && localStorage.getItem("admin_is_super") === "true");
  }, []);

  // '변경 이력' 탭은 super-admin 전용. 비-super 는 메뉴에서도 숨기고, 직접 setTab 호출도 차단.
  const visibleTabs = TABS.filter((t) => t.id !== "changelog" || isSuper);
  const activeTab = tab === "changelog" && !isSuper ? "philosophy" : tab;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">기술문서 · 도움말</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">본당 홈페이지 관리 가이드</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] bg-[var(--color-primary)]/10 px-3 py-1 text-sm font-bold text-[var(--color-primary)]">
            v{CURRENT_VERSION}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">마지막 업데이트: {LAST_UPDATED}</span>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "philosophy" && <PhilosophyTab />}
      {activeTab === "guide"      && <GuideTab />}
      {activeTab === "tech"       && <TechTab />}
      {activeTab === "api"        && <ApiTab />}
      {activeTab === "changelog"  && isSuper && <ChangelogTab />}
      {activeTab === "ownership"  && <OwnershipTab />}
    </div>
  );
}
