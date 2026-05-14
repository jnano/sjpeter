"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Notice { id: number; title: string; }

export default function NoticeTicker({ notices }: { notices: Notice[] }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (notices.length <= 1) return;
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % notices.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(timer);
  }, [notices.length]);

  if (notices.length === 0) {
    return (
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", fontWeight: 300, margin: 0 }}>
        공지사항이 없습니다.
      </p>
    );
  }

  const notice = notices[idx];
  return (
    <Link
      href="/boards/notice"
      style={{
        fontSize: "13px",
        color: "rgba(255,255,255,0.85)",
        fontWeight: 300,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        textDecoration: "none",
        flex: 1,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.4s ease",
      }}
    >
      📌 {notice.title}
      {notices.length > 1 && (
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginLeft: "10px" }}>
          {idx + 1}/{notices.length}
        </span>
      )}
    </Link>
  );
}
