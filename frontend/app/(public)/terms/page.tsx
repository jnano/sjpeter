import PageHeader from "@/components/PageHeader";

export const metadata = {
  title: "이용약관",
};

// ─────────────────────────────────────────────────────────────────────────────
//  ⚠ 이 본문은 한국 본당 사이트용 표준 템플릿이다. 본당의 실제 운영 정책에
//     맞춰 검수·수정한 뒤 시행한다. 시행일·연락처 등은 반드시 갱신.
// ─────────────────────────────────────────────────────────────────────────────
export default function TermsPage() {
  return (
    <>
      <PageHeader
        title="이용약관"
        subtitle="본당 홈페이지 회원 서비스 이용에 관한 약관입니다."
      />
      <div className="max-w-3xl mx-auto px-4 py-10 text-sm leading-7 text-[var(--color-text)]">
        <p className="text-xs text-[var(--color-text-muted)] mb-8">
          시행일: 2026년 5월 22일
        </p>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제1조 (목적)</h2>
          <p>
            본 약관은 본당 홈페이지(이하 “본 사이트”)가 제공하는 회원 서비스의
            이용 조건·절차, 본당과 회원 간의 권리·의무·책임 사항을 정함을
            목적으로 합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제2조 (회원의 가입)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              회원이 되고자 하는 자는 본 사이트가 정한 가입 양식에 정보를 기입한
              뒤 본 약관·개인정보 처리방침에 동의함으로써 가입을 신청합니다.
            </li>
            <li>
              본당은 신청자의 정보가 사실과 다르거나 본당 운영 목적에 부합하지
              않는다고 판단되면 가입을 거부하거나 보류할 수 있습니다.
            </li>
            <li>
              만 14세 미만 아동은 보호자 동의 후 가입할 수 있습니다.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제3조 (서비스의 내용)</h2>
          <p>본 사이트는 다음과 같은 서비스를 제공합니다.</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>주보·공지사항·행사·모임 일정 안내</li>
            <li>본당 게시판 및 댓글 기능</li>
            <li>이메일·카카오톡 등 본당 알림 수신</li>
            <li>본당이 별도 정하는 그 외 회원 대상 서비스</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제4조 (회원의 의무)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              회원은 가입 시 사실에 부합하는 정보를 제공해야 하며, 변경 사항이
              생기면 즉시 갱신할 책임이 있습니다.
            </li>
            <li>
              회원은 본당 및 다른 회원의 명예를 훼손하거나 가톨릭 정신에 반하는
              게시물을 작성·유포하지 않아야 합니다.
            </li>
            <li>
              회원은 자신의 계정 정보를 타인에게 양도·대여·공유해서는 안 됩니다.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제5조 (게시물의 관리)</h2>
          <p>
            본당은 회원이 작성한 게시물이 본 약관 또는 관련 법령에 위반된다고
            판단되면 사전 통지 없이 임시 조치 또는 삭제할 수 있습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제6조 (회원의 탈퇴 및 자격 상실)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>
              회원은 마이페이지에서 언제든 탈퇴할 수 있습니다. 탈퇴 시 회원의
              프로필 정보(이름·세례명·전화번호·아바타 등)는 즉시 삭제되며,
              작성한 글·댓글은 “탈퇴 회원” 으로 표시되어 보존됩니다.
            </li>
            <li>
              본당은 회원이 본 약관을 중대하게 위반하거나 가톨릭 신앙 공동체에
              현저히 반하는 활동을 한 경우, 회원 자격을 제한·정지·상실시킬 수
              있습니다.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제7조 (서비스의 변경·중단)</h2>
          <p>
            본당은 운영상·기술상 필요에 따라 서비스 내용을 변경하거나 일시·영구
            중단할 수 있으며, 중요한 변경은 본 사이트 공지를 통해 사전에
            안내합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제8조 (면책)</h2>
          <p>
            본당은 천재지변, 통신 장애, 회원의 과실 등 본당의 합리적 통제를
            벗어나는 사유로 발생한 서비스 장애에 대해 책임을 지지 않습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제9조 (약관의 변경)</h2>
          <p>
            본 약관은 관련 법령 변경이나 본당 운영 상황에 따라 개정될 수
            있습니다. 개정 시 본 사이트 공지를 통해 시행일 7일 전부터 게시하며,
            회원에게 불리한 변경은 30일 전부터 게시합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="font-bold text-base mb-2">제10조 (문의처)</h2>
          <p>
            본 약관 또는 서비스 관련 문의는 본당 사무실로 연락 주시기 바랍니다.
            (연락처는 본당 정보 페이지 참조)
          </p>
        </section>

        <p className="mt-12 text-xs text-[var(--color-text-muted)] border-t pt-4">
          본 약관은 본당의 운영 정책에 맞춰 검수·수정될 수 있습니다. 최신 본문은
          항상 본 페이지를 참조하시기 바랍니다.
        </p>
      </div>
    </>
  );
}
