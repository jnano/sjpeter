"use client";

import { VisionTab } from "../content/page";

export default function AdminVisionPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">사목지표</h1>
        <p className="text-sm text-gray-500 mt-1">본당의 사목 방향을 관리합니다.</p>
      </div>
      <VisionTab />
    </div>
  );
}
