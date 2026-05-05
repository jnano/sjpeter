"""관리자 비밀번호 변경 스크립트

사용법:
    python change_password.py
"""
import getpass
from app.core.database import SessionLocal, create_tables
import app.models
from app.models.admin import Admin
from app.core.auth import hash_password

create_tables()

db = SessionLocal()
admin = db.query(Admin).filter(Admin.username == "admin").first()
if not admin:
    print("관리자 계정을 찾을 수 없습니다.")
    db.close()
    exit(1)

print("새 비밀번호를 입력하세요 (입력 내용은 화면에 표시되지 않습니다)")
pw1 = getpass.getpass("새 비밀번호: ")
pw2 = getpass.getpass("비밀번호 확인: ")

if pw1 != pw2:
    print("비밀번호가 일치하지 않습니다.")
    db.close()
    exit(1)

if len(pw1) < 8:
    print("비밀번호는 8자 이상이어야 합니다.")
    db.close()
    exit(1)

admin.hashed_password = hash_password(pw1)
db.commit()
db.close()

print("비밀번호가 변경되었습니다.")
