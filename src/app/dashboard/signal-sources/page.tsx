import type { Metadata } from "next";
import { RequireSuperAdmin } from "../../../components/ProtectedAccount";
import { SignalSourcesView } from "../../../views/SignalSourcesView";

export const metadata: Metadata = {
  title: "Signal Sources",
  robots: { index: false, follow: false },
};

export default function SignalSourcesPage() {
  return (
    <RequireSuperAdmin>
      <SignalSourcesView />
    </RequireSuperAdmin>
  );
}
