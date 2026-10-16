import type { Metadata } from "next";
import { RequireAuth } from "../../../components/ProtectedAccount";
import { TelegramAccountsView } from "../../../views/TelegramAccountsView";

export const metadata: Metadata = {
  title: "Telegram Accounts",
  robots: { index: false, follow: false },
};

export default function TelegramAccountsPage() {
  return (
    <RequireAuth>
      <TelegramAccountsView />
    </RequireAuth>
  );
}
