import "server-only";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";

const API = process.env.BACKEND_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// site_settings DB 단일 source-of-truth. process.env 의 AUTH_* fallback 은 사용하지 않는다.
// AUTH_SECRET은 백엔드 startup 에서 자동 발급 후 DB 저장. 변경 시 모든 세션이 무효화되므로 운영 중 수정 금지.
type InternalConfig = Partial<Record<
  "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" |
  "KAKAO_CLIENT_ID" | "KAKAO_CLIENT_SECRET" |
  "AUTH_SECRET", string>>;
const CACHE_TTL_MS = 60_000;
// backend 가 아직 startup 중이거나 일시 장애일 때 NextAuth 가 기다리도록 backoff retry.
// 총 3.5초 — 그 안에 backend 가 ready 되면 첫 진입 500 (MissingSecret) 발생 안 함.
const RETRY_DELAYS_MS = [500, 1000, 2000];
let _configCache: { at: number; data: InternalConfig } | null = null;

async function _tryFetchConfig(): Promise<InternalConfig | null> {
  try {
    const res = await fetch(`${API}/api/internal/config`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as InternalConfig;
    // AUTH_SECRET 누락 응답은 미완성으로 간주 — 재시도 유도
    if (!(data.AUTH_SECRET ?? "").trim()) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchInternalConfig(): Promise<InternalConfig> {
  const now = Date.now();
  if (_configCache && now - _configCache.at < CACHE_TTL_MS) return _configCache.data;

  let data = await _tryFetchConfig();
  for (const delay of RETRY_DELAYS_MS) {
    if (data) break;
    await new Promise((r) => setTimeout(r, delay));
    data = await _tryFetchConfig();
  }

  if (data) {
    _configCache = { at: now, data };
    return data;
  }
  // 모든 시도 실패 — 마지막 캐시 사용. 캐시도 없으면 빈 객체 → secret undefined 로 500
  // (backend 가 영영 안 뜨는 케이스는 의도적 fail — 다른 API 도 다 실패하는 상태)
  return _configCache?.data ?? {};
}

function take(v: string | undefined): string {
  return (v ?? "").trim();
}

export const { handlers, signIn, signOut, auth } = NextAuth(async () => {
  const db = await fetchInternalConfig();
  const googleId     = take(db.GOOGLE_CLIENT_ID);
  const googleSecret = take(db.GOOGLE_CLIENT_SECRET);
  const kakaoId      = take(db.KAKAO_CLIENT_ID);
  const kakaoSecret  = take(db.KAKAO_CLIENT_SECRET);
  const authSecret   = take(db.AUTH_SECRET);

  return {
  secret: authSecret || undefined,  // 빈 문자열이면 NextAuth가 에러를 throw — 의도된 동작
  providers: [
    ...(googleId && googleSecret
      ? [Google({ clientId: googleId, clientSecret: googleSecret })]
      : []),
    ...(kakaoId && kakaoSecret
      ? [Kakao({ clientId: kakaoId, clientSecret: kakaoSecret })]
      : []),
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
        remember: { label: "로그인 상태 유지", type: "text" },
      },
      async authorize(credentials) {
        const remember = credentials.remember === "1" || credentials.remember === true;
        const res = await fetch(`${API}/api/members/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            remember,
          }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        const displayName = data.member.name
          ? `${data.member.name}(${data.member.nickname})`
          : data.member.nickname;
        return {
          id: String(data.member.id),
          email: data.member.email,
          name: displayName,
          image: data.member.avatar_url ?? null,
          accessToken: data.access_token,
          isAdmin: !!data.member.is_admin,
          interestPromptCompleted: !!data.member.interest_prompt_completed,
          remember,
          expiresIn: Number(data.expires_in) || 12 * 3600,
        } as { id: string; email: string; name: string; image: string | null; accessToken: string; isAdmin: boolean; interestPromptCompleted: boolean; remember: boolean; expiresIn: number };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === "update") {
        if (session?.picture !== undefined) token.picture = session.picture;
        if (session?.name !== undefined) token.name = session.name;
        // 보안: 클라이언트는 동기화 요청만 보내고, 실제 is_admin은 백엔드에 재조회한다
        if (session?.refreshAdmin === true && token.accessToken) {
          try {
            const res = await fetch(`${API}/api/members/me`, {
              headers: { Authorization: `Bearer ${token.accessToken as string}` },
            });
            if (res.ok) {
              const m = await res.json();
              token.isAdmin = !!m.is_admin;
              token.interestPromptCompleted = !!m.interest_prompt_completed;
            } else if (res.status === 401 || res.status === 403) {
              token.isAdmin = false;
            }
          } catch {}
        }
        return token;
      }

      if (account?.provider === "google" || account?.provider === "kakao") {
        try {
          const res = await fetch(`${API}/api/members/social-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: account.provider,
              provider_id: account.providerAccountId,
              email: user?.email,
              name: user?.name,
              avatar_url: user?.image,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            token.accessToken = data.access_token;
            token.memberId = data.member.id;
            token.isAdmin = !!data.member.is_admin;
            token.interestPromptCompleted = !!data.member.interest_prompt_completed;
            token.name = data.member.name
              ? `${data.member.name}(${data.member.nickname})`
              : data.member.nickname;
            const av = data.member.avatar_url;
            token.picture = av
              ? av.startsWith("/") ? `${API}${av}` : av
              : (user?.image ?? null);
            const exp = Number(data.expires_in) || 12 * 3600;
            token.absoluteExpiry = Date.now() + exp * 1000;
            token.remember = false; // 소셜 로그인은 기본 세션 길이
          }
        } catch {}
        return token;
      }

      if (user && (user as { accessToken?: string }).accessToken) {
        const u = user as { accessToken: string; isAdmin?: boolean; interestPromptCompleted?: boolean; remember?: boolean; expiresIn?: number };
        token.accessToken = u.accessToken;
        token.memberId = Number(user.id);
        token.isAdmin = u.isAdmin ?? false;
        token.interestPromptCompleted = u.interestPromptCompleted ?? false;
        token.remember = u.remember ?? false;
        token.absoluteExpiry = Date.now() + (u.expiresIn ?? 12 * 3600) * 1000;
        // Credentials 로그인 시 header 의 아바타·이름 동기화 — backend avatar_url 을 token.picture 로
        if (user.name) token.name = user.name;
        if (user.image) {
          const img = user.image as string;
          token.picture = img.startsWith("/") ? `${API}${img}` : img;
        } else {
          token.picture = null;
        }
        return token;
      }

      if (!token.memberId && token.accessToken) {
        try {
          const payload = JSON.parse(
            Buffer.from((token.accessToken as string).split(".")[1], "base64").toString()
          );
          token.memberId = Number(payload.sub);
        } catch {}
      }
      return token;
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.memberId = token.memberId as number;
      (session as { isAdmin?: boolean }).isAdmin = (token.isAdmin as boolean) ?? false;
      (session as { interestPromptCompleted?: boolean }).interestPromptCompleted =
        (token.interestPromptCompleted as boolean) ?? false;
      (session as { remember?: boolean }).remember = (token.remember as boolean) ?? false;
      (session as { absoluteExpiry?: number }).absoluteExpiry =
        (token.absoluteExpiry as number) ?? 0;
      if (token.name) session.user.name = token.name as string;
      if (token.picture !== undefined) {
        session.user.image = token.picture as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/members/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,  // 쿠키 최대 수명 7일 (실제 만료는 SessionTimeout이 absoluteExpiry로 강제)
    updateAge: 30 * 60,         // 활동 시 30분마다 세션 갱신 (rolling)
  },
  };
});
