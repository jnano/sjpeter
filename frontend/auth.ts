import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Kakao from "next-auth/providers/kakao";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const googleId     = process.env.AUTH_GOOGLE_ID     ?? "";
const googleSecret = process.env.AUTH_GOOGLE_SECRET  ?? "";
const kakaoId      = process.env.AUTH_KAKAO_ID       ?? "";
const kakaoSecret  = process.env.AUTH_KAKAO_SECRET   ?? "";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
          accessToken: data.access_token,
          isAdmin: !!data.member.is_admin,
          remember,
          expiresIn: Number(data.expires_in) || 12 * 3600,
        } as { id: string; email: string; name: string; accessToken: string; isAdmin: boolean; remember: boolean; expiresIn: number };
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
        const u = user as { accessToken: string; isAdmin?: boolean; remember?: boolean; expiresIn?: number };
        token.accessToken = u.accessToken;
        token.memberId = Number(user.id);
        token.isAdmin = u.isAdmin ?? false;
        token.remember = u.remember ?? false;
        token.absoluteExpiry = Date.now() + (u.expiresIn ?? 12 * 3600) * 1000;
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
});
