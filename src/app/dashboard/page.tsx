import type { Metadata } from "next";
import { ProtectedAccount } from "../../components/ProtectedAccount";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default function DashboardPage() {
  return <ProtectedAccount />;
}
