#!/usr/bin/env bash
# faithandme 자동 백업 스크립트 (v1.5.460)
#
# 사용:
#   1) 권한: chmod +x scripts/cron_backup.sh
#   2) 환경 변수 .env 또는 직접 export
#   3) crontab 등록: scripts/cron_backup.crontab.example 참조
#
# 무엇을 하나:
#   - PostgreSQL 전체 DB 를 pg_dump 로 db_full.sql 저장
#   - uploads/ private-uploads/ 디렉토리 같이 tar.gz 압축
#   - 결과를 BACKUP_DIR 에 backup_YYYYMMDD_HHMMSS.tar.gz 로 저장
#   - RETENTION_DAYS (기본 30) 이상 된 백업 파일 자동 삭제
#
# 환경 변수:
#   DB_USER         (기본: $USER)
#   DB_NAME         (기본: cathedral)
#   DB_HOST         (기본: localhost)
#   DB_PORT         (기본: 5432)
#   PGPASSWORD      (선택: PG 비밀번호. 없으면 ~/.pgpass 또는 trust)
#   PROJECT_DIR     (기본: 이 스크립트 부모의 부모)
#   BACKUP_DIR      (기본: $PROJECT_DIR/backend/backups)
#   RETENTION_DAYS  (기본: 30)
#   NOTIFY_EMAIL    (선택: 실패 시 메일 발송)

set -Eeuo pipefail

# ── 기본값 ──
DB_USER="${DB_USER:-$USER}"
DB_NAME="${DB_NAME:-cathedral}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(dirname "$SCRIPT_DIR")}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backend/backups}"
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
STAGING="$(mktemp -d -t faithandme_backup_XXXXXX)"
ARCHIVE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"

cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

notify_failure() {
  local msg="$1"
  echo "❌ 백업 실패: $msg" >&2
  if [[ -n "$NOTIFY_EMAIL" ]] && command -v mail >/dev/null 2>&1; then
    echo "$msg" | mail -s "[faithandme] 백업 실패 ($TIMESTAMP)" "$NOTIFY_EMAIL"
  fi
}
trap 'notify_failure "스크립트 중간 실패 (line $LINENO)"' ERR

# ── 1) 백업 디렉토리 보장 ──
mkdir -p "$BACKUP_DIR"

# ── 2) pg_dump (스키마+데이터 plain SQL) ──
echo "▶ pg_dump $DB_NAME @ $DB_HOST:$DB_PORT ..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --no-owner --no-acl "$DB_NAME" \
  > "$STAGING/db_full.sql"

# ── 3) site_settings 별도 (빠른 키만 복원 가능하게) ──
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --data-only --inserts \
  -t site_settings "$DB_NAME" > "$STAGING/site_settings_data.sql"

# ── 4) uploads/ private-uploads/ 복사 ──
for d in uploads private-uploads; do
  src="$PROJECT_DIR/backend/$d"
  if [[ -d "$src" ]]; then
    echo "▶ copy $d ..."
    cp -R "$src" "$STAGING/$d"
  fi
done

# ── 5) RESTORE.md ──
cat > "$STAGING/RESTORE.md" <<EOF
# 백업 복구 안내 — $TIMESTAMP

## 압축 해제 후
\`\`\`bash
psql -U $DB_USER -d $DB_NAME < db_full.sql
# 또는 키만 별도 복원:
psql -U $DB_USER -d $DB_NAME < site_settings_data.sql
\`\`\`

uploads/ 와 private-uploads/ 는 \`backend/\` 의 같은 경로에 그대로 복사.
EOF

# ── 6) tar.gz 압축 ──
echo "▶ tar czf $ARCHIVE ..."
tar czf "$ARCHIVE" -C "$STAGING" .

SIZE=$(du -h "$ARCHIVE" | cut -f1)
echo "✅ 백업 완료: $ARCHIVE ($SIZE)"

# ── 7) 보존 정책 — RETENTION_DAYS 보다 오래된 파일 삭제 ──
if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  echo "▶ 보존 정책: ${RETENTION_DAYS}일 이상 된 백업 삭제"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "backup_*.tar.gz" \
    -mtime "+$RETENTION_DAYS" -print -delete || true
fi

# 성공 시 ERR trap 해제
trap - ERR
