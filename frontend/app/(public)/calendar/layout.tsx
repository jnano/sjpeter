import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "행사 일정",
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
