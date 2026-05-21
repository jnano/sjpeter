"use client";

import { HistoryTab } from "../content/page";

export default function AdminHistoryPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">연혁</h1>
        <p className="text-sm text-gray-500 mt-1">성당의 역사·연혁 기록을 관리합니다.</p>
      </div>
      <HistoryTab />
    </div>
  );
}
