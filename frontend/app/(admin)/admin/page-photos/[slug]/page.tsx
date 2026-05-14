"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { notFound } from "next/navigation";
import PageHeroPhotoEditor from "@/components/PageHeroPhotoEditor";

const API = process.env.NEXT_PUBLIC_API_URL;

interface PagePhotoSlug {
  id: number;
  slug: string;
  label: string;
  public_href: string;
  description: string | null;
  fallback_url: string | null;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function AdminPagePhotoSlug({ params }: PageProps) {
  const { slug } = use(params);
  const [meta, setMeta] = useState<PagePhotoSlug | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/page-photos/slugs`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PagePhotoSlug[]) => {
        const m = data.find((s) => s.slug === slug);
        if (!m) setMissing(true);
        else setMeta(m);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (missing) notFound();
  if (loading || !meta) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <p className="text-gray-500">불러오는 중...</p>
      </div>
    );
  }

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
            href={meta.public_href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            {meta.public_href} 보기 →
          </a>
        </div>
      </div>

      <PageHeroPhotoEditor slug={meta.slug} />
    </div>
  );
}
