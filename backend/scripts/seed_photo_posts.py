"""
행사 사진 게시판(slug=photo)에 더미 게시글 30건 + 사진 첨부를 생성한다.
- 사진 소스: ~/Desktop/행사사진 (16장 순환)
- 사진 복사 위치: backend/uploads/attachments/{uuid}.{ext}
- 글 제목: [TEST] prefix → 일괄 삭제 식별용
"""
import shutil
import uuid
from pathlib import Path

import psycopg2

DB_DSN = "dbname=cathedral user=kangtaehun"
BOARD_SLUG = "photo"

PROJECT_ROOT = Path("/Users/kangtaehun/Dev/faithandme")
PHOTO_SRC_DIR = Path.home() / "Desktop" / "행사사진"
ATTACH_DIR = PROJECT_ROOT / "backend" / "uploads" / "attachments"

POSTS = [
    ("본당의 날 — 성 베드로 사도 대축일 한마당",
     "본당 주보 성인 대축일을 기념해 미사 후 성당 마당에서 펼쳐진 한마당. 어른 아이 할 것 없이 모두 한자리에 모였습니다."),
    ("성지 순례 — 베타니아 성지",
     "본당 가족 80여 명이 함께 떠난 베타니아 성지 순례. 십자가의 길을 함께 걸으며 마음을 나눈 하루였습니다."),
    ("야외 미사 — 봄꽃이 핀 성당 정원에서",
     "성당 본당이 아닌 정원에서 봉헌한 가정의 달 야외 미사. 푸른 하늘 아래 봉헌한 미사가 더 깊었습니다."),
    ("어버이날 행사 — 어르신께 카네이션을",
     "주일학교 아이들이 직접 만든 카네이션을 어르신들 가슴에 달아드린 따뜻한 시간이었습니다."),
    ("어린이날 한마당 — 본당 마당 가득 웃음",
     "주일학교가 준비한 어린이날 한마당. 풍선, 페이스 페인팅, 솜사탕에 아이들이 신나했습니다."),
    ("김장 봉사 — 이웃과 함께 나누는 사랑",
     "본당 가족 50여 명이 모여 배추 200포기를 담갔습니다. 어려운 이웃들에게 고루 나눠 드립니다."),
    ("자선 바자 — 마음을 모은 하루",
     "본당 분과별로 준비한 자선 바자. 수익금은 모두 본당의 사랑 나눔 기금으로 봉헌됩니다."),
    ("성령 강림 야외 미사",
     "초여름 푸른 잔디 위에 자리를 펴고 봉헌한 성령 강림 대축일 야외 미사. 바람이 성령처럼 다가왔습니다."),
    ("신년 하례식 — 본당 가족 새해 인사",
     "주일 미사 후 본당 가족이 함께 모여 나눈 새해 첫 인사. 떡국 한 그릇씩 나누며 한 해를 시작했습니다."),
    ("송년 미사 후 친교 — 한 해를 마무리하며",
     "12월 마지막 주일 미사 후 본당 식당에 모여 한 해의 감사를 나눴습니다."),
    ("본당 가족 한마당 — 단체 사진",
     "본당 마당 계단에 한자리에 모인 본당 가족 단체 사진. 한 사람도 빠짐없이 담았습니다."),
    ("사목회 야유회 — 친교의 시간",
     "1년간 봉사한 사목회 임원과 분과장들이 함께 떠난 야유회. 일에서 잠시 떠나 우정을 나눴습니다."),
    ("청년회 MT — 신앙과 친교",
     "1박 2일 청년회 봄 MT. 미사, 성경 나눔, 게임, 캠프파이어로 알차게 채운 시간이었습니다."),
    ("레지오 마리애 단합대회",
     "본당 레지오 마리애 단원들이 모여 한 해의 활동을 점검하고 단합을 다진 자리였습니다."),
    ("성가대 정기 연주회",
     "한 해 동안 갈고닦은 성가를 본당 가족 앞에서 봉헌한 성가대 정기 연주회. 성가대원들의 땀이 빛났습니다."),
    ("새 식구 환영회 — 새 영세자 가족과 함께",
     "부활 성야에 세례를 받으신 새 가족을 위해 본당이 함께 마련한 환영회. 인사와 박수가 따뜻했습니다."),
    ("첫영성체 가족 체육대회",
     "첫영성체를 마친 어린이들과 가족이 함께한 가을 체육대회. 부모와 자녀가 손잡고 달렸습니다."),
    ("분과 친교 모임 — 사회복지분과",
     "한 해의 봉사를 마무리하며 분과별로 모여 친교를 나눈 자리. 봉사로 만난 사람들과 친구가 되었습니다."),
    ("봉사 소그룹 모임 — 환자 방문 봉사회",
     "거동 불편하신 신자분들을 찾아 뵙는 환자 방문 봉사회 모임. 작은 손길이 큰 위로가 됩니다."),
    ("성지 답사 — 다음 순례를 위한 사전 답사",
     "본당 가족 단체 순례를 위해 봉사자들이 미리 다녀온 성지 답사. 길과 식당, 화장실까지 꼼꼼히 점검했습니다."),
    ("본당 도서관 개관식",
     "신앙 서적을 모은 본당 도서관 개관식. 신부님께서 축복 기도를 봉헌해 주셨습니다."),
    ("새 사제관 입주 축하",
     "본당 사제관 새 단장 후 입주를 축하하며 모인 자리. 본당 가족이 정성껏 준비했습니다."),
    ("부활 달걀 나누기",
     "부활 미사 후 본당 마당에서 어린이들에게 부활 달걀을 나눠 주었습니다. 작은 기쁨이 가득했습니다."),
    ("성탄 트리 점등식 — 본당 마당의 빛",
     "대림 첫 주일 저녁, 본당 마당의 큰 트리에 불이 켜졌습니다. 본당 가족이 둘러서서 함께 박수쳤습니다."),
    ("봄맞이 환경 정화 — 본당 주변 청소",
     "본당 가족이 함께 모여 본당 주변 거리와 공원을 청소했습니다. 이웃에게 드리는 작은 선물이었습니다."),
    ("가을 본당 정원 가꾸기",
     "본당 정원의 묵은 잎을 거두고 새로 화단을 다듬은 봉사 시간. 흙 묻은 손이 정겨웠습니다."),
    ("신부님 환송 미사 — 감사한 7년",
     "본당에 7년을 함께해 주신 신부님 환송 미사. 본당 가족 모두가 마지막 인사를 드렸습니다."),
    ("새 신부님 환영 — 첫 미사 후 인사",
     "새로 부임하신 신부님의 첫 주일 미사 후 본당 가족이 줄을 서서 인사를 드렸습니다."),
    ("본당 50주년 기념식 — 함께 걸어온 길",
     "본당 설립 50주년을 기념해 봉헌한 미사와 기념식. 옛 사진과 함께 지난 50년을 돌아봤습니다."),
    ("견진 가족 사진 촬영",
     "견진성사를 받은 형제 자매와 가족, 대부모님이 함께한 단체 사진. 모두의 환한 표정이 담겼습니다."),
]

assert len(POSTS) == 30


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
                    """,
                    (post_id, photo.name, stored, url, size, is_image),
                )

                print(f"  [{idx+1:>2}/30] post#{post_id} ← {photo.name}")

        conn.commit()
        print(f"\n[done] posts {len(inserted_post_ids)}건")
        if inserted_post_ids:
            print(f"[range] post id: {min(inserted_post_ids)} ~ {max(inserted_post_ids)}")
            ids = ",".join(str(i) for i in inserted_post_ids)
            print("\n--- 일괄 삭제용 SQL ---")
            print(f"DELETE FROM attachments WHERE post_id IN ({ids});")
            print(f"DELETE FROM posts WHERE id IN ({ids});")
    except Exception as e:
        conn.rollback()
        print(f"[error] 실패, 롤백됨: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
