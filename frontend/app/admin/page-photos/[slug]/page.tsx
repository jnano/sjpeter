"use client";

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import PageHeroPhotoEditor from "@/components/PageHeroPhotoEditor";
import { PAGE_PHOTO_SLUGS } from "../slugs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function AdminPagePhotoSlug({ params }: PageProps) {
  const { slug } = use(params);
  const meta = PAGE_PHOTO_SLUGS.find((s) => s.slug === slug);
  if (!meta) notFound();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/admin/page-photos" className="hover:text-blue-500">페이지 사진</Link>
          <span>›</span>
          <span className="text-gray-700">{meta.label}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{meta.label} 사진</h1>
            <p className="text-sm text-gray-500 mt-1">{meta.description}</p>
          </div>
          <a
            href={meta.publicHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            {meta.publicHref} 보기 →
          </a>
        </div>
      </div>

      <PageHeroPhotoEditor slug={meta.slug} />
    </div>
  );
}
