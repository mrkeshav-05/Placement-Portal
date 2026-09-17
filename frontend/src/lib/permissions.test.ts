import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_PERMISSIONS,
  PERM_ANNOUNCEMENTS_PUBLISH,
  PERM_APPLICATIONS_APPLY,
  PERM_APPLICATIONS_UPDATE,
  PERM_APPLICATIONS_VIEW,
  PERM_APPLICATIONS_VIEW_OWN,
  PERM_COMPANIES_CREATE,
  PERM_INTERVIEW_EXPERIENCES_APPROVE,
  PERM_INTERVIEW_EXPERIENCES_VIEW,
  PERM_JOBS_CREATE,
  PERM_NOC_APPROVE,
  PERM_RBAC_MANAGE,
  PERM_SETTINGS_MANAGE,
  PERM_STUDENTS_VIEW,
  PERM_STUDENTS_VIEW_OWN,
  PERM_USERS_MANAGE,
  PERM_USERS_VIEW,
  ROUTE_PERMISSIONS,
  STUDENT_SCOPED_PERMISSIONS,
  canAccessAdminRoute,
  computeEffectivePermissions,
  firstAccessibleAdminRoute,
  hasAnyAdminPermission,
  hasPermission,
  isElevatedRole,
} from "./permissions";

test("SUPER_ADMIN role inherits all permissions", () => {
  const perms = computeEffectivePermissions("SUPER_ADMIN");
  assert.equal(perms.length, ALL_PERMISSIONS.length);
  assert.ok(perms.includes(PERM_USERS_MANAGE));
  assert.ok(perms.includes(PERM_SETTINGS_MANAGE));
  assert.ok(perms.includes(PERM_RBAC_MANAGE));
});

test("PLACEMENT_TEAM runs the cell but never the permission system", () => {
  const perms = computeEffectivePermissions("PLACEMENT_TEAM");
  assert.ok(perms.includes(PERM_JOBS_CREATE));
  assert.ok(perms.includes(PERM_APPLICATIONS_UPDATE));
  assert.ok(perms.includes(PERM_NOC_APPROVE));
  assert.ok(perms.includes(PERM_ANNOUNCEMENTS_PUBLISH));
  assert.ok(perms.includes(PERM_USERS_VIEW));

  assert.ok(!perms.includes(PERM_RBAC_MANAGE));
  assert.ok(!perms.includes(PERM_USERS_MANAGE));
  assert.ok(!perms.includes(PERM_SETTINGS_MANAGE));
});

test("PLACEMENT_VOLUNTEER reads placement data but cannot change it", () => {
  const perms = computeEffectivePermissions("PLACEMENT_VOLUNTEER");
  assert.ok(perms.includes(PERM_APPLICATIONS_VIEW));
  assert.ok(perms.includes(PERM_STUDENTS_VIEW));
  assert.ok(perms.includes(PERM_INTERVIEW_EXPERIENCES_VIEW));

  assert.ok(!perms.includes(PERM_APPLICATIONS_UPDATE));
  assert.ok(!perms.includes(PERM_COMPANIES_CREATE));
  assert.ok(!perms.includes(PERM_JOBS_CREATE));
  assert.ok(!perms.includes(PERM_NOC_APPROVE));
  assert.ok(!perms.includes(PERM_INTERVIEW_EXPERIENCES_APPROVE));
  assert.ok(!perms.includes(PERM_USERS_VIEW));
});

test("STUDENT holds only own-scoped permissions", () => {
  const perms = computeEffectivePermissions("STUDENT");
  assert.ok(perms.includes(PERM_APPLICATIONS_VIEW_OWN));
  assert.ok(perms.includes(PERM_APPLICATIONS_APPLY));
  assert.ok(perms.includes(PERM_STUDENTS_VIEW_OWN));

  // Never the wide equivalents.
  assert.ok(!perms.includes(PERM_APPLICATIONS_VIEW));
  assert.ok(!perms.includes(PERM_STUDENTS_VIEW));

  const studentScoped = new Set<string>(STUDENT_SCOPED_PERMISSIONS);
  assert.ok(perms.every((perm) => studentScoped.has(perm)));
});

test("Custom permissions allow fine-grained grants to students", () => {
  const perms = computeEffectivePermissions("STUDENT", [PERM_COMPANIES_CREATE]);
  assert.ok(perms.includes(PERM_COMPANIES_CREATE));
});

test("Custom permissions allow explicit revocation with minus prefix", () => {
  const perms = computeEffectivePermissions("PLACEMENT_TEAM", [`-${PERM_JOBS_CREATE}`]);
  assert.ok(!perms.includes(PERM_JOBS_CREATE));
  assert.ok(perms.includes(PERM_APPLICATIONS_UPDATE));
});

test("hasPermission validates user permissions accurately", () => {
  assert.equal(
    hasPermission({ role: "SUPER_ADMIN", email: "student@iiitl.ac.in" }, PERM_USERS_MANAGE),
    true,
  );
  assert.equal(
    hasPermission({ role: "STUDENT", email: "student@iiitl.ac.in" }, PERM_USERS_MANAGE),
    false,
  );
  assert.equal(
    hasPermission(
      { role: "STUDENT", email: "student@iiitl.ac.in", customPermissions: [PERM_USERS_VIEW] },
      PERM_USERS_VIEW,
    ),
    true,
  );
});

test("isElevatedRole identifies administrative roles correctly", () => {
  assert.equal(isElevatedRole("SUPER_ADMIN"), true);
  assert.equal(isElevatedRole("PLACEMENT_TEAM"), true);
  assert.equal(isElevatedRole("PLACEMENT_VOLUNTEER"), true);
  assert.equal(isElevatedRole("STUDENT"), false);
  assert.equal(isElevatedRole(null), false);
});

/**
 * Regression test for the admin gate. It used to ask whether the account had
 * *any* permissions at all, which let a student through — and the resume, NOC
 * document, and identity-document routes took passing that gate as licence to
 * skip their ownership checks.
 */
test("holding only own-scoped permissions never opens the admin portal", () => {
  const student = { role: "STUDENT", email: "student@iiitl.ac.in" };
  assert.equal(computeEffectivePermissions("STUDENT").length > 0, true);
  assert.equal(hasAnyAdminPermission(student), false);

  // A revocation is still a non-empty customPermissions array.
  const studentWithRevocation = {
    role: "STUDENT",
    email: "student@iiitl.ac.in",
    customPermissions: [`-${PERM_APPLICATIONS_APPLY}`],
  };
  assert.equal(hasAnyAdminPermission(studentWithRevocation), false);

  // A real administrative grant does open it — the custom-permission feature
  // still works, it just has to be a permission that means something.
  const studentWithGrant = {
    role: "STUDENT",
    email: "student@iiitl.ac.in",
    customPermissions: [PERM_STUDENTS_VIEW],
  };
  assert.equal(hasAnyAdminPermission(studentWithGrant), true);

  // A session issued before this catalog existed carries keys that are no
  // longer real. An unrecognised string is not an administrative permission.
  const staleSession = {
    role: "STUDENT",
    email: "student@iiitl.ac.in",
    effectivePermissions: ["users:read", "companies:manage", "jobs:manage"],
  };
  assert.equal(hasAnyAdminPermission(staleSession), false);
});

test("canAccessAdminRoute guards routes based on permission requirements", () => {
  const volunteer = { role: "PLACEMENT_VOLUNTEER", email: "vol@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(volunteer, "/admin/events"), true);
  // The pre-rename path still resolves, because it only redirects.
  assert.equal(canAccessAdminRoute(volunteer, "/admin/job-profiles"), true);
  // Reading the event list does not imply creating one.
  assert.equal(canAccessAdminRoute(volunteer, "/admin/events/add"), false);
  // Nor does browsing recruiters imply registering one.
  assert.equal(canAccessAdminRoute(volunteer, "/admin/companies"), true);
  assert.equal(canAccessAdminRoute(volunteer, "/admin/companies/add"), false);
  // Nor does reading the season's offers imply recording a drive's worth of them.
  assert.equal(canAccessAdminRoute(volunteer, "/admin/placement-records"), true);
  assert.equal(canAccessAdminRoute(volunteer, "/admin/placement-records/add"), false);
  assert.equal(canAccessAdminRoute(volunteer, "/admin/applications"), true);
  assert.equal(canAccessAdminRoute(volunteer, "/admin/users"), false);
  assert.equal(canAccessAdminRoute(volunteer, "/admin/settings"), false);

  const student = { role: "STUDENT", email: "student@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(student, "/admin/dashboard"), false);

  const elevatedStudent = {
    role: "STUDENT",
    email: "student@iiitl.ac.in",
    customPermissions: [PERM_USERS_VIEW],
  };
  assert.equal(canAccessAdminRoute(elevatedStudent, "/admin/users"), true);
});

test("only Super Admin reaches settings", () => {
  assert.deepEqual(ROUTE_PERMISSIONS["/admin/settings"], [PERM_SETTINGS_MANAGE]);

  const team = { role: "PLACEMENT_TEAM", email: "team@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(team, "/admin/settings"), false);

  const superAdmin = { role: "SUPER_ADMIN", email: "boss@iiitl.ac.in" };
  assert.equal(canAccessAdminRoute(superAdmin, "/admin/settings"), true);
});

test("the admin sidebar only offers routes the account can open", () => {
  const volunteer = { role: "PLACEMENT_VOLUNTEER", email: "vol@iiitl.ac.in" };
  const visible = Object.keys(ROUTE_PERMISSIONS).filter((path) =>
    canAccessAdminRoute(volunteer, path),
  );

  assert.ok(visible.includes("/admin/applications"));
  assert.ok(visible.includes("/admin/events"));
  assert.equal(visible.includes("/admin/events/add"), false);
  assert.ok(visible.includes("/admin/companies"));
  assert.equal(visible.includes("/admin/companies/add"), false);
  assert.ok(visible.includes("/admin/placement-records"));
  assert.equal(visible.includes("/admin/placement-records/add"), false);
  assert.ok(visible.includes("/admin/noc-requests"));
  assert.equal(visible.includes("/admin/users"), false);
  // team.view is the public directory; the admin console is team.manage.
  assert.equal(visible.includes("/admin/team"), false);
  assert.equal(visible.includes("/admin/settings"), false);
  // Read access to the queue, but not to the composer.
  assert.equal(visible.includes("/admin/announcements/company-event"), false);

  const superAdmin = { role: "SUPER_ADMIN", email: "boss@iiitl.ac.in" };
  assert.equal(
    Object.keys(ROUTE_PERMISSIONS).filter((path) => canAccessAdminRoute(superAdmin, path)).length,
    Object.keys(ROUTE_PERMISSIONS).length,
  );
});

test("a redirect target always exists for an account inside the admin portal", () => {
  // Guards the redirect loop: whoever passes the admin gate must have
  // somewhere to land, or the middleware bounces them forever.
  for (const role of ["SUPER_ADMIN", "PLACEMENT_TEAM", "PLACEMENT_VOLUNTEER"] as const) {
    const user = { role, email: `${role}@iiitl.ac.in` };
    assert.ok(hasAnyAdminPermission(user));
    assert.notEqual(firstAccessibleAdminRoute(user), null);
  }

  assert.equal(firstAccessibleAdminRoute({ role: "STUDENT", email: "s@iiitl.ac.in" }), null);
});
