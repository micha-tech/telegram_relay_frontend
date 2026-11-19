import type { Metadata } from "next";
import { RequireSuperAdmin } from "../../../components/ProtectedAccount";
import { SignalTemplatesView } from "../../../views/SignalTemplatesView";

export const metadata: Metadata = {
  title: "Signal Templates",
  robots: { index: false, follow: false },
};

export default function SignalTemplatesPage() {
  return (
    <RequireSuperAdmin>
      <SignalTemplatesView />
    </RequireSuperAdmin>
  );
}
