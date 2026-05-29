"""PDF 첫 페이지 → JPG 썸네일 생성.

v1.5.414 — 주보 PDF 의 1쪽을 1024px JPG 로 추출해 /bulletin 카드 배경에 사용.
PyMuPDF(fitz) + Pillow 만으로 동작 (poppler 같은 외부 바이너리 불필요).
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image
from io import BytesIO

logger = logging.getLogger(__name__)

# 썸네일 긴 변 기준 픽셀 — 카드 배경용 충분 + 파일 크기 절약
THUMB_LONG_EDGE_PX = 1024
THUMB_JPEG_QUALITY = 78  # 표지 사진은 미세 디테일 덜 중요 → 78 로 절약


def generate_first_page_thumbnail(pdf_path: str, out_dir: str, *, base_name: str | None = None) -> str | None:
    """주어진 PDF 의 1쪽을 JPG 로 추출해 `out_dir` 에 저장.

    Args:
        pdf_path: PDF 절대 경로
        out_dir: 저장 디렉토리 절대 경로
        base_name: 파일명 (확장자 제외). 미지정 시 uuid 사용

    Returns:
        저장된 파일의 절대 경로 (실패 시 None)
    """
    if not os.path.exists(pdf_path):
        logger.warning("[pdf_thumbnail] PDF not found: %s", pdf_path)
        return None

    try:
        os.makedirs(out_dir, exist_ok=True)
        with fitz.open(pdf_path) as doc:
            if doc.page_count < 1:
                logger.warning("[pdf_thumbnail] empty PDF: %s", pdf_path)
                return None
            page = doc.load_page(0)

            # rect 의 긴 변이 THUMB_LONG_EDGE_PX 가 되도록 zoom 계산
            r = page.rect
            long_edge = max(r.width, r.height)
            if long_edge <= 0:
                logger.warning("[pdf_thumbnail] page rect invalid: %s", pdf_path)
                return None
            zoom = THUMB_LONG_EDGE_PX / long_edge
            matrix = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img_bytes = pix.tobytes("ppm")  # Pillow 가 안정 디코드

        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        name = base_name or uuid.uuid4().hex
        out_path = os.path.join(out_dir, f"{name}.jpg")
        img.save(out_path, format="JPEG", quality=THUMB_JPEG_QUALITY, optimize=True, progressive=True)
        return out_path
    except Exception as e:  # PyMuPDF·Pillow 모든 예외 광범위 — 실패해도 업로드 자체는 막지 않는다
        logger.warning("[pdf_thumbnail] generate failed for %s: %s", pdf_path, e)
        return None
