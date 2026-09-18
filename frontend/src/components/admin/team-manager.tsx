"use client";

import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  Edit3,
  GraduationCap,
  Info,
  Mail,
  Phone,
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Role } from "@prisma/client";
import {
  createTeamMemberAction,
  deleteTeamMemberAction,
  reorderTeamMembersAction,
  updateDefaultPermissionsAction,
  updateTeamMemberAction,
  type TeamActionResult,
} from "@/app/admin/team/actions";
import { PortalDialog } from "@/components/common/portal-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PLACEMENT_TEAM_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  ROLE_METADATA,
} from "@/lib/permissions";

export type AdminTeamMemberItem = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  displayOrder: number;
  userId?: string | null;
  hasUserAccount: boolean;
  userRole?: string | null;
  userActive?: boolean | null;
  userCustomPermissions: string[];
};

export type AdminUserLookup = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  customPermissions: string[];
};

export function TeamManager({
  members,
  defaultPermissions,
  allUsers = [],
}: {
  members: AdminTeamMemberItem[];
  defaultPermissions: string[];
  allUsers?: AdminUserLookup[];
}) {
  const router = useRouter();

  const [tabFilter, setTabFilter] = useState<"ALL" | "FACULTY" | "COORDINATORS" | "LINKED">("ALL");

  const [result, setResult] = useState<TeamActionResult>({});
  const [saving, setSaving] = useState(false);

  // Modals state
  const [addingMember, setAddingMember] = useState(false);
  const [editingMember, setEditingMember] = useState<AdminTeamMemberItem | null>(null);
  const [deletingMember, setDeletingMember] = useState<AdminTeamMemberItem | null>(null);

  // Default permissions modal state
  const [configuringPermissions, setConfiguringPermissions] = useState(false);
  const [selectedDefaultPerms, setSelectedDefaultPerms] = useState<string[]>(defaultPermissions);
  const [syncExisting, setSyncExisting] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);

  // Metrics
  const metrics = useMemo(() => {
    const total = members.length;
    const coordinators = members.filter((m) =>
      m.role.toLowerCase().includes("coordinator") || m.role.toLowerCase().includes("student")
    ).length;
    const faculty = total - coordinators;
    const linked = members.filter((m) => m.hasUserAccount).length;
    return { total, faculty, coordinators, linked };
  }, [members]);

  // Filtered members
  const tabMembers = useMemo(
    () =>
      members.filter((m) => {
        if (tabFilter === "COORDINATORS") {
          return (
            m.role.toLowerCase().includes("coordinator") ||
            m.role.toLowerCase().includes("student")
          );
        }
        if (tabFilter === "FACULTY") {
          return (
            !m.role.toLowerCase().includes("coordinator") &&
            !m.role.toLowerCase().includes("student")
          );
        }
        if (tabFilter === "LINKED") {
          return m.hasUserAccount;
        }
        return true;
      }),
    [members, tabFilter],
  );

  // The rows on screen, which the reorder arrows swap between. Manual order
  // is the point of this table, so it is neither sortable nor paginated and
  // what is displayed always matches this list.
  const [visibleMembers, setVisibleMembers] = useState<AdminTeamMemberItem[]>(members);

  // Open add modal
  function openAddModal() {
    setFormName("");
    setFormRole("");
    setFormEmail("");
    setFormPhone("");
    setFormPhotoUrl("");
    const maxOrder = members.reduce((max, m) => Math.max(max, m.displayOrder), 0);
    setFormDisplayOrder(maxOrder + 1);
    setAddingMember(true);
    setResult({});
  }

  // Open edit modal
  function openEditModal(m: AdminTeamMemberItem) {
    setFormName(m.name);
    setFormRole(m.role);
    setFormEmail(m.email || "");
    setFormPhone(m.phone || "");
    setFormPhotoUrl(m.photoUrl || "");
    setFormDisplayOrder(m.displayOrder);
    setEditingMember(m);
    setResult({});
  }

  // Open permissions config modal
  function openPermissionsModal() {
    setSelectedDefaultPerms([...defaultPermissions]);
    setSyncExisting(false);
    setConfiguringPermissions(true);
    setResult({});
  }

  // Handle Add Submit
  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult({});

    const formData = new FormData();
    formData.append("name", formName);
    formData.append("role", formRole);
    formData.append("email", formEmail);
    formData.append("phone", formPhone);
    formData.append("photoUrl", formPhotoUrl);
    formData.append("displayOrder", String(formDisplayOrder));

    const res = await createTeamMemberAction(formData);
    setSaving(false);
    setResult(res);
    if (res.success) {
      setAddingMember(false);
      router.refresh();
    }
  }

  // Handle Edit Submit
  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setSaving(true);
    setResult({});

    const formData = new FormData();
    formData.append("id", editingMember.id);
    formData.append("name", formName);
    formData.append("role", formRole);
    formData.append("email", formEmail);
    formData.append("phone", formPhone);
    formData.append("photoUrl", formPhotoUrl);
    formData.append("displayOrder", String(formDisplayOrder));

    const res = await updateTeamMemberAction(formData);
    setSaving(false);
    setResult(res);
    if (res.success) {
      setEditingMember(null);
      router.refresh();
    }
  }

  // Handle Delete Submit
  async function handleDeleteSubmit() {
    if (!deletingMember) return;
    setSaving(true);
    setResult({});

    const formData = new FormData();
    formData.append("id", deletingMember.id);

    const res = await deleteTeamMemberAction(formData);
    setSaving(false);
    setResult(res);
    if (res.success) {
      setDeletingMember(null);
      router.refresh();
    }
  }

  // Handle Default Permissions Save
  async function handleSaveDefaultPermissions() {
    setSaving(true);
    setResult({});

    const res = await updateDefaultPermissionsAction(selectedDefaultPerms, syncExisting);
    setSaving(false);
    setResult(res);
    if (res.success) {
      setConfiguringPermissions(false);
      router.refresh();
    }
  }

  // Reorder single member
  async function handleMove(index: number, direction: "UP" | "DOWN") {
    if (direction === "UP" && index === 0) return;
    if (direction === "DOWN" && index === visibleMembers.length - 1) return;

    const targetIndex = direction === "UP" ? index - 1 : index + 1;
    const currentItem = visibleMembers[index];
    const targetItem = visibleMembers[targetIndex];
    if (!currentItem || !targetItem) return;

    const newItems = [
      { id: currentItem.id, displayOrder: targetItem.displayOrder },
      { id: targetItem.id, displayOrder: currentItem.displayOrder },
    ];

    setSaving(true);
    const res = await reorderTeamMembersAction(newItems);
    setSaving(false);
    if (res.success) {
      router.refresh();
    } else {
      setResult(res);
    }
  }

  // Group permissions by category for modal
  const permissionsByCategory = useMemo(() => {
    const map = new Map<string, typeof PERMISSION_DEFINITIONS>();
    for (const def of PERMISSION_DEFINITIONS) {
      const list = map.get(def.category) || [];
      list.push(def);
      map.set(def.category, list);
    }
    return Array.from(map.entries());
  }, []);

  // No column declares a sortValue: the order of this table is the order the
  // team is published in, and the arrows below are how it changes.
  const columns = useMemo<DataTableColumn<AdminTeamMemberItem>[]>(
    () => [
      {
        id: "order",
        header: "Order",
        width: "84px",
        align: "center",
        hideable: false,
        cell: (member) => {
          const index = visibleMembers.findIndex((m) => m.id === member.id);
          return (
            <div className="flex items-center justify-center gap-1">
              <span className="font-mono text-xs font-bold text-[var(--muted)] w-5">
                {member.displayOrder}
              </span>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={saving || index <= 0}
                  onClick={() => handleMove(index, "UP")}
                  title="Move Up"
                  aria-label={`Move ${member.name} up`}
                  className="p-0.5 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-20"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  type="button"
                  disabled={saving || index === -1 || index === visibleMembers.length - 1}
                  onClick={() => handleMove(index, "DOWN")}
                  title="Move Down"
                  aria-label={`Move ${member.name} down`}
                  className="p-0.5 rounded hover:bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] disabled:opacity-20"
                >
                  <ArrowDown size={11} />
                </button>
              </div>
            </div>
          );
        },
      },
      {
        id: "member",
        header: "Member",
        width: "220px",
        hideable: false,
        cell: (member) => {
          const initials =
            member.name
              .split(" ")
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase() || "TM";
          const isCoordinator =
            member.role.toLowerCase().includes("coordinator") ||
            member.role.toLowerCase().includes("student");

          return (
            <div className="flex items-center gap-3">
              {member.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="w-9 h-9 rounded-full object-cover border border-[var(--border)]"
                />
              ) : (
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                    isCoordinator
                      ? "bg-[var(--blue)]/15 text-[var(--blue)]"
                      : "bg-[var(--orange)]/15 text-[var(--orange)]"
                  }`}
                >
                  {initials}
                </div>
              )}
              <div>
                <strong className="block text-sm text-[var(--ink)] font-bold">{member.name}</strong>
                <span className="text-[10px] text-[var(--muted)]">
                  ID: {member.id.startsWith("cuid_") ? member.id.slice(0, 10) + "..." : member.id}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Role / designation",
        width: "170px",
        cell: (member) => {
          const isCoordinator =
            member.role.toLowerCase().includes("coordinator") ||
            member.role.toLowerCase().includes("student");
          return (
            <span
              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                isCoordinator
                  ? "bg-[var(--badge-blue-bg)] text-[var(--badge-blue-text)]"
                  : "bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]"
              }`}
            >
              {member.role}
            </span>
          );
        },
      },
      {
        id: "contact",
        header: "Contact details",
        width: "200px",
        cell: (member) => (
          <div className="space-y-0.5 text-xs">
            {member.email ? (
              <a
                href={`mailto:${member.email}`}
                className="flex items-center gap-1.5 text-[var(--blue)] hover:underline font-medium"
              >
                <Mail size={12} />
                <span>{member.email}</span>
              </a>
            ) : (
              <span className="text-[var(--muted)] italic text-[11px]">No email specified</span>
            )}
            {member.phone && (
              <a
                href={`tel:${member.phone}`}
                className="flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--ink)] font-mono text-[11px]"
              >
                <Phone size={11} />
                <span>{member.phone}</span>
              </a>
            )}
          </div>
        ),
      },
      {
        id: "account",
        header: "User account & RBAC",
        width: "190px",
        cell: (member) =>
          member.hasUserAccount ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`cell-status ${
                    ROLE_METADATA[member.userRole as Role]?.badgeClass || "badge-student"
                  }`}
                >
                  {member.userRole || "STUDENT"}
                </span>
                {member.userActive === false && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--badge-red-bg)] text-[var(--badge-red-text)]">
                    Suspended
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--muted)] font-medium">
                  {member.userCustomPermissions.length} custom perms
                </span>
                <Link
                  href={`/admin/users?query=${encodeURIComponent(member.email || "")}`}
                  className="text-[10px] text-[var(--blue)] font-bold hover:underline"
                >
                  Edit in RBAC →
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--surface-alt)] text-[var(--muted)] border border-[var(--border)]">
                Not signed in yet
              </span>
              <small className="block text-[10px] text-[var(--muted)] mt-0.5">
                Perms auto-apply on login
              </small>
            </div>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        width: "110px",
        align: "right",
        hideable: false,
        cell: (member) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => openEditModal(member)}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--blue)] hover:bg-[var(--surface-alt)] transition-colors"
              title="Edit Member"
              aria-label={`Edit ${member.name}`}
            >
              <Edit3 size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDeletingMember(member);
                setResult({});
              }}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--badge-red-text)] hover:bg-[var(--badge-red-bg)] transition-colors"
              title="Remove Member"
              aria-label={`Remove ${member.name}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saving, visibleMembers],
  );

  return (
    <div className="admin-page">
      {/* Top Heading */}
      <section className="admin-heading">
        <div>
          <span className="eyebrow">Placement Cell &amp; Structure</span>
          <h1>Placement Team Directory &amp; Permissions</h1>
          <p>
            Manage the official placement team members, student coordinators, and configure automatic default RBAC permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={openPermissionsModal}>
            <ShieldCheck className="text-[var(--orange)]" />
            Default Permissions
            <Badge variant="secondary">{defaultPermissions.length}</Badge>
          </Button>
          <Button type="button" onClick={openAddModal}>
            <Plus />
            Add Team Member
          </Button>
        </div>
      </section>

      {/* Action status message */}
      {result.error && (
        <Alert variant="destructive" className="mt-4 mb-4">
          <AlertDescription className="flex w-full items-center justify-between text-current">
            <span>{result.error}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss this message"
              onClick={() => setResult({})}
            >
              <X />
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {result.success && (
        <Alert variant="success" className="mt-4 mb-4">
          <AlertDescription className="flex w-full items-center justify-between text-current">
            <span>{result.success}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Dismiss this message"
              onClick={() => setResult({})}
            >
              <X />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Banner */}
      <section className="admin-metrics">
        <article>
          <div className="metric-icon">
            <Users />
          </div>
          <div>
            <small>Total Team Members</small>
            <strong>{metrics.total}</strong>
            <b>Active in public portal</b>
          </div>
        </article>

        <article>
          <div className="metric-icon violet">
            <Building2 />
          </div>
          <div>
            <small>Faculty &amp; Officers</small>
            <strong>{metrics.faculty}</strong>
            <b>Leadership &amp; administration</b>
          </div>
        </article>

        <article>
          <div className="metric-icon">
            <GraduationCap />
          </div>
          <div>
            <small>Student Coordinators</small>
            <strong>{metrics.coordinators}</strong>
            <b>Drive &amp; event volunteers</b>
          </div>
        </article>

        <article>
          <div className="metric-icon green">
            <UserCheck />
          </div>
          <div>
            <small>Linked User Accounts</small>
            <strong>{metrics.linked}</strong>
            <b>Automated RBAC active</b>
          </div>
        </article>
      </section>

      {/* Filter and Search Bar */}
      <section className="admin-controls-card p-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] mb-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 w-full md:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setTabFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tabFilter === "ALL"
                ? "bg-[var(--navy)] text-white"
                : "bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            All Members ({members.length})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("FACULTY")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tabFilter === "FACULTY"
                ? "bg-[var(--navy)] text-white"
                : "bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Faculty &amp; Officers ({metrics.faculty})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("COORDINATORS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tabFilter === "COORDINATORS"
                ? "bg-[var(--navy)] text-white"
                : "bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Student Coordinators ({metrics.coordinators})
          </button>
          <button
            type="button"
            onClick={() => setTabFilter("LINKED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              tabFilter === "LINKED"
                ? "bg-[var(--navy)] text-white"
                : "bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--ink)]"
            }`}
          >
            Linked Accounts ({metrics.linked})
          </button>
        </div>

      </section>

      <DataTable
        title="Team Members"
        data={tabMembers}
        columns={columns}
        getRowId={(member) => member.id}
        searchText={(member) =>
          `${member.name} ${member.role} ${member.email ?? ""} ${member.phone ?? ""}`
        }
        searchPlaceholder="Search by name, role, email, phone..."
        columnStorageKey="team"
        pagination={false}
        minWidth={1020}
        onViewChange={(view) => setVisibleMembers(view.rows)}
        emptyIcon={<Users />}
        emptyTitle="No placement team members found."
        emptyDescription="Try adjusting your search, or use Add Team Member above to create one."
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Configure Default Placement Team Permissions          */}
      {/* ------------------------------------------------------------- */}
      {configuringPermissions && (
        <PortalDialog
          onClose={() => setConfiguringPermissions(false)}
          eyebrow={
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} /> Role-based access
            </span>
          }
          title="Default Placement Team Permissions"
          description="Set permissions automatically granted when a user is added to the placement team."
          className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        >
          <div className="grid gap-4 text-xs">
            {/* Informational Callout */}
            <Alert variant="info">
              <Info />
              <AlertDescription className="text-current">
                <p className="text-[11px] leading-relaxed">
                  When a user is added to the Placement Team, these default permissions are automatically granted to their account.
                  If removed, these permissions are automatically revoked. An administrator can still adjust or override any user&apos;s
                  permissions manually in <strong>User Management</strong>.
                </p>
              </AlertDescription>
            </Alert>

            {/* Quick Preset Buttons */}
            <div className="flex items-center justify-between gap-2 border-b pb-2">
              <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                Presets:
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setSelectedDefaultPerms([...DEFAULT_PLACEMENT_TEAM_PERMISSIONS])
                  }
                >
                  Coordinator Defaults
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setSelectedDefaultPerms(PERMISSION_DEFINITIONS.map((p) => p.key))
                  }
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setSelectedDefaultPerms([])}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Permissions Categories */}
            <div className="space-y-4">
              {permissionsByCategory.map(([category, perms]) => (
                <div key={category} className="space-y-2">
                  <h4 className="text-[11px] font-bold tracking-wider uppercase">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {perms.map((perm) => {
                      const isChecked = selectedDefaultPerms.includes(perm.key);
                      return (
                        <Label
                          key={perm.key}
                          htmlFor={`default-perm-${perm.key}`}
                          className={`items-start gap-2.5 rounded-xl border p-2.5 font-normal transition-all ${
                            isChecked
                              ? "border-[var(--blue)] bg-[var(--badge-blue-bg)]"
                              : "bg-muted hover:bg-accent"
                          }`}
                        >
                          <Checkbox
                            id={`default-perm-${perm.key}`}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              setSelectedDefaultPerms(
                                checked === true
                                  ? [...selectedDefaultPerms, perm.key]
                                  : selectedDefaultPerms.filter((k) => k !== perm.key),
                              )
                            }
                            className="mt-0.5"
                          />
                          <span className="grid gap-0.5">
                            <strong className="text-xs font-semibold">{perm.label}</strong>
                            <span className="text-muted-foreground text-[10px] leading-tight">
                              {perm.description}
                            </span>
                          </span>
                        </Label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Batch sync toggle */}
            <div className="border-t pt-3">
              <Label htmlFor="sync-existing" className="items-start gap-2.5 font-normal">
                <Checkbox
                  id="sync-existing"
                  checked={syncExisting}
                  onCheckedChange={(checked) => setSyncExisting(checked === true)}
                  className="mt-0.5"
                />
                <span className="grid gap-0.5">
                  <strong className="text-xs">
                    Apply and synchronize to all current placement team members now
                  </strong>
                  <span className="text-muted-foreground text-[10px]">
                    Updates the user accounts of all existing team members with this permission set.
                  </span>
                </span>
              </Label>
            </div>
          </div>

          <DialogFooter className="items-center sm:justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              {selectedDefaultPerms.length} permissions selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfiguringPermissions(false)}
              >
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={handleSaveDefaultPermissions}>
                {saving ? "Saving..." : "Save Default Permissions"}
              </Button>
            </div>
          </DialogFooter>
        </PortalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Add / Edit Team Member                                */}
      {/* ------------------------------------------------------------- */}
      {(addingMember || editingMember) && (
        <PortalDialog
          onClose={() => {
            setAddingMember(false);
            setEditingMember(null);
          }}
          title={
            <span className="flex items-center gap-2">
              {addingMember ? <UserPlus size={16} /> : <Edit3 size={16} />}
              {addingMember ? "Add Placement Team Member" : "Edit Team Member"}
            </span>
          }
          className="max-h-[90vh] overflow-y-auto"
        >
          <form
            onSubmit={addingMember ? handleAddSubmit : handleEditSubmit}
            className="grid gap-3.5"
          >
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="team-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-name"
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Dr. Rajesh Kumar or Aarav Sharma"
              />
            </div>

            {/* Role / Designation */}
            <div className="grid gap-2">
              <Label htmlFor="team-role">
                Role / Designation <span className="text-destructive">*</span>
              </Label>
              <Input
                id="team-role"
                type="text"
                required
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                placeholder="e.g. Student Placement Coordinator (Lead) or Faculty In-charge"
              />
              <div className="flex flex-wrap gap-1">
                {[
                  "Faculty In-charge, Training & Placement",
                  "Placement Officer",
                  "Student Placement Coordinator (Lead)",
                  "Student Placement Coordinator (Internships)",
                  "Student Placement Coordinator",
                ].map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="xs"
                    className="text-[10px]"
                    onClick={() => setFormRole(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Email */}
            <div className="grid gap-2">
              <Label htmlFor="team-email">Institute Email Address</Label>
              <Input
                id="team-email"
                type="email"
                list="registered-users-list"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. student@iiitl.ac.in or officer@iiitl.ac.in"
              />
              <datalist id="registered-users-list">
                {allUsers.map((u) => (
                  <option key={u.id} value={u.email || ""}>
                    {u.name ? `${u.name} (${u.role})` : u.role}
                  </option>
                ))}
              </datalist>
              <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                <Shield size={11} className="text-[var(--blue)]" />
                Linking a user email will automatically assign the default placement team permissions to their account.
              </p>
            </div>

            {/* Phone */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="team-phone">Contact Phone</Label>
                <Input
                  id="team-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="team-display-order">Display Order</Label>
                <Input
                  id="team-display-order"
                  type="number"
                  min={0}
                  value={formDisplayOrder}
                  onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Photo URL */}
            <div className="grid gap-2">
              <Label htmlFor="team-photo-url">Photo URL (Optional)</Label>
              <Input
                id="team-photo-url"
                type="url"
                value={formPhotoUrl}
                onChange={(e) => setFormPhotoUrl(e.target.value)}
                placeholder="https://... (Leave blank for automatic initials avatar)"
              />
            </div>

            <DialogFooter className="border-t pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddingMember(false);
                  setEditingMember(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : addingMember ? "Add Team Member" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </PortalDialog>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: Delete Confirmation                                   */}
      {/* ------------------------------------------------------------- */}
      {deletingMember && (
        <PortalDialog
          onClose={() => setDeletingMember(null)}
          eyebrow={<span className="text-[var(--badge-red-text)]">Remove</span>}
          title={
            <span className="flex items-center gap-2">
              <Trash2 size={16} /> Remove Team Member?
            </span>
          }
          description={
            <>
              Are you sure you want to remove <strong>{deletingMember.name}</strong> from the
              placement team?
            </>
          }
          className="sm:max-w-md"
        >
          {deletingMember.email && (
            <Alert className="border-[var(--badge-orange-text)] bg-[var(--badge-orange-bg)] text-[var(--badge-orange-text)]">
              <ShieldAlert />
              <AlertDescription className="text-current">
                <p className="text-[11px]">
                  Removing this member will also automatically revoke the placement team&apos;s default permissions from their user account (
                  <code>{deletingMember.email}</code>).
                </p>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeletingMember(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={handleDeleteSubmit}
            >
              <Trash2 />
              {saving ? "Removing..." : "Confirm Removal"}
            </Button>
          </DialogFooter>
        </PortalDialog>
      )}
    </div>
  );
}
