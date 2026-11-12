import type { Metadata } from "next";
import { RequireAdmin } from "../../../components/ProtectedAccount";
import { WorkspaceView } from "../../../views/WorkspaceView";

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export default function WorkspacePage() {
  return (
    <RequireAdmin>
      <WorkspaceView />
    </RequireAdmin>
  );
}
