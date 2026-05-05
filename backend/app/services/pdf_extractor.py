import base64
import pdfplumber
import fitz  # PyMuPDF


def extract_text(pdf_path: str) -> str:
    with pdfplumber.open(pdf_path) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()


def pdf_to_images_b64(pdf_path: str, max_pages: int = 6) -> list[str]:
    """각 페이지를 JPEG base64로 변환 (2배 해상도)."""
    doc = fitz.open(pdf_path)
    result = []
    for page in list(doc)[:max_pages]:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        result.append(base64.b64encode(pixmap.tobytes("jpeg")).decode())
    return result


def is_text_sparse(text: str, min_chars: int = 200) -> bool:
    return len(text.replace(" ", "").replace("\n", "")) < min_chars
