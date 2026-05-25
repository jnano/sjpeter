import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "본당 일정",
};

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
