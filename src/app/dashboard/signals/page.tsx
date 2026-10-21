import type { Metadata } from "next";
import { RequireAuth } from "../../../components/ProtectedAccount";
import { SignalsView } from "../../../views/SignalsView";

export const metadata: Metadata = {
  title: "Signals",
  robots: { index: false, follow: false },
};

export default function SignalsPage() {
  return (
    <RequireAuth>
      <SignalsView />
    </RequireAuth>
  );
}
