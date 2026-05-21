"use client";

import { MeditationTab } from "../content/page";

export default function AdminMeditationPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">주일 말씀</h1>
        <p className="text-sm text-gray-500 mt-1">주일 말씀과 묵상 글을 관리합니다.</p>
      </div>
      <MeditationTab />
    </div>
  );
}
