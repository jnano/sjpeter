import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const INTERNAL_API = "http://localhost:8000";

let _oauthCache: Record<string, string> = {};
let _oauthCacheAt = 0;
const OAUTH_TTL = 5 * 60 * 1000;

async function fetchDbOAuth(): Promise<Record<string, string>> {
  if (Date.now() - _oauthCacheAt < OAUTH_TTL) return _oauthCache;
  try {
    const res = await fetch(`${INTERNAL_API}/api/internal/config`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      _oauthCache = await res.json();
      _oauthCacheAt = Date.now();
    }
  } catch {}
  return _oauthCache;
}

export const { handlers, signIn, signOut, auth } = NextAuth(async () => {
  const db = await fetchDbOAuth();

  const googleId     = db.GOOGLE_CLIENT_ID     || process.env.AUTH_GOOGLE_ID     || "";
  const googleSecret = db.GOOGLE_CLIENT_SECRET  || process.env.AUTH_GOOGLE_SECRET  || "";
  const kakaoId      = db.KAKAO_CLIENT_ID       || process.env.AUTH_KAKAO_ID      || "";
  const kakaoSecret  = db.KAKAO_CLIENT_SECRET   || process.env.AUTH_KAKAO_SECRET   || "";
  const authSecret   = db.AUTH_SECRET           || process.env.AUTH_SECRET         || "";

  return {
    ...(authSecret ? { secret: authSecret } : {}),
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
        },
        async authorize(credentials) {
          const res = await fetch(`${API}/api/members/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
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
            accessToken: data.access_token,
          };
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user, account, trigger, session }) {
        if (trigger === "update") {
          if (session?.picture !== undefined) token.picture = session.picture;
          if (session?.name !== undefined) token.name = session.name;
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
              token.name = data.member.name
                ? `${data.member.name}(${data.member.nickname})`
                : data.member.nickname;
              const av = data.member.avatar_url;
              token.picture = av
                ? av.startsWith("/") ? `${API}${av}` : av
                : (user?.image ?? null);
            }
          } catch {}
          return token;
        }

        if (user && (user as { accessToken?: string }).accessToken) {
          token.accessToken = (user as { accessToken: string }).accessToken;
          token.memberId = Number(user.id);
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
    session: { strategy: "jwt" },
  };
});
