import base64
import re
import fitz  # PyMuPDF


def extract_text(pdf_path: str) -> str:
    """PyMuPDF로 페이지 텍스트 추출.

    이전엔 pdfplumber를 썼지만 페이지당 1~3초가 걸리고 pdfminer가 FontBBox
    경고를 수십 줄 뱉어 로그를 흐림. PyMuPDF는 동일 PDF에서 거의 즉시 끝나고
    한글 본문 추출 품질도 충분하다.
    """
    with fitz.open(pdf_path) as doc:
        pages = [page.get_text("text") or "" for page in doc]
    return "\n".join(pages).strip()


def pdf_to_images_b64(pdf_path: str, max_pages: int = 12) -> list[str]:
    """각 페이지를 JPEG base64로 변환 (Bedrock 5MB 제한 준수).

    모든 페이지를 분리된 이미지로 반환한다 (분석은 페이지별 분할 호출).
    상한 12장은 안전장치 — 일반 주보는 4~6장.
    """
    doc = fitz.open(pdf_path)
    result = []
    for page in list(doc)[:max_pages]:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3))
        jpeg_bytes = pixmap.tobytes("jpeg", jpg_quality=72)
        if len(jpeg_bytes) > 4 * 1024 * 1024:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(1, 1))
            jpeg_bytes = pixmap.tobytes("jpeg", jpg_quality=68)
        result.append(base64.b64encode(jpeg_bytes).decode())
    return result


_URL_RE = re.compile(r"https?://\S+")
_PAGE_NO_RE = re.compile(r"\d+\s*/\s*\d+")               # 1/5, 2/5 같은 페이지 번호
_DATE_TIME_RE = re.compile(r"\d{2,4}\.\s*\d+\.\s*\d+\.?(\s*오전|\s*오후)?\s*\d+:\d+")  # "26. 5. 12. 오후 7:03"


def _meaningful_chars(text: str) -> int:
    """URL·페이지 번호·시간 도장 같은 메타데이터를 제거한 의미 있는 글자 수.
    네이버 카페·구글 드라이브 등에서 인쇄한 PDF는 본문이 이미지여도 URL/푸터 텍스트가 많아
    단순 길이 검사로 텍스트가 충분하다고 오판되는 문제를 보완한다.
    """
    cleaned = _URL_RE.sub("", text)
    cleaned = _DATE_TIME_RE.sub("", cleaned)
    cleaned = _PAGE_NO_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", "", cleaned)
    return len(cleaned)


def is_text_sparse(text: str, min_chars: int = 200) -> bool:
    return _meaningful_chars(text) < min_chars
