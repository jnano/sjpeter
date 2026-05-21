"use client";

import { CouncilTab } from "../content/page";

export default function AdminCouncilPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">사목평의회</h1>
        <p className="text-sm text-gray-500 mt-1">회장단·분과대표·구역장대표를 관리합니다.</p>
      </div>
      <CouncilTab />
    </div>
  );
}
