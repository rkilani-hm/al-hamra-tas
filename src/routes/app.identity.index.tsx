// Route: /app/identity  — Module M0.1 Identity & Access landing page.
// Renders the user list plus role-matrix / scope / delegation surfaces.

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assignRoles,
  createDelegation,
  listPermissions,
  listRolePermissions,
  listRoles,
  listUsers,
  setScope,
} from "@/features/identity/api";
import { UserTable } from "@/features/identity/components/UserTable";
import { RolePermissionMatrix } from "@/features/identity/components/RolePermissionMatrix";
import { ScopeDrawer } from "@/features/identity/components/ScopeDrawer";
import { DelegationModal } from "@/features/identity/components/DelegationModal";
import type {
  CreateDelegationInput,
  SetScopeInput,
  UserWithAccess,
} from "@/features/identity/types";

export const Route = createFileRoute("/app/identity/")({
  head: () => ({
    meta: [
      { title: "Identity & Access — Al Hamra TAS" },
      { name: "description", content: "Manage users, roles, scope and delegations." },
    ],
  }),
  component: IdentityPage,
});

// Query helper: resolve to [] on error so the M0.1 RLS scaffold (which limits
// authenticated reads) degrades to empty states instead of crashing the page.
function safe<T>(fn: () => Promise<T[]>): () => Promise<T[]> {
  return async () => {
    try {
      return await fn();
    } catch (err) {
      console.warn("[identity] query failed (showing empty):", err);
      return [];
    }
  };
}

function IdentityPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const usersQuery = useQuery({ queryKey: ["identity", "users"], queryFn: safe(listUsers) });
  const rolesQuery = useQuery({ queryKey: ["identity", "roles"], queryFn: safe(listRoles) });
  const permsQuery = useQuery({ queryKey: ["identity", "permissions"], queryFn: safe(listPermissions) });
  const rolePermsQuery = useQuery({
    queryKey: ["identity", "role-permissions"],
    queryFn: safe(listRolePermissions),
  });

  const users = usersQuery.data ?? [];

  // Matrix state
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  // Scope drawer state
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeUser, setScopeUser] = useState<UserWithAccess | null>(null);
  const [savingScope, setSavingScope] = useState(false);

  // Delegation modal state
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [delegator, setDelegator] = useState<UserWithAccess | null>(null);
  const [savingDelegation, setSavingDelegation] = useState(false);

  // --- Actions --------------------------------------------------------------

  const handleAssignRoles = (_user: UserWithAccess) => {
    // M0.1: assigning roles per-user is surfaced via the matrix; full per-user
    // role editing UI lands with M3.1. For now open the matrix to review grants.
    void _user;
    setMatrixOpen(true);
  };

  const handleEditScope = (user: UserWithAccess) => {
    setScopeUser(user);
    setScopeOpen(true);
  };

  const handleDelegate = (user: UserWithAccess) => {
    setDelegator(user);
    setDelegationOpen(true);
  };

  const handleSaveScope = async (input: SetScopeInput) => {
    setSavingScope(true);
    try {
      await setScope(input);
      toast.success(t("identity.toasts.scopeSaved"));
      setScopeOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["identity", "users"] });
    } catch (err) {
      console.error(err);
      toast.error(t("identity.toasts.scopeError"));
    } finally {
      setSavingScope(false);
    }
  };

  const handleConfirmDelegation = async (input: CreateDelegationInput) => {
    setSavingDelegation(true);
    try {
      await createDelegation(input);
      toast.success(t("identity.toasts.delegationCreated"));
      setDelegationOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(t("identity.toasts.delegationError"));
    } finally {
      setSavingDelegation(false);
    }
  };

  // Keep `assignRoles` referenced for the future per-user editor (M3.1).
  void assignRoles;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {t("identity.page.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("identity.page.subtitle")}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setMatrixOpen(true)}>
          {t("identity.actions.viewMatrix")}
        </Button>
      </header>

      <UserTable
        users={users}
        loading={usersQuery.isLoading}
        onAssignRoles={handleAssignRoles}
        onEditScope={handleEditScope}
        onDelegate={handleDelegate}
      />

      {/* Role / permission matrix */}
      <Dialog open={matrixOpen} onOpenChange={setMatrixOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("identity.matrix.title")}</DialogTitle>
            <DialogDescription>{t("identity.matrix.subtitle")}</DialogDescription>
          </DialogHeader>
          <RolePermissionMatrix
            roles={rolesQuery.data ?? []}
            permissions={permsQuery.data ?? []}
            rolePermissions={rolePermsQuery.data ?? []}
            selectedRoleId={selectedRoleId}
            onSelectRole={setSelectedRoleId}
          />
        </DialogContent>
      </Dialog>

      {/* Scope drawer — entities/branches/departments arrive with M0.2 org master data */}
      <ScopeDrawer
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        user={scopeUser}
        entities={[]}
        branches={[]}
        departments={[]}
        onSave={handleSaveScope}
        saving={savingScope}
      />

      {/* Delegation modal */}
      <DelegationModal
        open={delegationOpen}
        onOpenChange={setDelegationOpen}
        delegator={delegator}
        candidates={users}
        onConfirm={handleConfirmDelegation}
        saving={savingDelegation}
      />
    </div>
  );
}
