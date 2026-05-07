"use client";
import { useState } from "react";
import Link from "next/link";
import type { Bulletin } from "@/lib/api";

interface Notice {
  id: number;
  title: string;
  is_pinned: boolean;
  created_at: string;
}

interface Props {
  notices: Notice[];
  bulletins: Bulletin[];
}

const PF = "var(--font-playfair), 'Playfair Display', Georgia, serif";

export default function HomeBoards({ notices, bulletins }: Props) {
  const [tab, setTab] = useState<"notice" | "bulletin">("notice");

  const tabStyle = (active: boolean) => ({
    padding: "10px 22px",
    fontSize: "13px",
    fontWeight: 600,
    color: active ? "var(--navy)" : "var(--stone)",
    cursor: "pointer",
    borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    marginBottom: "-2px",
    transition: "all 0.2s",
    fontFamily: "var(--font-noto-serif-kr), serif",
    letterSpacing: "0.05em",
    background: "none",
  } as React.CSSProperties);

  return (
    <div>
      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: "2px solid var(--border-gold)", marginBottom: "24px" }}>
        <button style={tabStyle(tab === "notice")} onClick={() => setTab("notice")}>공지사항</button>
        <button style={tabStyle(tab === "bulletin")} onClick={() => setTab("bulletin")}>주보</button>
      </div>

      {/* 공지사항 */}
      {tab === "notice" && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {notices.length === 0 && (
            <li style={{ padding: "20px 0", color: "var(--stone)", fontSize: "14px" }}>등록된 공지사항이 없습니다.</li>
          )}
          {notices.map((n) => (
            <li key={n.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", padding: "13px 0", borderBottom: "1px solid var(--border-gold)" }}>
              {n.is_pinned && (
                <span style={{ fontSize: "10px", background: "var(--burgundy)", color: "#fff", padding: "2px 7px", borderRadius: "2px", flexShrink: 0 }}>고정</span>
              )}
              <Link href="/boards/notice" style={{ flex: 1, fontSize: "14px", color: "var(--navy)", textDecoration: "none", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {n.title}
              </Link>
              <span style={{ fontSize: "11.5px", color: "var(--stone)", whiteSpace: "nowrap", flexShrink: 0 }}>
                {new Date(n.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* 주보 */}
      {tab === "bulletin" && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {bulletins.length === 0 && (
            <li style={{ padding: "20px 0", color: "var(--stone)", fontSize: "14px" }}>등록된 주보가 없습니다.</li>
          )}
          {bulletins.map((b) => (
            <li key={b.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", padding: "13px 0", borderBottom: "1px solid var(--border-gold)" }}>
              <Link href="/bulletin" style={{ flex: 1, fontSize: "14px", color: "var(--navy)", textDecoration: "none", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {b.liturgical_season ? `${b.published_date} — ${b.liturgical_season}` : b.published_date}
                {b.issue_number ? ` (제${b.issue_number}호)` : ""}
              </Link>
              <span style={{ fontSize: "11.5px", color: "var(--stone)", whiteSpace: "nowrap", flexShrink: 0 }}>{b.published_date}</span>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
        <Link href={tab === "notice" ? "/boards/notice" : "/bulletin"} style={{ fontSize: "12px", color: "var(--gold)", textDecoration: "none", letterSpacing: "0.1em" }}>
          더보기 +
        </Link>
      </div>
    </div>
  );
}
