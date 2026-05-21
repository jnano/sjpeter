"""
전례 사진 게시판(slug=liturgy, board_id=6)에 더미 게시글 30건과 사진 첨부를 생성한다.
- 사진 소스: ~/Desktop/전례사진 (13장 순환 사용)
- 사진 복사 위치: backend/uploads/attachments/{uuid}.{ext}
- 글 제목: [TEST] prefix → 일괄 삭제 식별용
"""
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path

import psycopg2

DB_DSN = "dbname=cathedral user=kangtaehun"
BOARD_SLUG = "liturgy"

PROJECT_ROOT = Path("/Users/kangtaehun/Dev/faithandme")
PHOTO_SRC_DIR = Path.home() / "Desktop" / "전례사진"
ATTACH_DIR = PROJECT_ROOT / "backend" / "uploads" / "attachments"

# 30건 (제목, 본문) — 가톨릭 전례 주제
POSTS = [
    ("주님 성탄 대축일 자정 미사",
     "구세주의 탄생을 기다리던 긴 대림의 끝, 거룩한 밤을 밝힌 자정 미사의 한 장면입니다. 신자분들이 한자리에 모여 아기 예수님을 맞이했습니다."),
    ("부활 성야, 빛의 예식",
     "어둠을 가르는 부활초의 불꽃에서 시작된 부활 성야. 한 해 가운데 가장 거룩한 밤, 우리는 새 생명의 빛을 받아 안았습니다."),
    ("재의 수요일 — 사순 시기 시작",
     "이마에 재를 받으며 ‘사람아, 너는 흙에서 왔으니 흙으로 돌아갈 것을 생각하여라’ 하는 말씀을 새겼습니다. 사순 40일이 시작됩니다."),
    ("성지 주일 행렬",
     "예수님의 예루살렘 입성을 기념하며 손에 든 성지 가지를 흔들었습니다. 본당 마당을 한 바퀴 도는 행렬에는 어린이부터 어르신까지 함께했습니다."),
    ("주님 만찬 성목요일 — 발 씻김 예식",
     "예수님께서 제자들의 발을 씻기신 그 사랑을 본받아, 신부님께서 형제 자매들의 발을 씻겨 주셨습니다. 섬김의 자리에서 다시 시작합니다."),
    ("성금요일 십자가 경배",
     "구원의 십자 나무 앞에 한 사람씩 무릎 꿇어 입을 맞춥니다. 침묵 속에서 주님의 수난을 묵상한 시간이었습니다."),
    ("성령 강림 대축일",
     "붉은 제의로 봉헌된 성령 강림 대축일 미사. 사도들 위에 내려오신 그 불꽃이 오늘 우리 본당에도 머물러 주시기를 청했습니다."),
    ("성모 승천 대축일",
     "어머니의 영광을 함께 기리며 봉헌한 미사. 본당 성모상 앞에서 꽃을 봉헌한 자매들의 손길이 정성스러웠습니다."),
    ("그리스도 왕 대축일 — 전례력의 마지막 주일",
     "한 해 동안 걸어온 신앙의 여정을 마감하며, 우리 삶의 왕이신 그리스도께 모든 것을 봉헌한 미사입니다."),
    ("견진 성사",
     "주교님께서 도유하시는 그 손길에 성령의 일곱 은혜가 함께하기를 청했습니다. 견진을 받은 형제 자매들의 새로운 출발을 축하합니다."),
    ("첫영성체 — 어린이들이 처음 모시는 성체",
     "흰 옷을 입은 어린이들이 떨리는 손으로 성체를 모셨습니다. 부모님과 대부모님이 든든히 지켜본 거룩한 자리였습니다."),
    ("혼인 성사 — 두 사람이 한 몸을 이루는 날",
     "하느님 앞에서 평생의 약속을 봉헌한 부부의 모습. 본당 공동체가 함께 축복하며 새 가정을 위해 기도했습니다."),
    ("유아 세례 — 작은 신앙의 첫 걸음",
     "엄마 아빠 품에 안긴 아기 위에 부어진 세례수. 가장 작은 이가 가장 큰 은총을 받는 자리였습니다."),
    ("성인 세례 — 부활 성야의 새 가족",
     "오랜 예비 신자 교리를 마치고 부활 성야에 세례를 받은 형제 자매들. 흰 예복을 입고 우리 곁에 앉았습니다."),
    ("사제 수품 25주년 감사 미사",
     "본당 신부님의 은경축을 함께 기리며 봉헌한 미사. 주님께서 부르신 길을 한결같이 걸어오신 사제의 발걸음에 감사드립니다."),
    ("본당의 날 — 성 베드로 사도 대축일",
     "본당 주보 성인이신 성 베드로 사도 대축일을 맞아 봉헌한 본당의 날 미사. 모든 단체가 함께한 자리였습니다."),
    ("성체 거동 — 그리스도의 성체 성혈 대축일",
     "성체를 모시고 본당 마당을 도는 거룩한 행렬. 향과 꽃길 위로 임하신 주님을 모시고 한 걸음 한 걸음 걸었습니다."),
    ("위령 미사 — 11월 위령 성월",
     "먼저 가신 부모님과 형제 자매를 기억하며 봉헌한 위령 미사. 위령 기도 책자에 적힌 이름을 하나하나 불렀습니다."),
    ("어린이 미사 — 주일 학교 가족",
     "어린이의 눈높이에 맞춘 강론, 어린이가 봉독한 독서. 작은 사도들이 만든 따뜻한 주일이었습니다."),
    ("청년 미사 — 젊은이의 자리",
     "청년 단체가 준비한 미사. 기타와 카혼이 함께한 성가, 청년다운 봉헌의 시간이었습니다."),
    ("성물 축복식 — 새 묵주를 받은 손",
     "신부님께서 축복해 주신 묵주를 받아 든 형제 자매들. 매일의 기도가 더 풍성해지기를 청했습니다."),
    ("성가대 봉헌 미사",
     "한 해 동안 미사 전례에 봉사한 성가대원들의 노고에 감사하며 봉헌한 미사. 그분들의 노래로 미사가 더 깊어졌습니다."),
    ("신앙 고백 — 사도신경을 함께 바치며",
     "흰 옷의 어린이들과 함께 바친 사도신경. 우리가 무엇을 믿는지, 누구를 따라 사는지 다시 새긴 시간이었습니다."),
    ("묵주 기도 봉헌 — 로사리오 성월",
     "10월 성모 성월, 본당 마당에서 함께 바친 묵주 기도. 어머니의 마음으로 한 알 한 알 기도를 엮었습니다."),
    ("십자가의 길 — 사순 금요일",
     "사순 시기 매주 금요일 저녁, 십자가의 길 14처를 함께 걸었습니다. 주님께서 걸으신 그 길이 우리 발 아래 있었습니다."),
    ("성체 조배 — 침묵의 자리",
     "성체 앞에 무릎 꿇은 한 사람의 뒷모습. 말이 멈춘 자리에서 주님은 더 가까이 다가오셨습니다."),
    ("부활절 가족 미사",
     "부활의 기쁨을 가족과 함께 나눈 미사. 어린이들이 부활 달걀을 봉헌하며 환하게 웃었습니다."),
    ("성탄 가족 미사",
     "어른과 아이가 함께한 성탄 미사. 구유 앞에서 부른 성가가 본당 안 가득 울려 퍼졌습니다."),
    ("새해 첫 미사 — 천주의 성모 마리아 대축일",
     "한 해의 시작을 어머니께 봉헌한 미사. 평화의 한 해가 되도록 기도하며 새해를 열었습니다."),
    ("주님 봉헌 축일 — 촛불 행렬",
     "성전에 봉헌되신 아기 예수님을 기리며 손에 든 작은 촛불들. 한 해의 빛을 미리 받아 안은 자리였습니다."),
]

assert len(POSTS) == 30, f"POSTS는 30건이어야 합니다 (현재 {len(POSTS)}건)"


def get_board_id(conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM boards WHERE slug = %s", (BOARD_SLUG,))
        row = cur.fetchone()
        if not row:
            raise RuntimeError(f"보드가 없습니다: {BOARD_SLUG}")
        return row[0]


def list_photos() -> list[Path]:
    if not PHOTO_SRC_DIR.exists():
        raise RuntimeError(f"사진 폴더가 없습니다: {PHOTO_SRC_DIR}")
    files = sorted(
        p for p in PHOTO_SRC_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}
    )
    if not files:
        raise RuntimeError(f"사진 폴더에 이미지가 없습니다: {PHOTO_SRC_DIR}")
    return files


def copy_to_attachments(src: Path) -> tuple[str, str, int]:
    """원본 사진을 uploads/attachments/{uuid}{ext}로 복사. (stored_name, file_url, size) 반환."""
    ATTACH_DIR.mkdir(parents=True, exist_ok=True)
    ext = src.suffix.lower()
    stored = uuid.uuid4().hex + ext
    dst = ATTACH_DIR / stored
    shutil.copy2(src, dst)
    return stored, f"/uploads/attachments/{stored}", dst.stat().st_size


def main():
    photos = list_photos()
    print(f"[info] 사진 {len(photos)}장 / 게시글 {len(POSTS)}건")

    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    inserted_post_ids: list[int] = []
    inserted_attachment_ids: list[int] = []

    try:
        board_id = get_board_id(conn)
        print(f"[info] board_id = {board_id}")

        with conn.cursor() as cur:
            for idx, (title, content) in enumerate(POSTS):
                photo = photos[idx % len(photos)]
                stored, url, size = copy_to_attachments(photo)
                ext = photo.suffix.lower()
                is_image = ext in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"}

                cur.execute(
                    """
                    INSERT INTO posts (board_id, title, content, view_count, is_published, created_at, updated_at)
                    VALUES (%s, %s, %s, 0, true, NOW(), NOW())
                    RETURNING id
                    """,
                    (board_id, f"[TEST] {title}", content),
                )
                post_id = cur.fetchone()[0]
                inserted_post_ids.append(post_id)

                cur.execute(
                    """
                    INSERT INTO attachments (post_id, original_name, stored_name, file_url, file_size, is_image, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                    RETURNING id
                    """,
                    (post_id, photo.name, stored, url, size, is_image),
                )
                att_id = cur.fetchone()[0]
                inserted_attachment_ids.append(att_id)

                print(f"  [{idx+1:>2}/30] post#{post_id} ← {photo.name}")

        conn.commit()
        print(f"\n[done] posts {len(inserted_post_ids)}건, attachments {len(inserted_attachment_ids)}건")
        if inserted_post_ids:
            print(f"[range] post id: {min(inserted_post_ids)} ~ {max(inserted_post_ids)}")
            print("\n--- 일괄 삭제용 SQL ---")
            ids = ",".join(str(i) for i in inserted_post_ids)
            print(f"DELETE FROM attachments WHERE post_id IN ({ids});")
            print(f"DELETE FROM posts WHERE id IN ({ids});")
    except Exception as e:
        conn.rollback()
        print(f"[error] 실패, 롤백됨: {e}")
        # 복사한 사진도 정리
        for stored_name in []:
            pass
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
