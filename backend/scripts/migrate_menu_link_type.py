"""menu_items를 link_type 기반 스키마로 마이그레이션.

기존 데이터:
- href가 http(s)://      → link_type='external', external_url=href
- href가 /boards/{slug} → link_type='board',    board_id=boards.id (slug 조회)
- href가 그 외 내부 경로 → link_type='page',    static_page_slug=href

유일성 강제 (안전 모드):
- 같은 board_id 또는 같은 static_page_slug가 여러 menu_item에 있으면
  → id가 가장 큰 항목(최근에 만든 것) 1개만 board/page로 정상 등록,
    나머지는 link_type='external' + external_url=href로 강등.
  → 데이터 손실 없이 사용자가 admin에서 정리 가능.

사용:
    ./venv/bin/python scripts/migrate_menu_link_type.py            # dry-run
    ./venv/bin/python scripts/migrate_menu_link_type.py --apply    # 실제 적용
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal
from app.models.menu import MenuItem
from app.models.board import Board


def classify(href: str) -> tuple[str, str | None]:
    """href에서 link_type과 reference 값 추출."""
    h = (href or "").strip()
    if not h:
        return ("external", "")
    if h.startswith("http://") or h.startswith("https://"):
        return ("external", h)
    if h.startswith("/boards/"):
        # /boards/{slug} 형태 — slug 추출
        rest = h[len("/boards/"):]
        # 더 깊은 경로(/boards/notice/123 등)는 게시판 메뉴로 보기 어려움 → external 취급
        if "/" in rest:
            return ("external", h)
        return ("board", rest)
    return ("page", h)


def main(apply: bool) -> None:
    db = SessionLocal()
    try:
        items = db.query(MenuItem).order_by(MenuItem.id).all()
        boards_by_slug = {b.slug: b for b in db.query(Board).all()}

        # 1차 분류
        plans: list[dict] = []
        for it in items:
            lt, ref = classify(it.href)
            plan = {
                "id": it.id,
                "label": it.label,
                "href": it.href,
                "link_type": lt,
                "static_page_slug": None,
                "board_id": None,
                "external_url": None,
                "action": "update",
            }
            if lt == "external":
                plan["external_url"] = ref
            elif lt == "board":
                b = boards_by_slug.get(ref)
                if b is None:
                    # 대상 board가 없으면 external로 강등(깨진 링크 보존)
                    plan["link_type"] = "external"
                    plan["external_url"] = it.href
                else:
                    plan["board_id"] = b.id
            else:  # page
                plan["static_page_slug"] = ref
            plans.append(plan)

        # 2차 유일성 (안전 모드): id가 가장 큰 것만 board/page로 두고
        # 나머지는 external로 강등 — 데이터 손실 없이 admin이 직접 정리
        seen_boards: dict[int, int] = {}
        seen_pages: dict[str, int] = {}
        for p in sorted(plans, key=lambda x: -x["id"]):
            if p["link_type"] == "board" and p["board_id"]:
                if p["board_id"] in seen_boards:
                    p["action"] = "demote"
                    p["dup_of"] = seen_boards[p["board_id"]]
                    p["link_type"] = "external"
                    p["external_url"] = p["href"]
                    p["board_id"] = None
                else:
                    seen_boards[p["board_id"]] = p["id"]
            elif p["link_type"] == "page" and p["static_page_slug"]:
                if p["static_page_slug"] in seen_pages:
                    p["action"] = "demote"
                    p["dup_of"] = seen_pages[p["static_page_slug"]]
                    p["link_type"] = "external"
                    p["external_url"] = p["href"]
                    p["static_page_slug"] = None
                else:
                    seen_pages[p["static_page_slug"]] = p["id"]

        # 보고
        print(f"총 menu_items: {len(plans)}개\n")
        print(f"{'id':>4}  {'action':<8} {'link_type':<10} {'label':<24} {'href':<26} → {'ref'}")
        print("-" * 110)
        for p in sorted(plans, key=lambda x: x["id"]):
            ref = p["external_url"] or (f"board_id={p['board_id']}" if p["board_id"] else p["static_page_slug"]) or "-"
            extra = f"  (중복: id={p.get('dup_of')})" if p.get("dup_of") else ""
            print(f"{p['id']:>4}  {p['action']:<8} {p['link_type']:<10} {p['label']:<24.24} {p['href']:<26.26} → {ref}{extra}")

        if not apply:
            print("\n[dry-run] --apply로 실제 적용")
            return

        # 적용 — demote도 update로 처리(필드만 다름)
        for p in plans:
            it = next((i for i in items if i.id == p["id"]), None)
            if it is None:
                continue
            it.link_type = p["link_type"]
            it.static_page_slug = p["static_page_slug"]
            it.board_id = p["board_id"]
            it.external_url = p["external_url"]
            it.is_external = p["link_type"] == "external"
        db.commit()
        demoted = sum(1 for p in plans if p["action"] == "demote")
        print(f"\n적용 완료: 정상 마이그레이션 {len(plans) - demoted}건, external 강등 {demoted}건")
    finally:
        db.close()


if __name__ == "__main__":
    main(apply="--apply" in sys.argv)
