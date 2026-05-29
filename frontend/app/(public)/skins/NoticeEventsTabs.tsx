"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Dashboard 홈의 'Notice · Events' 카드 안 탭 — 공지사항 ↔ 행사·모임 전환.
 * v1.5.409 옵션 B 적용. 시안 home-v2.html 의 notice-tabs 시각 패턴 + 본문 영역에서
 * 같은 grid 마크업(.notice-list-card, .upcoming-list) 을 전환식으로 보여줌.
 */
interface NoticeBrief {
  id: number;
  title: string;
  is_pinned: boolean;
  created_at: string;
}
interface EventBrief {
  id: number;
  title: string;
  event_date: string;
  event_kind: string | null;
}

function mmdd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;

export default function NoticeEventsTabs({
  notices,
  events,
}: {
  notices: NoticeBrief[];
  events: EventBrief[];
}) {
  const [tab, setTab] = useState<"notice" | "events">("notice");
  const now = new Date();
  const todayStr = now.toDateString();

  return (
    <>
      <div className="notice-tabs">
        <button
          type="button"
          className={`tab${tab === "notice" ? " on" : ""}`}
          onClick={() => setTab("notice")}
        >
          공지사항
        </button>
        <button
          type="button"
          className={`tab${tab === "events" ? " on" : ""}`}
          onClick={() => setTab("events")}
        >
          행사·모임
        </button>
      </div>

      {tab === "notice" ? (
        <ul className="notice-list-card" style={{ marginTop: 14 }}>
          {notices.length === 0 ? (
            <li><span className="title" style={{ gridColumn: "1/3" }}>등록된 공지가 없습니다</span><span /></li>
          ) : (
            notices.slice(0, 6).map((n) => (
              <li key={n.id}>
                {n.is_pinned ? <span className="pin">고정</span> : <span />}
                <Link
                  href={`/boards/notice/${n.id}`}
                  className="title"
                  style={!n.is_pinned ? { gridColumn: "1/3" } : undefined}
                >
                  {n.title}
                </Link>
                <span className="date">{mmdd(n.created_at)}</span>
              </li>
            ))
          )}
        </ul>
      ) : (
        <ul className="upcoming-list" style={{ marginTop: 14 }}>
          {events.length === 0 ? (
            <li className="up-empty">예정된 일정이 없습니다</li>
          ) : (
            events.slice(0, 8).map((e) => {
              const d = new Date(e.event_date);
              const m = d.getMonth() + 1;
              const day = d.getDate();
              const dow = WEEKDAY[d.getDay()];
              const isToday = d.toDateString() === todayStr;
              const kindCls = e.event_kind === "행사"
                ? "kind-event"
                : e.event_kind === "모임"
                ? "kind-meeting"
                : "kind-none";
              return (
                <li key={e.id} className={isToday ? "is-today" : ""}>
                  <span className="up-date">
                    <b>{m}/{day}</b>
                    <small>({dow})</small>
                  </span>
                  <Link href={`/calendar?focus=${e.id}`} className="up-title">{e.title}</Link>
                  {e.event_kind && <span className={`up-kind ${kindCls}`}>{e.event_kind}</span>}
                </li>
              );
            })
          )}
        </ul>
      )}
    </>
  );
}
