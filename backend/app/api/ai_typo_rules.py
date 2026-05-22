"""AI 추출 오타 사전 admin CRUD.

- GET    /api/admin/ai-typo-rules
- POST   /api/admin/ai-typo-rules
- PATCH  /api/admin/ai-typo-rules/{id}
- DELETE /api/admin/ai-typo-rules/{id}

fix_typos 가 DB 에서 매번 fetch 하므로 캐시 없이 즉시 반영.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import asc
from sqlalchemy.orm import Session

from app.core.admin_log import get_admin_identifier, log_action
from app.core.auth import get_current_admin
from app.core.database import get_db
from app.models.admin import Admin
from app.models.ai_typo_rule import AiTypoRule

router = APIRouter(prefix="/admin/ai-typo-rules", tags=["ai-typo-rules"])


class TypoRuleIn(BaseModel):
    wrong: str
    replacement: str
    note: Optional[str] = None
    exclude_prefixes: Optional[list[str]] = None


class TypoRuleUpdate(BaseModel):
    wrong: Optional[str] = None
    replacement: Optional[str] = None
    note: Optional[str] = None
    exclude_prefixes: Optional[list[str]] = None


class TypoRuleOut(BaseModel):
    id: int
    wrong: str
    replacement: str
    note: Optional[str] = None
    exclude_prefixes: Optional[list[str]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


@router.get("", response_model=list[TypoRuleOut])
def list_rules(db: Session = Depends(get_db), _: Admin = Depends(get_current_admin)):
    rows = db.query(AiTypoRule).order_by(asc(AiTypoRule.wrong)).all()
    return [TypoRuleOut.model_validate(r) for r in rows]


@router.post("", response_model=TypoRuleOut, status_code=201)
def create_rule(body: TypoRuleIn, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    wrong = body.wrong.strip()
    repl = body.replacement.strip()
    if not wrong or not repl:
        raise HTTPException(status_code=400, detail="wrong·replacement 모두 비울 수 없습니다.")
    if wrong == repl:
        raise HTTPException(status_code=400, detail="wrong 과 replacement 가 같으면 의미가 없습니다.")
    if db.query(AiTypoRule).filter(AiTypoRule.wrong == wrong).first():
        raise HTTPException(status_code=409, detail=f"이미 등록된 오타: {wrong!r}")
    excludes = [p.strip() for p in (body.exclude_prefixes or []) if p and p.strip()] or None
    rule = AiTypoRule(
        wrong=wrong, replacement=repl,
        note=(body.note or "").strip() or None,
        exclude_prefixes=excludes,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    log_action(db, get_admin_identifier(admin), "create_ai_typo_rule", "ai_typo_rule", rule.id, f"{wrong} → {repl}")
    return TypoRuleOut.model_validate(rule)


@router.patch("/{rule_id}", response_model=TypoRuleOut)
def update_rule(rule_id: int, body: TypoRuleUpdate, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rule = db.query(AiTypoRule).filter(AiTypoRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="규칙을 찾을 수 없습니다.")
    if body.wrong is not None:
        new_w = body.wrong.strip()
        if not new_w:
            raise HTTPException(status_code=400, detail="wrong 은 비울 수 없습니다.")
        if new_w != rule.wrong and db.query(AiTypoRule).filter(AiTypoRule.wrong == new_w).first():
            raise HTTPException(status_code=409, detail=f"이미 등록된 오타: {new_w!r}")
        rule.wrong = new_w
    if body.replacement is not None:
        new_r = body.replacement.strip()
        if not new_r:
            raise HTTPException(status_code=400, detail="replacement 는 비울 수 없습니다.")
        rule.replacement = new_r
    if body.note is not None:
        rule.note = body.note.strip() or None
    if body.exclude_prefixes is not None:
        cleaned = [p.strip() for p in body.exclude_prefixes if p and p.strip()]
        rule.exclude_prefixes = cleaned or None
    if rule.wrong == rule.replacement:
        raise HTTPException(status_code=400, detail="wrong 과 replacement 가 같으면 의미가 없습니다.")
    db.commit()
    db.refresh(rule)
    log_action(db, get_admin_identifier(admin), "update_ai_typo_rule", "ai_typo_rule", rule.id, f"{rule.wrong} → {rule.replacement}")
    return TypoRuleOut.model_validate(rule)


@router.delete("/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db), admin: Admin = Depends(get_current_admin)):
    rule = db.query(AiTypoRule).filter(AiTypoRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="규칙을 찾을 수 없습니다.")
    snap = f"{rule.wrong} → {rule.replacement}"
    db.delete(rule)
    db.commit()
    log_action(db, get_admin_identifier(admin), "delete_ai_typo_rule", "ai_typo_rule", rule_id, snap)
    return None
