// Route: /app/documents — Module M0.5 document store.
// A general "unlinked documents" view + storage adapter status. The real power is
// the reusable <DocumentPanel/> embedded per-entity by later modules.
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FolderArchive } from "lucide-react";

import { DocumentPanel } from "@/features/documents/components/DocumentPanel";
import { StorageAdapterStatus } from "@/features/documents/components/StorageAdapterStatus";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/app/documents/")({
  head: () => ({
    meta: [
      { title: "Documents — Al Hamra TAS" },
      { name: "description", content: "Document store with SharePoint and Supabase Storage." },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { t } = useTranslation();
  const { currentUserId } = useAuth();

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <FolderArchive className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("documents.page.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("documents.page.subtitle")}</p>
        </div>
      </header>

      <StorageAdapterStatus />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">{t("documents.page.unlinked")}</h2>
        <DocumentPanel entityType={null} entityRef={null} currentUserId={currentUserId} />
      </section>
    </div>
  );
}
