import type { Metadata } from "next";
import { AuthPage } from "../../views/AuthPage";
import { safeRedirect } from "../../services/redirect";

export const metadata: Metadata = {
  title: "Welcome back",
  description: "Sign in to your Prime Edge Football workspace.",
  robots: { index: false, follow: true },
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  return <AuthPage mode="login" redirectTo={safeRedirect(params.next)} />;
}
