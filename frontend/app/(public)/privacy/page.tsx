import PageHeader from "@/components/PageHeader";

export const metadata = {
  title: "개인정보 처리방침",
};

// ─────────────────────────────────────────────────────────────────────────────
//  ⚠ 이 본문은 한국 본당 사이트용 표준 템플릿이다. 본당의 실제 운영 정책에
//     맞춰 검수·수정한 뒤 시행한다. 시행일·연락처·DPO 등은 반드시 갱신.
// ─────────────────────────────────────────────────────────────────────────────
export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="개인정보 처리방침"
        subtitle="본당이 수집·이용하는 개인정보의 처리 방침을 안내합니다."
      />
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm leading-7 text-[var(--color-text)]">
        <p className="text-xs text-[var(--color-text-muted)] mb-8">
          시행일: 2026년 5월 22일
        </p>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">1. 수집하는 개인정보 항목</h2>
          <p>본당은 회원 가입·서비스 제공을 위해 다음 정보를 수집합니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>
              <span className="font-medium">필수</span>: 이메일, 이름, 세례명,
              비밀번호(암호화 저장)
            </li>
            <li>
              <span className="font-medium">선택</span>: 전화번호, 영명축일,
              프로필 사진, 관심 분과·단체, 이메일·카카오톡 알림 수신 동의
            </li>
            <li>
              <span className="font-medium">자동 수집</span>: 접속 일시,
              마지막 로그인 시각, 본당 사이트 내 활동 기록(게시글·댓글)
            </li>
            <li>
              <span className="font-medium">소셜 로그인 시</span>: 해당 provider
              (Google/Kakao) 가 제공하는 사용자 식별자·이메일·이름·프로필
              사진 URL
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">2. 개인정보의 수집·이용 목적</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>회원 식별 및 본인 확인</li>
            <li>주보·공지·행사 등 본당 안내 발송</li>
            <li>관심 분과·단체별 맞춤 소식 전달</li>
            <li>게시판·댓글 작성자 표시</li>
            <li>본당 운영을 위한 통계 분석 (개인 식별 불가능한 집계 형태)</li>
            <li>불법·부정 이용 방지 및 분쟁 해결</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">3. 개인정보의 보유·이용 기간</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              회원 가입 시점부터 회원 탈퇴 시까지 보유합니다.
            </li>
            <li>
              회원 탈퇴 시 프로필 정보(이름·세례명·전화번호·아바타·비밀번호 등)
              는 즉시 삭제됩니다. 작성한 글·댓글은 게시판의 흐름 유지를 위해
              “탈퇴 회원” 으로 익명화되어 보존됩니다.
            </li>
            <li>
              관련 법령에 따라 일정 기간 보존이 필요한 경우(예: 통신비밀보호법
              상 접속 로그 3개월) 해당 기간 동안만 보관 후 파기합니다.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">4. 개인정보의 제3자 제공</h2>
          <p>
            본당은 회원의 동의 없이 개인정보를 외부에 제공하지 않습니다. 다만
            법령에 따라 수사기관 등이 요구하는 경우에는 적법 절차에 따라
            제공할 수 있습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">5. 개인정보 처리의 위탁</h2>
          <p>
            본당은 서비스 제공을 위해 다음 위탁이 필요할 수 있습니다.
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>이메일 발송: SMTP 서비스 제공자 (예: Google Gmail)</li>
            <li>AI 분석 서비스: AWS Bedrock — 주보 PDF 텍스트·이미지 분석에 한해 일시 전송, 회원 개인정보는 전송 대상이 아님</li>
            <li>소셜 로그인: Google·Kakao OAuth — provider 의 인증 처리 한정</li>
            <li>호스팅: 본당이 계약한 클라우드/VPS 서비스 제공자</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">6. 회원의 권리</h2>
          <p>회원은 언제든 다음 권리를 행사할 수 있습니다.</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>개인정보 열람·정정: 마이페이지에서 직접 수정</li>
            <li>개인정보 처리 정지·삭제: 마이페이지에서 탈퇴</li>
            <li>알림 수신 동의 철회: 마이페이지에서 토글</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">7. 개인정보의 안전성 확보</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>비밀번호는 단방향 암호화(bcrypt) 후 저장합니다.</li>
            <li>중요 통신 구간은 HTTPS(TLS) 로 암호화합니다.</li>
            <li>외부 키(SMTP·OAuth·AWS 등)는 환경변수·DB 에 분리 보관하며, 코드 저장소(공개·비공개)에는 포함하지 않습니다.</li>
            <li>관리자 접근은 강력한 인증과 활동 로그로 모니터링합니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">8. 쿠키의 사용</h2>
          <p>
            본 사이트는 로그인 세션 유지를 위해 쿠키를 사용합니다. 브라우저
            설정에서 쿠키 저장을 거부하실 수 있으나 그 경우 일부 서비스 이용에
            제한이 있을 수 있습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">9. 개인정보 보호책임자</h2>
          <p>
            본당의 개인정보 처리 관련 문의는 본당 사무실로 연락 주시기
            바랍니다. (연락처는 본당 정보 페이지 참조)
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">10. 처리방침의 변경</h2>
          <p>
            본 처리방침은 관련 법령 변경 또는 본당 운영 상황에 따라 개정될 수
            있습니다. 변경 시 본 사이트 공지를 통해 시행일 7일 전부터
            게시하며, 중대한 변경은 30일 전부터 게시합니다.
          </p>
        </section>

        <p className="mt-12 text-xs text-[var(--color-text-muted)] border-t pt-4">
          본 처리방침은 본당의 운영 정책에 맞춰 검수·수정될 수 있습니다. 최신
          본문은 항상 본 페이지를 참조하시기 바랍니다.
        </p>
      </div>
    </>
  );
}
