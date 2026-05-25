import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ApplyForm from "./ApplyForm";

export const metadata: Metadata = {
  title: "입교신청",
  description: "예비자교리 입교신청",
};

export default function CatechumenApplyPage() {
  return (
    <>
      <PageHeader group="성당 소개" title="입교신청" subtitle="예비자교리 입교를 신청합니다" />
      <div className="max-w-2xl mx-auto px-4 py-12">
        <ApplyForm />
      </div>
    </>
  );
}
