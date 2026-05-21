"""본당 홈페이지 발표자료 .pptx 생성기.

PRESENTATION_GUIDELINES.md 의 기준에 맞춰
- 현재 운영 중인 6대 기능 + 카카오채널
- 기승전결 구조
- 밝고 깨끗한 화이트/네이비/옅은 골드 톤
- 스크린샷 자동 삽입 (presentation/screenshots/ 안의 약속된 파일명)

본당명은 site_settings.PARISH_NAME 에서 읽음 (환경변수 PARISH_NAME 으로 override 가능).

실행:
    cd backend && source venv/bin/activate
    python ../presentation/pptx/build_pptx.py
"""
import os
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Emu, Inches, Pt

# ─────────────────────────────────────────────
# 본당명 (site_settings → 환경변수 → 기본값 순)
# ─────────────────────────────────────────────
def _resolve_parish_name() -> str:
    try:
        from app.core.site_settings import get_setting
        v = (get_setting("PARISH_NAME", "") or "").strip()
        if v:
            return v
    except Exception:
        pass
    return os.environ.get("PARISH_NAME", "본당 홈페이지")


PARISH_NAME = _resolve_parish_name()

# ─────────────────────────────────────────────
# 디자인 토큰 (밝고 깨끗한 톤)
# ─────────────────────────────────────────────
SLIDE_W = Inches(13.333)
SLIDE_H = Inches(7.5)

WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BG = RGBColor(0xFF, 0xFF, 0xFF)
CREAM = RGBColor(0xF8, 0xF6, 0xF1)
INK = RGBColor(0x1F, 0x2A, 0x44)
INK_SOFT = RGBColor(0x3A, 0x43, 0x58)
MUTED = RGBColor(0x6B, 0x72, 0x80)
GOLD = RGBColor(0xC9, 0xA8, 0x62)
GOLD_DARK = RGBColor(0x8C, 0x6F, 0x2E)
LINE = RGBColor(0xE5, 0xE1, 0xD6)
SOFT_LINE = RGBColor(0xEE, 0xEC, 0xE5)
CARD_BG = RGBColor(0xFB, 0xF9, 0xF2)
PLACEHOLDER_BG = RGBColor(0xFD, 0xFB, 0xF4)

FONT_KR = "Apple SD Gothic Neo"

ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS = ROOT / "screenshots"

# ─────────────────────────────────────────────
# 유틸
# ─────────────────────────────────────────────


def add_blank_slide(prs: Presentation):
    return prs.slides.add_slide(prs.slide_layouts[6])


def fill_bg(slide, color: RGBColor) -> None:
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W, SLIDE_H)
    bg.line.fill.background()
    bg.fill.solid()
    bg.fill.fore_color.rgb = color
    bg.shadow.inherit = False
    slide.shapes._spTree.remove(bg._element)
    slide.shapes._spTree.insert(2, bg._element)


def add_rect(slide, left, top, width, height, color, line=None):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    if line:
        shape.line.color.rgb = line
        shape.line.width = Pt(0.75)
    else:
        shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.shadow.inherit = False
    return shape


def add_rounded(slide, left, top, width, height, color, *, radius=0.08, line=None):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    shape.adjustments[0] = radius
    if line:
        shape.line.color.rgb = line
        shape.line.width = Pt(0.75)
    else:
        shape.line.fill.background()
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.shadow.inherit = False
    return shape


def _add_runs(paragraph, text: str, *, size: int, color: RGBColor, font: str = FONT_KR) -> None:
    """**굵게** 마커 처리."""
    parts = text.split("**")
    for i, part in enumerate(parts):
        if not part:
            continue
        run = paragraph.add_run()
        run.text = part
        run.font.name = font
        run.font.size = Pt(size)
        if i % 2 == 1:
            run.font.bold = True
            run.font.color.rgb = GOLD_DARK
        else:
            run.font.color.rgb = color


def add_text(
    slide,
    text: str,
    left: float,
    top: float,
    width: float,
    height: float,
    *,
    size: int = 18,
    bold: bool = False,
    color: RGBColor = INK_SOFT,
    align: int = PP_ALIGN.LEFT,
    anchor: int = MSO_ANCHOR.TOP,
    font: str = FONT_KR,
    spacing: float = 0.0,
):
    tb = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    p = tf.paragraphs[0]
    p.alignment = align
    if spacing:
        run = p.add_run()
        run.text = text
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
        # letter spacing via _element 가 비공식 — 생략
    else:
        run = p.add_run()
        run.text = text
        run.font.name = font
        run.font.size = Pt(size)
        run.font.bold = bold
        run.font.color.rgb = color
    return tb


def add_divider(slide, left, top, width, color=GOLD, thickness=0.04):
    add_rect(slide, left, top, width, thickness, color)


def add_page_header(slide, kicker: str, title: str) -> None:
    """본문 슬라이드 공통 헤더."""
    add_text(slide, kicker, 0.7, 0.55, 12, 0.32, size=11, color=GOLD, bold=True)
    add_text(slide, title, 0.7, 0.85, 12, 0.9, size=30, bold=True, color=INK)
    add_rect(slide, 0.7, 1.7, 12, 0.02, LINE)


def add_footer(slide, text: str = "본당 사목과 운영을 돕는 보조 수단") -> None:
    add_text(slide, text, 0.7, 7.05, 12, 0.3, size=10, color=MUTED)


def add_bullets(
    slide,
    items: list[str],
    left: float,
    top: float,
    width: float,
    *,
    size: int = 17,
    line_height: float = 0.7,
) -> None:
    for i, text in enumerate(items):
        cy = top + i * line_height
        # 작은 골드 도트
        dot = slide.shapes.add_shape(
            MSO_SHAPE.OVAL, Inches(left), Inches(cy + 0.16), Inches(0.1), Inches(0.1)
        )
        dot.line.fill.background()
        dot.fill.solid()
        dot.fill.fore_color.rgb = GOLD
        # 본문
        tb = slide.shapes.add_textbox(
            Inches(left + 0.28), Inches(cy), Inches(width - 0.3), Inches(line_height + 0.2)
        )
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = Emu(0)
        tf.margin_top = Emu(0)
        p = tf.paragraphs[0]
        _add_runs(p, text, size=size, color=INK_SOFT)


def add_paragraph(slide, text: str, left, top, width, height, *, size=17, color=INK_SOFT, align=PP_ALIGN.LEFT):
    tb = slide.shapes.add_textbox(Inches(left), Inches(top), Inches(width), Inches(height))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = Emu(0)
    tf.margin_top = Emu(0)
    p = tf.paragraphs[0]
    p.alignment = align
    _add_runs(p, text, size=size, color=color)
    return tb


def add_table(
    slide,
    headers: list[str],
    rows: list[list[str]],
    left: float,
    top: float,
    width: float,
    height: float,
    *,
    col_widths: list[float] | None = None,
):
    cols = len(headers)
    rows_n = len(rows) + 1
    table = slide.shapes.add_table(
        rows_n, cols, Inches(left), Inches(top), Inches(width), Inches(height)
    ).table
    if col_widths:
        for ci, w in enumerate(col_widths):
            table.columns[ci].width = Inches(w)
    # 헤더
    for ci, h in enumerate(headers):
        cell = table.cell(0, ci)
        cell.fill.solid()
        cell.fill.fore_color.rgb = CREAM
        cell.text = ""
        tf = cell.text_frame
        tf.margin_left = Emu(100000)
        tf.margin_right = Emu(100000)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        run = p.add_run()
        run.text = h
        run.font.name = FONT_KR
        run.font.size = Pt(13)
        run.font.bold = True
        run.font.color.rgb = INK
    # 헤더 하단 골드 라인 — 셀 borders 는 python-pptx 미지원, 별도 도형으로 대체 생략
    # 바디
    for ri, row in enumerate(rows, start=1):
        for ci, val in enumerate(row):
            cell = table.cell(ri, ci)
            cell.fill.solid()
            cell.fill.fore_color.rgb = WHITE
            cell.text = ""
            tf = cell.text_frame
            tf.margin_left = Emu(100000)
            tf.margin_right = Emu(100000)
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.LEFT
            _add_runs(p, val, size=13, color=INK_SOFT)
    return table


def add_screenshot_slot(
    slide,
    filename: str,
    left: float,
    top: float,
    width: float,
    height: float,
) -> bool:
    """`presentation/screenshots/{filename}` 이 있으면 삽입, 없으면 점선 플레이스홀더.

    Returns True if a real image was inserted.
    """
    path = SCREENSHOTS / filename
    if path.exists():
        # 가운데 정렬로 크기 안의 이미지 박스 삽입
        slide.shapes.add_picture(
            str(path), Inches(left), Inches(top), width=Inches(width), height=Inches(height)
        )
        return True

    # 플레이스홀더 (밝은 배경 + 점선 골드 테두리 흉내)
    box = slide.shapes.add_shape(
        MSO_SHAPE.RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height)
    )
    box.fill.solid()
    box.fill.fore_color.rgb = PLACEHOLDER_BG
    box.line.color.rgb = GOLD
    box.line.width = Pt(1.25)
    box.line.dash_style = 7  # DASH
    box.shadow.inherit = False

    tf = box.text_frame
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r1 = p.add_run()
    r1.text = "📷 화면 예시"
    r1.font.name = FONT_KR
    r1.font.size = Pt(14)
    r1.font.color.rgb = GOLD_DARK
    r1.font.bold = True

    p2 = tf.add_paragraph()
    p2.alignment = PP_ALIGN.CENTER
    r2 = p2.add_run()
    r2.text = f"screenshots/{filename}"
    r2.font.name = "Menlo"
    r2.font.size = Pt(11)
    r2.font.color.rgb = MUTED
    return False


def add_step_badge(slide, text: str, left, top, width=1.2):
    chip = add_rounded(slide, left, top, width, 0.4, INK, radius=0.5)
    tf = chip.text_frame
    tf.margin_left = Emu(0)
    tf.margin_right = Emu(0)
    tf.margin_top = Emu(0)
    tf.margin_bottom = Emu(0)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = text
    r.font.name = FONT_KR
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = WHITE


def add_flow_grid(slide, steps: list[str], active_idx: int, top: float):
    """4단계 그리드. active_idx 는 0-base."""
    n = len(steps)
    margin = 0.7
    gap = 0.18
    total_w = 13.333 - margin * 2
    cell_w = (total_w - gap * (n - 1)) / n
    cell_h = 0.85

    for i, label in enumerate(steps):
        left = margin + i * (cell_w + gap)
        is_active = i == active_idx
        bg = RGBColor(0xFB, 0xF6, 0xE6) if is_active else CREAM
        border_color = GOLD if is_active else LINE

        # 카드 본체
        card = add_rect(slide, left, top, cell_w, cell_h, bg)
        # 상단 라인 (얇은 강조)
        add_rect(slide, left, top, cell_w, 0.05, border_color)

        # 텍스트
        tb = slide.shapes.add_textbox(
            Inches(left), Inches(top + 0.05), Inches(cell_w), Inches(cell_h - 0.05)
        )
        tf = tb.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = MSO_ANCHOR.MIDDLE
        tf.margin_left = Emu(0)
        tf.margin_right = Emu(0)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        r = p.add_run()
        r.text = label
        r.font.name = FONT_KR
        r.font.size = Pt(13)
        r.font.bold = is_active
        r.font.color.rgb = INK if is_active else MUTED


def add_feature_card(slide, num: str, name: str, desc: str, left, top, width, height):
    """6대 기능 카드."""
    add_rect(slide, left, top, width, height, WHITE, line=LINE)
    # 번호
    add_text(slide, num, left + 0.25, top + 0.2, width, 0.35,
             size=12, color=GOLD, bold=True)
    # 이름
    add_text(slide, name, left + 0.25, top + 0.55, width - 0.4, 0.5,
             size=16, bold=True, color=INK)
    # 설명
    add_text(slide, desc, left + 0.25, top + 1.1, width - 0.4, 0.7,
             size=11, color=MUTED)


# ─────────────────────────────────────────────
# 슬라이드 빌더
# ─────────────────────────────────────────────


def slide_title(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_text(s, PARISH_NAME, 1, 2.5, 11.3, 1.0, size=54, bold=True,
             color=INK, align=PP_ALIGN.CENTER)
    add_text(s, "공식 홈페이지 소개", 1, 3.5, 11.3, 0.7, size=22, color=GOLD_DARK,
             align=PP_ALIGN.CENTER)
    add_divider(s, 6.27, 4.6, 0.8, GOLD, 0.04)
    add_text(s, "본당 사목과 운영을 돕는 보조 수단", 1, 5.0, 11.3, 0.5,
             size=15, color=MUTED, align=PP_ALIGN.CENTER)
    add_text(s, "2026", 1, 6.6, 11.3, 0.3, size=11, color=MUTED, align=PP_ALIGN.CENTER)


def slide_intro(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, "기 · 도입", "들어가며")
    add_paragraph(s,
        "홈페이지는 본당 사목과 운영을 **돕는 보조 수단**입니다.",
        0.7, 2.1, 12, 0.6, size=18)
    add_paragraph(s,
        "본당의 일들이 일어나는 곳은 성전과 공동체 안이고, 홈페이지는 그것을 "
        "**알리고 기록하고 다시 찾을 수 있게** 거드는 자리에 있습니다.",
        0.7, 3.1, 12, 1.3, size=17)
    add_paragraph(s,
        "오늘 이 자료에서는 **현재 홈페이지가 실제로 하고 있는 일**을 정리해 말씀드립니다.",
        0.7, 4.7, 12, 0.7, size=17)
    add_footer(s)


def slide_flow(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, "기 · 도입", "발표 흐름")
    add_table(s,
        ["구분", "내용"],
        [
            ["**기 · 도입**", "홈페이지의 자리매김"],
            ["**승 · 전개**", "현재 운영 중인 여섯 가지 기능"],
            ["**전 · 심화**", "두 가지 실제 흐름 — 알림 수신 · 주보 AI 추출"],
            ["**결 · 마무리**", "본당 역사 저장소로서의 역할"],
        ],
        0.7, 2.2, 12, 3.6,
        col_widths=[2.5, 9.5],
    )
    add_footer(s)


def slide_section_cover(prs, kicker: str, title: str, sub: str,
                         show_kicker: bool = True, show_sub: bool = True):
    s = add_blank_slide(prs)
    fill_bg(s, CREAM)
    if show_kicker:
        add_text(s, kicker, 1, 2.5, 11.3, 0.4, size=14, color=GOLD, bold=True,
                 align=PP_ALIGN.CENTER)
    add_text(s, title, 1, 3.0, 11.3, 1.3, size=46, bold=True, color=INK,
             align=PP_ALIGN.CENTER)
    add_divider(s, 6.17, 4.55, 1.0, GOLD, 0.04)
    if show_sub:
        add_text(s, sub, 1, 4.9, 11.3, 0.5, size=16, color=MUTED, align=PP_ALIGN.CENTER)


def slide_six_features(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, "승 · 전개", "여섯 가지 기능 한눈에")

    cards = [
        ("01", "오늘의 말씀 + 묵상", "매일의 복음을 첫 화면에서"),
        ("02", "성전건축 일지", "단계별 기록과 사진"),
        ("03", "내 관심 단체·모임", "선택한 활동의 소식"),
        ("04", "주보 AI 추출", "공지·행사·모임 자동 정리"),
        ("05", "본당 역사 저장소", "한자리에 누적되는 기록"),
        ("06", "보안성", "암호화·백업·인증된 관리"),
    ]
    # 3x2 그리드
    margin_l = 0.7
    margin_top = 2.1
    gap = 0.3
    card_w = (13.333 - margin_l * 2 - gap * 2) / 3  # 3열
    card_h = 1.85
    for i, (num, name, desc) in enumerate(cards):
        col = i % 3
        row = i // 3
        left = margin_l + col * (card_w + gap)
        top = margin_top + row * (card_h + gap)
        add_feature_card(s, num, name, desc, left, top, card_w, card_h)

    add_paragraph(s,
        "추가로 **카카오 채널 연동**을 준비하고 있습니다.",
        0.7, 6.45, 12, 0.4, size=13, color=MUTED)
    add_footer(s)


def _slide_feature(prs, kicker, title, bullets, screenshot=None, footer_note=None):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, kicker, title)
    add_bullets(s, bullets, 0.7, 2.1, 12.0, size=16, line_height=0.65)
    if footer_note:
        add_paragraph(s, footer_note, 0.7, 4.6, 12, 0.6, size=14, color=INK_SOFT)
    if screenshot:
        # 화면 슬롯: 좌하단 큼직하게
        add_screenshot_slot(s, screenshot, 0.7, 5.2, 12.0, 1.6)
    add_footer(s)
    return s


def slide_feature_word(prs):
    _slide_feature(prs,
        "승 · 전개  ·  01",
        "오늘의 말씀 + 묵상",
        [
            "매일의 복음 말씀을 홈페이지 첫 화면에서 바로 만날 수 있습니다.",
            "묵상 글이 일정 주기로 자동으로 바뀌며, 따로 찾지 않아도 자연스레 눈에 들어옵니다.",
            "본당에 방문하지 못한 날에도 말씀 한 구절을 만나도록 돕는 자리입니다.",
        ],
        screenshot="01-word-meditation.png",
    )


def slide_feature_construction(prs):
    _slide_feature(prs,
        "승 · 전개  ·  02",
        "성전건축 일지",
        [
            "성전건축의 진행 과정을 **단계별 기록**과 **사진**으로 남깁니다.",
            "일지를 한 줄씩 누적해 시간이 지나도 그 흐름을 다시 따라갈 수 있습니다.",
            "본당 전체가 함께한 시간을 자료로 보관하는 자리입니다.",
        ],
        screenshot="02-construction-log.png",
    )


def slide_feature_interests(prs):
    _slide_feature(prs,
        "승 · 전개  ·  03",
        "내 관심 단체·모임",
        [
            "회원이 홈페이지에서 관심 있는 **단체와 모임**을 직접 선택할 수 있습니다.",
            "선택한 단체·모임의 공지와 일정이 본인에게 닿도록 연결됩니다.",
            "알림은 카카오 채널 연동을 통해 받게 됩니다.",
        ],
        screenshot="03-member-interests.png",
    )


def slide_feature_bulletin(prs):
    _slide_feature(prs,
        "승 · 전개  ·  04",
        "주보 AI 추출",
        [
            "매주 발행되는 **주보 PDF**를 업로드하면, 본문 내용을 AI가 자동으로 살펴봅니다.",
            "공지·행사·모임 항목이 자동으로 분류되어 홈페이지의 해당 자리로 이동합니다.",
            "분류된 결과는 관리자가 다시 확인한 뒤 공개합니다.",
        ],
        screenshot="04-bulletin-upload.png",
    )


def slide_feature_archive(prs):
    _slide_feature(prs,
        "승 · 전개  ·  05",
        "본당 역사 저장소 역할",
        [
            "주보·공지·행사·사진이 홈페이지 안에 **연도별로 누적**됩니다.",
            "시간이 지난 뒤에도 그 시기의 본당 활동을 다시 찾아볼 수 있습니다.",
            "흩어지기 쉬운 기록을 **한자리에 보관**하는 자리입니다.",
        ],
        screenshot="05-archive.png",
    )


def slide_feature_security(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, "승 · 전개  ·  06", "보안성")
    add_bullets(s, [
        "회원 정보는 안전하게 **암호화**되어 저장됩니다.",
        "관리자 페이지는 인증된 사용자만 접근할 수 있습니다.",
        "본당 기록은 정기적으로 **백업**되어 보존됩니다.",
    ], 0.7, 2.2, 12, size=17, line_height=0.75)
    add_paragraph(s,
        "홈페이지에 남겨지는 정보가 안심하고 맡겨질 수 있는 환경을 유지합니다.",
        0.7, 5.0, 12, 0.6, size=16, color=INK_SOFT)
    add_footer(s)


def slide_feature_kakao(prs):
    _slide_feature(prs,
        "승 · 전개  ·  +",
        "카카오 채널 연동",
        [
            "본당 **카카오 채널**을 통해 알림을 받을 수 있도록 준비하고 있습니다.",
            "회원이 관심 단체·모임을 선택해 두면, 해당 공지와 일정이 채널로 안내됩니다.",
            "카카오 채널 개설 절차가 마무리되는 대로 적용됩니다.",
        ],
        screenshot="06-kakao.png",
    )


def slide_flow_overview(prs, title: str, steps: list[str], intro: str):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, "전 · 심화", title)
    add_paragraph(s, intro, 0.7, 2.1, 12.0, 0.8, size=16)
    add_flow_grid(s, steps, active_idx=-1, top=3.4)
    add_footer(s)


def slide_flow_step(prs, flow_kicker: str, step_label: str, step_title: str,
                    steps: list[str], active_idx: int, bullets: list[str],
                    screenshot: str):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    # 헤더
    add_text(s, flow_kicker, 0.7, 0.55, 12, 0.32, size=11, color=GOLD, bold=True)
    # 스텝 배지 + 타이틀
    add_step_badge(s, step_label, 0.7, 0.85, width=1.2)
    add_text(s, step_title, 2.05, 0.83, 11, 0.6, size=28, bold=True, color=INK)
    add_rect(s, 0.7, 1.7, 12, 0.02, LINE)

    # 진행 그리드
    add_flow_grid(s, steps, active_idx=active_idx, top=2.0)

    # bullets
    add_bullets(s, bullets, 0.7, 3.4, 12, size=16, line_height=0.65)

    # 스크린샷 슬롯
    add_screenshot_slot(s, screenshot, 0.7, 5.0, 12.0, 1.85)
    add_footer(s)


def slide_archive_summary(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, "결 · 마무리", "한 자리에 모이는 기록")
    add_bullets(s, [
        "매주의 **주보**, 그 안의 **공지·행사·모임**",
        "매일의 **말씀과 묵상**",
        "**성전건축**의 단계별 일지",
        "단체·모임의 **공지와 사진**",
    ], 0.7, 2.2, 12, size=18, line_height=0.78)
    add_paragraph(s,
        "이 모든 것이 홈페이지 안에서 **연도별로 정돈**되어 보관됩니다.",
        0.7, 5.7, 12, 0.6, size=17, color=INK_SOFT)
    add_footer(s)


def slide_wrap_up(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_page_header(s, "결 · 마무리", "정리")
    add_table(s,
        ["구분", "내용"],
        [
            ["매일", "오늘의 말씀 + 묵상"],
            ["매주", "주보 AI 추출 → 공지·행사·모임 자동 정리"],
            ["회원", "관심 단체·모임 선택 → 카카오 채널 알림"],
            ["기록", "성전건축 일지 · 본당 역사 저장소"],
            ["운영", "회원 정보 암호화 · 정기 백업 · 인증된 관리"],
        ],
        0.7, 2.2, 12, 4.5,
        col_widths=[1.8, 10.2],
    )
    add_footer(s)


def slide_closing(prs):
    s = add_blank_slide(prs)
    fill_bg(s, BG)
    add_text(s, "감사합니다", 1, 2.6, 11.3, 1.2, size=64, bold=True,
             color=INK, align=PP_ALIGN.CENTER)
    add_divider(s, 6.27, 4.3, 0.8, GOLD, 0.04)
    add_text(s, f"{PARISH_NAME} 공식 홈페이지", 1, 4.6, 11.3, 0.5,
             size=18, color=GOLD_DARK, align=PP_ALIGN.CENTER)
    add_text(s, "본당 사목과 운영을 돕는 보조 수단", 1, 5.5, 11.3, 0.4,
             size=13, color=MUTED, align=PP_ALIGN.CENTER)


# ─────────────────────────────────────────────
# 빌드
# ─────────────────────────────────────────────


def main() -> None:
    SCREENSHOTS.mkdir(exist_ok=True)

    prs = Presentation()
    prs.slide_width = SLIDE_W
    prs.slide_height = SLIDE_H

    # [기]
    slide_title(prs)
    slide_intro(prs)

    # [승] — 표지에서 위 kicker/아래 sub 모두 숨김 (사용자 요청)
    slide_section_cover(prs, "승 · 전개",
                        "현재 운영 중인 여섯 가지 기능",
                        "매일·매주의 본당 활동을 곁에서 돕는 도구들",
                        show_kicker=False, show_sub=False)
    slide_six_features(prs)
    slide_feature_word(prs)
    slide_feature_construction(prs)
    slide_feature_interests(prs)
    slide_feature_bulletin(prs)
    slide_feature_archive(prs)
    slide_feature_security(prs)
    slide_feature_kakao(prs)

    # [전] — 표지에서 위 kicker 숨김 (사용자 요청)
    slide_section_cover(prs, "전 · 심화",
                        "두 가지 실제 흐름",
                        "홈페이지가 실제로 어떻게 동작하는지 단계별로 살펴봅니다",
                        show_kicker=False)

    # 흐름 1 — 알림 수신
    flow1_steps = ["① 회원가입", "② 첫 로그인", "③ 관심 단체·모임 선택", "④ 카카오 알림 수신"]
    slide_flow_overview(prs, "흐름 1. 알림 수신", flow1_steps,
                        "회원이 홈페이지에 가입한 순간부터 카카오 알림을 받기까지의 네 단계입니다.")
    slide_flow_step(prs, "전 · 심화  ·  흐름 1", "STEP 1", "회원가입",
                    flow1_steps, 0,
                    ["홈페이지에서 **회원가입**을 진행합니다.",
                     "이메일 인증을 거쳐 본인 확인을 마칩니다."],
                    "flow1-step1.png")
    slide_flow_step(prs, "전 · 심화  ·  흐름 1", "STEP 2", "첫 로그인",
                    flow1_steps, 1,
                    ["인증을 마친 계정으로 **첫 로그인**을 합니다.",
                     "로그인과 함께 관심 단체·모임을 선택할 수 있는 안내가 나타납니다."],
                    "flow1-step2.png")
    slide_flow_step(prs, "전 · 심화  ·  흐름 1", "STEP 3", "관심 단체·모임 선택",
                    flow1_steps, 2,
                    ["본당의 **단체와 모임 목록**에서 관심 있는 것을 선택합니다.",
                     "선택한 단체가 속한 **분과는 자동으로 함께 포함**됩니다."],
                    "flow1-step3.png")
    slide_flow_step(prs, "전 · 심화  ·  흐름 1", "STEP 4", "카카오 알림 수신",
                    flow1_steps, 3,
                    ["선택한 단체·모임의 공지와 일정이 등록되면, 본당 **카카오 채널**을 통해 알림이 전달됩니다.",
                     "글로벌 알림 토글로 받기/받지 않기를 직접 조절할 수 있습니다."],
                    "flow1-step4.png")

    # 흐름 2 — 주보 AI 추출
    flow2_steps = ["① 주보 PDF 입력", "② AI 분석", "③ 자동 분류·이동", "④ 관리자 검수·공개"]
    slide_flow_overview(prs, "흐름 2. 주보 AI 추출", flow2_steps,
                        "업로드한 주보 한 부가 홈페이지의 여러 자리로 정리되어 들어가는 네 단계입니다.")
    slide_flow_step(prs, "전 · 심화  ·  흐름 2", "STEP 1", "주보 PDF 입력",
                    flow2_steps, 0,
                    ["매주 발행되는 **주보 PDF**를 관리자 페이지에 업로드합니다.",
                     "PDF 원본은 그대로 보관되어 언제든 다시 열어볼 수 있습니다."],
                    "flow2-step1.png")
    slide_flow_step(prs, "전 · 심화  ·  흐름 2", "STEP 2", "AI 분석",
                    flow2_steps, 1,
                    ["업로드된 주보를 **AI가 한 장씩 읽어** 본문과 표 내용을 정리합니다.",
                     "텍스트와 이미지 정보 모두 분석 대상이 됩니다."],
                    "flow2-step2.png")
    slide_flow_step(prs, "전 · 심화  ·  흐름 2", "STEP 3", "자동 분류·이동",
                    flow2_steps, 2,
                    ["분석 결과는 **공지 / 행사 / 모임** 세 갈래로 자동 분류됩니다.",
                     "각 항목은 홈페이지 안의 알맞은 자리로 이동합니다.",
                     "날짜 정보가 부족한 항목은 별도 **임시 보관함**으로 분리됩니다."],
                    "flow2-step3.png")
    slide_flow_step(prs, "전 · 심화  ·  흐름 2", "STEP 4", "관리자 검수·공개",
                    flow2_steps, 3,
                    ["자동 등록된 항목들은 **관리자 화면**에서 한 번 더 확인합니다.",
                     "내용이 맞으면 그대로 공개하고, 수정이 필요하면 손을 본 뒤 공개합니다.",
                     "AI가 만든 항목임을 표시하는 **별도 표지**가 함께 붙습니다."],
                    "flow2-step4.png")

    # [결] — 표지에서 위 kicker 숨김 (사용자 요청). 마지막 감사 슬라이드(slide_closing) 제거
    slide_section_cover(prs, "결 · 마무리",
                        "본당의 시간을 보관하는 자리",
                        "홈페이지는 본당 사목과 운영을 거드는 한 자리입니다",
                        show_kicker=False)
    slide_archive_summary(prs)
    slide_wrap_up(prs)

    out = Path(__file__).parent / "sjpeter.pptx"
    prs.save(out)
    print(f"✓ Saved: {out}  ({len(prs.slides)} slides)")

    # 스크린샷 안내
    print(f"\n📷 스크린샷 폴더: {SCREENSHOTS}")
    print("   필요한 파일명 (없으면 자동으로 점선 플레이스홀더 표시):")
    for name in [
        "01-word-meditation.png",
        "02-construction-log.png",
        "03-member-interests.png",
        "04-bulletin-upload.png",
        "05-archive.png",
        "06-kakao.png",
        "flow1-step1.png", "flow1-step2.png", "flow1-step3.png", "flow1-step4.png",
        "flow2-step1.png", "flow2-step2.png", "flow2-step3.png", "flow2-step4.png",
    ]:
        exists = (SCREENSHOTS / name).exists()
        mark = "✓" if exists else "·"
        print(f"     {mark} {name}")


if __name__ == "__main__":
    main()
