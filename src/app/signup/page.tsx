import type { Metadata } from "next";
import { AuthPage } from "../../views/AuthPage";
import { safeRedirect } from "../../services/redirect";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create your Prime Edge Football account and explore SoccerTradeView.",
  robots: { index: false, follow: true },
};
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    next?: string | string[];
    invite?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const invite = Array.isArray(params.invite)
    ? params.invite[0]
    : params.invite;
  return (
    <AuthPage
      mode="signup"
      redirectTo={safeRedirect(params.next)}
      inviteCode={invite}
    />
  );
}
