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
});
