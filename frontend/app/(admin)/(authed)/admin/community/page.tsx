"use client";

import { CommunityTab } from "../content/page";

export default function AdminCommunityPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">단체·분과</h1>
        <p className="text-sm text-gray-500 mt-1">단체와 분과 정보를 관리합니다.</p>
      </div>
      <CommunityTab />
    </div>
  );
}
