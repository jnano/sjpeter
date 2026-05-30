// 관리자 표시 등급 — 권한과 무관, 표시 전용.
// super = 슈퍼관리자(Admin 계정). vicar/priest/nun/operator = 운영자 권한의 세분화 라벨.
// 권한(super/operator)은 백엔드 is_super_admin / is_admin 으로 판정하며, 이 라벨은 화면 표시용.

export const ADMIN_ROLE_LABEL: Record<string, string> = {
  super: "슈퍼관리자",
  vicar: "주임신부님",
  priest: "사제",
  nun: "수녀",
  operator: "운영자",
};

// 운영자 지정 시 고를 수 있는 등급(super 제외, 표시 순서 = 등급 순서)
export const ADMIN_ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "vicar", label: "주임신부님" },
  { value: "priest", label: "사제" },
  { value: "nun", label: "수녀" },
  { value: "operator", label: "운영자" },
];

/** 등급 코드 → 라벨. 운영자인데 등급 미지정(null)이면 "운영자". */
export function adminRoleLabel(role?: string | null): string {
  return (role && ADMIN_ROLE_LABEL[role]) || "운영자";
}
