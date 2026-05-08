import base64
import pdfplumber
import fitz  # PyMuPDF


def extract_text(pdf_path: str) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def pdf_to_images_b64(pdf_path: str, max_pages: int = 6) -> list[str]:
    """각 페이지를 JPEG base64로 변환 (Bedrock 5MB 제한 준수)."""
    doc = fitz.open(pdf_path)
    result = []
    for page in list(doc)[:max_pages]:
        # 1.5x 해상도 + 품질 75로 5MB 이하 유지
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
        jpeg_bytes = pixmap.tobytes("jpeg", jpg_quality=75)
        # 여전히 크면 1x로 재시도
        if len(jpeg_bytes) > 4 * 1024 * 1024:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(1, 1))
            jpeg_bytes = pixmap.tobytes("jpeg", jpg_quality=70)
        result.append(base64.b64encode(jpeg_bytes).decode())
    return result


def is_text_sparse(text: str, min_chars: int = 200) -> bool:
    return len(text.replace(" ", "").replace("\n", "")) < min_chars
