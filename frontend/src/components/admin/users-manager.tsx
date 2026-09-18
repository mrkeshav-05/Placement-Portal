"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Edit3,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { PortalDialog } from "@/components/common/portal-dialog";
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/common/data-table";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createUserAction,
  deleteUserAction,
  setUserPasswordAction,
  updateUserDetailsAction,
  updateUserPermissionsAction,
  updateUserRoleAction,
  updateUserStatusAction,
  type UserActionResult,
} from "@/app/admin/users/actions";
import {
  PERMISSION_DEFINITIONS,
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_METADATA,
  type PermissionKey,
} from "@/lib/permissions";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Role choices, highest tier first, derived from ROLE_METADATA so a role added
 * there cannot go missing from these dropdowns.
 */
const ROLE_OPTIONS = (Object.entries(ROLE_METADATA) as [Role, (typeof ROLE_METADATA)[Role]][])
  .sort(([, a], [, b]) => b.tier - a.tier)
  .map(([value, meta]) => ({
    value,
    label: meta.label,
    description: meta.description,
  }));

export type AdminUserListItem = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: Role;
  title: string | null;
  isActive: boolean;
  rollNumber: string | null;
  branch: string | null;
  batch: number | null;
  customPermissions: string[];
  effectivePermissions: string[];
  applicationCount: number;
  createdAt: string;
};

export function UsersManager({
  users,
  currentUserId,
}: {
  users: AdminUserListItem[];
  currentUserId: string;
}) {
  const router = useRouter();


  const [result, setResult] = useState<UserActionResult>({});
  const [saving, setSaving] = useState(false);

  // Modals state
  const [addingUser, setAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<AdminUserListItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("STUDENT");
  const [selectedTitle, setSelectedTitle] = useState("");

  const [permModalUser, setPermModalUser] = useState<AdminUserListItem | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);

  const [deletingUser, setDeletingUser] = useState<AdminUserListItem | null>(null);

  const [passwordModalUser, setPasswordModalUser] = useState<AdminUserListItem | null>(null);

  // Metrics
  const stats = useMemo(() => {
    let superAdmins = 0;
    let placementTeam = 0;
    let placementVolunteers = 0;
    let students = 0;
    let inactive = 0;

    for (const u of users) {
      if (!u.isActive) inactive++;
      if (u.role === "SUPER_ADMIN") superAdmins++;
      else if (u.role === "PLACEMENT_TEAM") placementTeam++;
      else if (u.role === "PLACEMENT_VOLUNTEER") placementVolunteers++;
      else students++;
    }

    return {
      total: users.length,
      superAdmins,
      placementTeam,
      placementVolunteers,
      students,
      inactive,
    };
  }, [users]);

  // Filtered visible list
  const branchOptions = useMemo(
    () => [...new Set(users.map((u) => u.branch).filter((b): b is string => Boolean(b)))].sort(),
    [users],
  );

  // Permission Categories
  const categories = useMemo(() => {
    const map = new Map<string, typeof PERMISSION_DEFINITIONS>();
    for (const def of PERMISSION_DEFINITIONS) {
      if (!map.has(def.category)) {
        map.set(def.category, []);
      }
      map.get(def.category)!.push(def);
    }
    return Array.from(map.entries());
  }, []);

  // Handlers
  async function handleCreateUser(formData: FormData) {
    setSaving(true);
    const res = await createUserAction(formData);
    setResult(res);
    setSaving(false);
    if (res.success) {
      setAddingUser(false);
      router.refresh();
    }
  }

  async function handleUpdateRole(formData: FormData) {
    setSaving(true);
    const res = await updateUserRoleAction(formData);
    setResult(res);
    setSaving(false);
    if (res.success) {
      setRoleModalUser(null);
      router.refresh();
    }
  }

  async function handleUpdatePermissions() {
    if (!permModalUser) return;
    setSaving(true);
    const res = await updateUserPermissionsAction(permModalUser.id, editingPermissions);
    setResult(res);
    setSaving(false);
    if (res.success) {
      setPermModalUser(null);
      router.refresh();
    }
  }

  async function handleUpdateDetails(formData: FormData) {
    setSaving(true);
    const res = await updateUserDetailsAction(formData);
    setResult(res);
    setSaving(false);
    if (res.success) {
      setEditingUser(null);
      router.refresh();
    }
  }

  async function handleToggleStatus(user: AdminUserListItem) {
    const res = await updateUserStatusAction(user.id, !user.isActive);
    setResult(res);
    if (res.success) {
      router.refresh();
    }
  }

  async function handleSetPassword(formData: FormData) {
    setSaving(true);
    const res = await setUserPasswordAction(formData);
    setResult(res);
    setSaving(false);
    if (res.success) {
      setPasswordModalUser(null);
      router.refresh();
    }
  }

  async function handleDeleteUser(formData: FormData) {
    setSaving(true);
    const res = await deleteUserAction(formData);
    setResult(res);
    setSaving(false);
    if (res.success) {
      setDeletingUser(null);
      router.refresh();
    }
  }

  function openRoleModal(user: AdminUserListItem) {
    setRoleModalUser(user);
    setSelectedRole(user.role);
    setSelectedTitle(user.title ?? "");
    setResult({});
  }

  function openPermModal(user: AdminUserListItem) {
    setPermModalUser(user);
    setEditingPermissions([...user.customPermissions]);
    setResult({});
  }

  function togglePermissionOverride(permKey: PermissionKey, defaultInRole: boolean) {
    setEditingPermissions((current) => {
      const isExplicitlyGranted = current.includes(permKey);
      const isExplicitlyRevoked = current.includes(`-${permKey}`);

      if (defaultInRole) {
        // Default is granted in role: toggle between neutral (inherited granted) and explicitly revoked (-permKey)
        if (isExplicitlyRevoked) {
          return current.filter((p) => p !== `-${permKey}`);
        } else {
          return [...current.filter((p) => p !== permKey), `-${permKey}`];
        }
      } else {
        // Default is not in role: toggle between neutral (not granted) and explicitly granted (+permKey)
        if (isExplicitlyGranted) {
          return current.filter((p) => p !== permKey);
        } else {
          return [...current.filter((p) => p !== `-${permKey}`), permKey];
        }
      }
    });
  }

  function getAvatarInitials(name: string | null, email: string | null) {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "U";
  }

  const columns = useMemo<DataTableColumn<AdminUserListItem>[]>(
    () => [
      {
        id: "user",
        header: "User & title",
        width: "230px",
        hideable: false,
        sortValue: (u) => u.name ?? u.email,
        cell: (u) => {
          const roleMeta = ROLE_METADATA[u.role] ?? ROLE_METADATA.STUDENT;
          return (
            <div className="company-admin-name">
              <span
                className={`user-avatar-initials ${roleMeta.badgeClass}`}
                title={`${roleMeta.label} · Tier ${roleMeta.tier}`}
              >
                {getAvatarInitials(u.name, u.email)}
              </span>
              <span>
                <strong>
                  {u.name || "No name registered"}
                  {u.id === currentUserId && (
                    <small className="inline ml-1 text-[var(--blue)] font-bold">(You)</small>
                  )}
                </strong>
                <small>{u.email || "No email"}</small>
                {u.title && (
                  <span className="text-[10px] font-semibold text-[var(--navy)] block mt-0.5">
                    {u.title}
                  </span>
                )}
              </span>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Role & tier",
        width: "150px",
        // Ordered by tier so a sort walks the hierarchy rather than the
        // alphabet: a super administrator is not "before" a coordinator.
        sortValue: (u) => (ROLE_METADATA[u.role] ?? ROLE_METADATA.STUDENT).tier,
        cell: (u) => {
          const roleMeta = ROLE_METADATA[u.role] ?? ROLE_METADATA.STUDENT;
          return (
            <div>
              <span className={`cell-status ${roleMeta.badgeClass}`}>{roleMeta.label}</span>
              <small className="block text-[9.5px] text-[var(--muted)] mt-1">
                Tier {roleMeta.tier} access
              </small>
            </div>
          );
        },
      },
      {
        id: "academic",
        header: "Academic profile",
        width: "160px",
        sortValue: (u) => u.rollNumber,
        cell: (u) => (
          <div>
            <span>{u.rollNumber || "Roll not assigned"}</span>
            <small className="block text-[9.5px] text-[var(--muted)]">
              {u.branch || "General"}
              {u.batch ? ` · Batch of ${u.batch}` : ""}
              {u.applicationCount > 0 ? ` · ${u.applicationCount} apps` : ""}
            </small>
          </div>
        ),
      },
      {
        id: "permissions",
        header: "Permissions",
        width: "170px",
        sortValue: (u) => u.customPermissions.length,
        cell: (u) => (
          <button
            type="button"
            onClick={() => openPermModal(u)}
            className="permission-pill hover:border-[var(--blue)] cursor-pointer"
            title="Click to view & edit granular permissions"
          >
            <KeyRound size={11} />
            {u.customPermissions.length > 0 ? (
              <span className="text-[var(--blue)] font-bold">
                {u.customPermissions.length} custom override(s)
              </span>
            ) : (
              <span>Role defaults ({u.effectivePermissions.length})</span>
            )}
          </button>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "120px",
        sortValue: (u) => u.isActive,
        cell: (u) => {
          const isSelf = u.id === currentUserId;
          return (
            <button
              type="button"
              onClick={() => handleToggleStatus(u)}
              disabled={isSelf && u.isActive}
              className={`cell-status cursor-pointer ${u.isActive ? "" : "pending"}`}
              title={
                isSelf
                  ? "Cannot deactivate your own account"
                  : `Click to ${u.isActive ? "suspend" : "activate"} user`
              }
            >
              {u.isActive ? "Active" : "Suspended"}
            </button>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        width: "190px",
        hideable: false,
        cell: (u) => {
          const isSelf = u.id === currentUserId;
          return (
            <div className="row-actions">
              <button
                title={`Change role / Elevate ${u.name || u.email}`}
                onClick={() => openRoleModal(u)}
                aria-label="Elevate or change role"
              >
                <UserCog size={14} />
              </button>

              <button
                title={`Configure permissions for ${u.name || u.email}`}
                onClick={() => openPermModal(u)}
                aria-label="Configure permissions"
              >
                <KeyRound size={14} />
              </button>

              <button
                title={`Set a sign-in password for ${u.name || u.email}`}
                onClick={() => {
                  setResult({});
                  setPasswordModalUser(u);
                }}
                aria-label="Set sign-in password"
              >
                <LockKeyhole size={14} />
              </button>

              <button
                title={`Edit details for ${u.name || u.email}`}
                onClick={() => {
                  setResult({});
                  setEditingUser(u);
                }}
                aria-label="Edit user details"
              >
                <Edit3 size={14} />
              </button>

              <button
                title={isSelf ? "Cannot delete your own account" : `Delete user ${u.name || u.email}`}
                disabled={isSelf}
                onClick={() => {
                  setResult({});
                  setDeletingUser(u);
                }}
                aria-label="Delete user"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId],
  );

  const filters = useMemo<DataTableFilter<AdminUserListItem>[]>(
    () => [
      {
        id: "role",
        label: "Role",
        options: ROLE_OPTIONS.map(({ value, label }) => ({ value, label })),
        value: (u) => u.role,
      },
      {
        id: "status",
        label: "Status",
        options: [
          { value: "ACTIVE", label: "Active only" },
          { value: "INACTIVE", label: "Suspended only" },
        ],
        value: (u) => (u.isActive ? "ACTIVE" : "INACTIVE"),
      },
      {
        id: "branch",
        label: "Branch",
        options: branchOptions.map((branch) => ({ value: branch, label: branch })),
        value: (u) => u.branch,
      },
    ],
    [branchOptions],
  );

  return (
    <div className="admin-page">
      {/* Heading */}
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Access Control & Directory</span>
          <h1>User Management & RBAC</h1>
          <p>
            Configure user roles, elevate permissions, customize per-user access rights, and manage accounts.
          </p>
        </div>
        <button
          onClick={() => {
            setResult({});
            setAddingUser(true);
          }}
        >
          <UserPlus size={16} />
          Add / Provision User
        </button>
      </section>

      {/* Action Results */}
      {result.success && <Alert variant="success" className="mt-4"><AlertDescription>{result.success}</AlertDescription></Alert>}
      {result.error && <Alert variant="destructive" className="mt-4"><AlertDescription>{result.error}</AlertDescription></Alert>}

      {/* Summary Metrics */}
      <section className="admin-metrics">
        <article>
          <div className="metric-icon">
            <Users />
          </div>
          <div>
            <small>Total Users</small>
            <strong>{stats.total}</strong>
            <b>Active directory accounts</b>
          </div>
        </article>

        <article>
          <div className="metric-icon violet">
            <ShieldCheck />
          </div>
          <div>
            <small>Super Admins</small>
            <strong>{stats.superAdmins}</strong>
            <b>Full access, including RBAC</b>
          </div>
        </article>

        <article>
          <div className="metric-icon">
            <UserCheck />
          </div>
          <div>
            <small>Placement Cell</small>
            <strong>{stats.placementTeam + stats.placementVolunteers}</strong>
            <b>{stats.placementTeam} team · {stats.placementVolunteers} volunteers</b>
          </div>
        </article>

        <article>
          <div className="metric-icon">
            <UserX />
          </div>
          <div>
            <small>Students & Suspended</small>
            <strong>{stats.students}</strong>
            <b>{stats.inactive} suspended account(s)</b>
          </div>
        </article>
      </section>

      <DataTable
        title="Portal Users"
        data={users}
        columns={columns}
        filters={filters}
        getRowId={(u) => u.id}
        searchText={(u) =>
          `${u.name ?? ""} ${u.email ?? ""} ${u.rollNumber ?? ""} ${u.title ?? ""} ${u.branch ?? ""}`
        }
        searchPlaceholder="Search name, email, roll number, title, or branch"
        columnStorageKey="users"
        minWidth={1150}
        emptyIcon={<Users />}
        emptyTitle={users.length ? "No matching users" : "No users found"}
        emptyDescription={
          users.length
            ? "Try adjusting your search query or role filter."
            : "Students appear once they register; staff accounts are created here."
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Add / Pre-provision User */}
      {/* ------------------------------------------------------------- */}
      {addingUser && (
        <PortalDialog
          onClose={() => setAddingUser(false)}
          eyebrow="Directory Provisioning"
          title="Add / Provision User Account"
          className="sm:max-w-[650px]"
        >
          <form className="grid gap-3" action={handleCreateUser}>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="new-user-email">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-user-email"
                  name="email"
                  type="email"
                  required
                  placeholder="student@iiitl.ac.in or external-admin@example.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-user-name">Full Name</Label>
                <Input id="new-user-name" name="name" placeholder="Tarun Sharma" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-user-role">
                  Assigned Role <span className="text-destructive">*</span>
                </Label>
                <Select name="role" defaultValue="STUDENT">
                  <SelectTrigger id="new-user-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-user-title">Designation / Title</Label>
                <Input
                  id="new-user-title"
                  name="title"
                  placeholder="e.g. Lead Coordinator, Officer"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-user-roll">Roll Number</Label>
                <Input id="new-user-roll" name="rollNumber" placeholder="e.g. LCI2022001" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-user-branch">Academic Branch</Label>
                <Input
                  id="new-user-branch"
                  name="branch"
                  placeholder="e.g. Computer Science & AI"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-user-batch">Graduation Batch</Label>
                <Input
                  id="new-user-batch"
                  name="batch"
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="2026"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddingUser(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Provisioning…" : "Provision User"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Elevate / Change Role */}
      {/* ------------------------------------------------------------- */}
      {roleModalUser && (
        <PortalDialog
          onClose={() => setRoleModalUser(null)}
          eyebrow="Role Elevation & Management"
          title="Elevate / Change Role"
          className="sm:max-w-[650px]"
        >
          <form className="grid gap-3" action={handleUpdateRole}>
            <input type="hidden" name="userId" value={roleModalUser.id} />

            <div className="bg-muted rounded-xl border p-3">
              <strong>{roleModalUser.name || "Unnamed User"}</strong>
              <small className="text-muted-foreground block">{roleModalUser.email}</small>
              <div className="mt-2 text-[11px]">
                Current Role:{" "}
                <span className={`cell-status ${ROLE_METADATA[roleModalUser.role].badgeClass}`}>
                  {ROLE_METADATA[roleModalUser.role].label}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role-modal-role">
                Select New Role <span className="text-destructive">*</span>
              </Label>
              <Select
                name="role"
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as Role)}
              >
                <SelectTrigger id="role-modal-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(({ value, label, description }) => (
                    <SelectItem key={value} value={value}>
                      {label} — {description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="role-modal-title">Designation / Title</Label>
              <Input
                id="role-modal-title"
                name="title"
                value={selectedTitle}
                onChange={(e) => setSelectedTitle(e.target.value)}
                placeholder="e.g. Placement Coordinator, Senior Officer"
              />
            </div>

            <div className="bg-muted rounded-xl border p-3 text-xs">
              <p className="mb-1 font-bold">
                {ROLE_METADATA[selectedRole].label} Capabilities:
              </p>
              <p className="text-muted-foreground mb-2">
                {ROLE_METADATA[selectedRole].description}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ROLE_DEFAULT_PERMISSIONS[selectedRole].map((p) => (
                  <span key={p} className="permission-pill text-[9.5px]">
                    <Check size={10} className="text-[var(--green)]" />
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {roleModalUser.id === currentUserId &&
              (selectedRole === "STUDENT" || selectedRole === "PLACEMENT_VOLUNTEER") && (
                <Alert variant="destructive">
                  <ShieldAlert />
                  <AlertDescription>
                    Warning: You are demoting your own account. You may lose access to this
                    admin panel.
                  </AlertDescription>
                </Alert>
              )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRoleModalUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Updating Role…" : "Save Role Elevation"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Custom Permissions Matrix Editor */}
      {/* ------------------------------------------------------------- */}
      {permModalUser && (
        <PortalDialog
          onClose={() => setPermModalUser(null)}
          eyebrow="Granular RBAC"
          title="Custom Permissions Matrix"
          className="permission-matrix-modal max-h-[88vh] overflow-y-auto sm:max-w-[940px]"
        >
          <div className="bg-muted flex items-center justify-between rounded-xl border p-3">
            <div>
              <strong>{permModalUser.name || "User"}</strong>
              <small className="text-muted-foreground block">{permModalUser.email}</small>
            </div>
            <div className="text-right">
              <span className={`cell-status ${ROLE_METADATA[permModalUser.role].badgeClass}`}>
                {ROLE_METADATA[permModalUser.role].label}
              </span>
              <small className="text-muted-foreground mt-1 block text-[9.5px]">
                Base Role Defaults
              </small>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Configure fine-grained permissions specifically for this user. You can grant privileges
            beyond their role tier, or explicitly revoke default privileges.
          </p>

          <div className="permission-categories-grid">
            {categories.map(([catName, defs]) => (
              <div className="permission-category-box" key={catName}>
                <h3>{catName}</h3>

                {defs.map((def) => {
                  const defaultInRole = (
                    ROLE_DEFAULT_PERMISSIONS[permModalUser.role] as readonly PermissionKey[]
                  ).includes(def.key);

                  const isExplicitlyGranted = editingPermissions.includes(def.key);
                  const isExplicitlyRevoked = editingPermissions.includes(`-${def.key}`);

                  const effectiveActive =
                    (defaultInRole && !isExplicitlyRevoked) || isExplicitlyGranted;

                  return (
                    <div className="permission-item-row" key={def.key}>
                      <div className="permission-item-info">
                        <strong>{def.label}</strong>
                        <small>{def.description}</small>
                      </div>

                      <div className="permission-toggle-control">
                        {defaultInRole ? (
                          isExplicitlyRevoked ? (
                            <span className="permission-pill custom-revoked">Revoked</span>
                          ) : (
                            <span className="inherited-tag">In Role</span>
                          )
                        ) : isExplicitlyGranted ? (
                          <span className="permission-pill custom-granted">Granted</span>
                        ) : null}

                        <Button
                          type="button"
                          size="xs"
                          variant={effectiveActive ? "default" : "outline"}
                          onClick={() => togglePermissionOverride(def.key, defaultInRole)}
                          title={`Toggle ${def.label}`}
                        >
                          {effectiveActive ? "Active" : "Off"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPermModalUser(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdatePermissions} disabled={saving}>
              {saving ? "Saving Matrix…" : "Save Permissions Matrix"}
            </Button>
          </DialogFooter>
        </PortalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Edit User Details */}
      {/* ------------------------------------------------------------- */}
      {editingUser && (
        <PortalDialog
          onClose={() => setEditingUser(null)}
          eyebrow="User Details"
          title="Edit Account Info"
          className="sm:max-w-[650px]"
        >
          <form className="grid gap-3" action={handleUpdateDetails}>
            <input type="hidden" name="userId" value={editingUser.id} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="edit-user-name">Full Name</Label>
                <Input
                  id="edit-user-name"
                  name="name"
                  defaultValue={editingUser.name ?? ""}
                  placeholder="Student or Staff Name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-user-title">Designation / Title</Label>
                <Input
                  id="edit-user-title"
                  name="title"
                  defaultValue={editingUser.title ?? ""}
                  placeholder="e.g. Lead Coordinator"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-user-roll">Roll Number</Label>
                <Input
                  id="edit-user-roll"
                  name="rollNumber"
                  defaultValue={editingUser.rollNumber ?? ""}
                  placeholder="e.g. LCI2022001"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-user-branch">Branch</Label>
                <Input
                  id="edit-user-branch"
                  name="branch"
                  defaultValue={editingUser.branch ?? ""}
                  placeholder="e.g. Computer Science"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-user-batch">Batch</Label>
                <Input
                  id="edit-user-batch"
                  name="batch"
                  type="number"
                  defaultValue={editingUser.batch ?? ""}
                  placeholder="2026"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Set Sign-in Password */}
      {/* ------------------------------------------------------------- */}
      {passwordModalUser && (
        <PortalDialog
          onClose={() => setPasswordModalUser(null)}
          eyebrow="Sign-in password"
          title={passwordModalUser.name || passwordModalUser.email}
          className="sm:max-w-[520px]"
        >
          <form className="grid gap-3" action={handleSetPassword}>
            <input type="hidden" name="userId" value={passwordModalUser.id} />

            <p className="text-muted-foreground text-xs leading-relaxed">
              This replaces any password on the account. Share it over a channel you trust and
              ask them to change it at Account → Password. Use this to give a new staff member
              their first password, or to recover an account whose password was lost.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="set-password">New password</Label>
                <Input
                  id="set-password"
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="set-password-confirm">Confirm password</Label>
                <Input
                  id="set-password-confirm"
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPasswordModalUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Delete User Confirmation */}
      {/* ------------------------------------------------------------- */}
      {deletingUser && (
        <PortalDialog
          onClose={() => setDeletingUser(null)}
          eyebrow={<span className="text-[var(--badge-red-text)]">Danger Zone</span>}
          title="Delete User Account"
          className="sm:max-w-[520px]"
        >
          <form className="grid gap-3" action={handleDeleteUser}>
            <input type="hidden" name="userId" value={deletingUser.id} />

            <div className="rounded-xl border border-[var(--badge-red-text)] bg-[var(--badge-red-bg)] p-4 text-xs leading-relaxed text-[var(--badge-red-text)]">
              <p className="mb-1 font-bold">Are you sure you want to delete this account?</p>
              <p>
                <strong>{deletingUser.name || "User"}</strong> ({deletingUser.email}) with role{" "}
                <strong>{deletingUser.role}</strong> will be permanently removed.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeletingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={saving}>
                {saving ? "Deleting…" : "Confirm Delete User"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}
    </div>
  );
}
