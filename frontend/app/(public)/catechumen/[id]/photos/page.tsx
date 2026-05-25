import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import AlbumView from "./AlbumView";

export const metadata: Metadata = {
  title: "예비자교리 사진",
  description: "예비자교리 차수별 사진 앨범",
};

export default async function CatechumenPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader group="성당 소개" title="예비자교리 사진" subtitle="차수별 사진 앨범 (회원 전용)" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <AlbumView classId={Number(id)} />
      </div>
    </>
  );
}
