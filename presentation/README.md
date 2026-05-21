# 본당 홈페이지 발표자료

`PRESENTATION_GUIDELINES.md` 기준에 맞춘 발표자료입니다. **현재 운영 중인 6대 기능 + 카카오채널** 만 다루며, **기승전결** 구조와 **밝고 깨끗한 화이트/네이비/옅은 골드** 톤을 사용합니다.

```
presentation/
├── PRESENTATION_GUIDELINES.md   # 작업 기준 (최우선 참조)
├── sjpeter.md                   # Marp 마크다운 (단일 소스)
├── reveal/
│   └── index.html               # 브라우저용 Reveal.js 슬라이드
├── pptx/
│   ├── build_pptx.py            # PowerPoint 생성 스크립트
│   └── sjpeter.pptx             # 완성된 .pptx (생성물)
└── screenshots/                 # 화면 캡처 보관 폴더
    └── README.md                # 약속된 파일명 목록
```

---

## 1. 발표자료 열기

```bash
# PowerPoint / Keynote / Google Slides
open presentation/pptx/sjpeter.pptx

# 브라우저 (Reveal.js)
open presentation/reveal/index.html
```

## 2. PPT 다시 빌드

스크린샷을 새로 넣었거나 내용을 고친 뒤:

```bash
cd backend && source venv/bin/activate
python ../presentation/pptx/build_pptx.py
```

콘솔에 어떤 스크린샷이 들어왔고 어떤 게 비어 있는지 한눈에 표시됩니다.

---

## 3. 스크린샷을 Claude Code에게 전달하는 방법

발표자료의 핵심은 **실제 홈페이지 화면**입니다. 4가지 방법 중 편한 것을 사용하세요.

### ✅ 방법 A. Finder에서 폴더에 직접 넣기 (가장 쉬움 · 추천)

1. Finder를 열고 다음 폴더로 이동
   ```
   /Users/kangtaehun/Dev/faithandme/presentation/screenshots/
   ```
2. 약속된 파일명으로 PNG를 저장 (예: `01-word-meditation.png`)
   - 약속된 파일명 목록은 `screenshots/README.md` 참고
3. 다음 메시지를 Claude Code에 보내면 끝
   ```
   스크린샷 넣었어. PPT 다시 빌드해줘.
   ```

### ✅ 방법 B. 화면 캡처 후 바로 폴더에 저장

macOS 기본 캡처 단축키:
- `Cmd + Shift + 4` → 영역 선택 캡처
- `Cmd + Shift + 5` → 옵션 메뉴 (저장 위치 변경 가능)

옵션 메뉴(`Cmd+Shift+5`)에서 **"저장 위치 → 기타 위치"** 를 위 `screenshots/` 폴더로 한 번만 지정해 두면, 이후 캡처가 자동으로 그 폴더에 저장됩니다.

파일명만 약속된 이름으로 바꿔주세요.

### ✅ 방법 C. Claude Code 대화창에 이미지 끌어다 놓기

세션 중 이미지를 끌어다 놓으면 Claude가 그 이미지를 받을 수 있습니다. 그러면 다음과 같이 부탁할 수 있습니다.

```
이 이미지를 screenshots/01-word-meditation.png 로 저장하고 PPT 다시 빌드해줘.
```

### ✅ 방법 D. 데스크탑·다운로드에서 옮겨달라고 부탁

캡처 파일이 데스크탑이나 다운로드 폴더에 있다면 경로만 알려주세요.

```
~/Desktop/홈화면.png 을 screenshots/01-word-meditation.png 로 옮기고
04 번 자리(주보 AI 추출)에 들어갈 ~/Downloads/관리자.png 도
04-bulletin-upload.png 로 옮긴 뒤 PPT 빌드해줘.
```

---

## 4. 약속된 파일명 빠른 보기

| 자리 | 파일명 |
|------|--------|
| ① 오늘의 말씀 + 묵상 | `01-word-meditation.png` |
| ② 성전건축 일지 | `02-construction-log.png` |
| ③ 내 관심 단체·모임 | `03-member-interests.png` |
| ④ 주보 AI 추출 | `04-bulletin-upload.png` |
| ⑤ 본당 역사 저장소 | `05-archive.png` |
| + 카카오 채널 연동 | `06-kakao.png` |
| 흐름 1 — 알림 수신 (4단계) | `flow1-step1.png` ~ `flow1-step4.png` |
| 흐름 2 — 주보 AI 추출 (4단계) | `flow2-step1.png` ~ `flow2-step4.png` |

자세한 안내는 `screenshots/README.md` 참고.

---

## 5. 슬라이드 구성 한눈에 (28장)

| 부 | 슬라이드 | 내용 |
|----|---------|------|
| **기** | 1~3 | 표지 · 들어가며 · 발표 흐름 |
| **승** | 4~12 | 6대 기능 한눈에 + 6개 기능 상세 + 카카오 채널 |
| **전** | 13~22 | 두 흐름의 표지 · 4단계 × 2흐름 |
| **결** | 23~28 | 한 자리에 모이는 기록 · 정리표 · 감사 |

---

## 6. 톤·디자인 규칙

- **배경**: 흰색(#FFFFFF), 섹션 표지는 옅은 크림(#F8F6F1)
- **메인 컬러**: 깊은 네이비(#1F2A44)
- **포인트 컬러**: 따뜻한 옅은 골드(#C9A862)
- **본문**: 정돈된 회색 톤 (#3A4358), 무지(無地) 배경 + 큰 여백
- **단계 그리드**: 활성 단계만 골드 강조, 비활성은 옅은 회색

가이드라인의 다음 항목을 준수합니다.
- 미구현 기능·향후 계획은 다루지 않음 (카카오채널만 예외)
- "큰 글씨", "단순한 메뉴" 같은 이상화된 표현 배제
- "우리성당", "본당가족" 그룹명 미사용
- 가톨릭 용어 (**성전건축** / 공동체)
- 사제·사목회 관련 구체적 사안 제외
- 코드 운영 규칙·CHANGELOG·내부 보안 원칙 등 기술적 자랑 제거
