"""Tests for NOC schemas, permissions, and response formatting."""
from __future__ import annotations

from datetime import datetime, timedelta
import pytest
from pydantic import ValidationError

from app.core.security import (
    PERM_NOC_APPROVE,
    compute_effective_permissions,
    has_permission,
)
from app.models.db import NocRequest, NocSource, NocStatus, User
from app.routers.noc import _to_admin_noc_response
from app.schemas.noc import (
    AdminNocResponse,
    NocApproveRequest,
    NocCreate,
    NocMetricsResponse,
    NocRejectRequest,
    NocResponse,
)


def test_noc_create_schema_valid():
    start = datetime.now()
    end = start + timedelta(days=90)
    data = {
        "company": "Amazon India",
        "address": "Brigade Gateway, World Trade Centre",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560055",
        "startDate": start,
        "endDate": end,
        "message": "Summer SDE internship",
        "source": "ON_CAMPUS",
    }
    schema = NocCreate(**data)
    assert schema.company == "Amazon India"
    assert schema.pincode == "560055"
    assert schema.endDate >= schema.startDate
    assert schema.nocRequired is True


def test_noc_create_schema_rejects_end_date_before_start_date():
    start = datetime.now()
    end = start - timedelta(days=5)
    with pytest.raises(ValidationError) as exc_info:
        NocCreate(
            company="Google",
            address="RMZ Infinity",
            city="Bengaluru",
            state="Karnataka",
            pincode="560016",
            startDate=start,
            endDate=end,
            source="ON_CAMPUS",
        )
    assert "End date cannot be earlier than start date" in str(exc_info.value)


def test_noc_create_schema_rejects_invalid_pincode():
    start = datetime.now()
    end = start + timedelta(days=30)
    with pytest.raises(ValidationError):
        NocCreate(
            company="Microsoft",
            address="Prestige Ferns Galaxy",
            city="Bengaluru",
            state="Karnataka",
            pincode="5600A5",  # Invalid non-digit
            startDate=start,
            endDate=end,
            source="ON_CAMPUS",
        )


def test_noc_create_schema_requires_proof_for_offcampus_source():
    start = datetime.now()
    end = start + timedelta(days=30)
    base = dict(
        company="Atlan",
        address="Sector 44, Cyber City",
        city="Gurugram",
        state="Haryana",
        pincode="122003",
        startDate=start,
        endDate=end,
        source="OFF_CAMPUS",
    )

    with pytest.raises(ValidationError) as exc_info:
        NocCreate(**base)
    assert "Upload a supporting document" in str(exc_info.value)

    schema = NocCreate(
        **base,
        offCampusProofUrl="/api/v1/uploads/files/noc_offcampus_proof/abc.pdf",
    )
    assert schema.offCampusProofUrl == "/api/v1/uploads/files/noc_offcampus_proof/abc.pdf"


def test_noc_create_schema_not_required_flag():
    start = datetime.now()
    end = start + timedelta(days=30)
    schema = NocCreate(
        company="Internal Lab",
        address="Institute campus",
        city="Lucknow",
        state="Uttar Pradesh",
        pincode="226002",
        startDate=start,
        endDate=end,
        source="ON_CAMPUS",
        nocRequired=False,
    )
    assert schema.nocRequired is False


def test_noc_manage_permission_hierarchy():
    super_admin_perms = compute_effective_permissions("SUPER_ADMIN")
    assert PERM_NOC_APPROVE in super_admin_perms

    team_perms = compute_effective_permissions("PLACEMENT_TEAM")
    assert PERM_NOC_APPROVE in team_perms

    volunteer_perms = compute_effective_permissions("PLACEMENT_VOLUNTEER")
    assert PERM_NOC_APPROVE not in volunteer_perms

    student_perms = compute_effective_permissions("STUDENT")
    assert PERM_NOC_APPROVE not in student_perms

    custom_coord = compute_effective_permissions("PLACEMENT_VOLUNTEER", custom_permissions=[PERM_NOC_APPROVE])
    assert PERM_NOC_APPROVE in custom_coord


def test_to_admin_noc_response_formatting():
    now = datetime.now()
    user = User(
        id="usr_123",
        name="Arjun Desai",
        email="arjun@iiitl.ac.in",
        rollNumber="LCS2023001",
        branch="CS",
        batch=2027,
        cgpa=8.95,
        contactNumber="+91 9876543210",
    )
    noc = NocRequest(
        id="noc_456",
        userId="usr_123",
        company="Postman",
        address="Golf Course Road",
        city="Bengaluru",
        state="Karnataka",
        pincode="560103",
        startDate=now,
        endDate=now + timedelta(days=180),
        status=NocStatus.APPROVED,
        message="Off-campus internship",
        adminRemarks="Approved. Submit the joining letter to the placement cell.",
        documentUrl="/api/v1/uploads/files/noc_docs/cert_123.pdf",
        source=NocSource.OFF_CAMPUS,
        offCampusProofUrl="/api/v1/uploads/files/noc_offcampus_proof/offer_123.pdf",
        verifiedByPlacementTeam=True,
        nocRequired=True,
        createdAt=now,
        updatedAt=now,
    )
    noc.user = user

    resp = _to_admin_noc_response(noc)
    assert resp.id == "noc_456"
    assert resp.status == "APPROVED"
    assert resp.company == "Postman"
    assert resp.student is not None
    assert resp.student.name == "Arjun Desai"
    assert resp.student.rollNumber == "LCS2023001"
    assert resp.student.cgpa == 8.95
    assert resp.documentUrl == "/api/v1/uploads/files/noc_docs/cert_123.pdf"
    assert resp.source == "OFF_CAMPUS"
    assert resp.offCampusProofUrl == "/api/v1/uploads/files/noc_offcampus_proof/offer_123.pdf"
    assert resp.verifiedByPlacementTeam is True
    assert resp.nocRequired is True
    # The two remarks fields stay distinct all the way out to the admin UI.
    assert resp.message == "Off-campus internship"
    assert resp.adminRemarks == "Approved. Submit the joining letter to the placement cell."


def test_metrics_response_counts_not_required_separately_from_approved():
    metrics = NocMetricsResponse(total=10, pending=3, approved=5, rejected=1, notRequired=1)
    assert metrics.approved == 5
    assert metrics.notRequired == 1
    assert metrics.pending + metrics.approved + metrics.rejected + metrics.notRequired == metrics.total


def test_decision_requests_carry_admin_remarks_and_never_the_student_message():
    approve = NocApproveRequest(adminRemarks="Approved subject to attendance.")
    assert approve.adminRemarks == "Approved subject to attendance."

    reject = NocRejectRequest(adminRemarks="Overlaps the placement drive window.")
    assert reject.adminRemarks == "Overlaps the placement drive window."

    # A stray `message` is not a decision remark: it is dropped, so the value a
    # student submitted can never arrive here and overwrite itself.
    assert NocApproveRequest(message="student text").adminRemarks is None
    assert NocRejectRequest(message="student text").adminRemarks is None


def test_student_facing_response_exposes_both_remarks_fields():
    now = datetime.now()
    response = NocResponse(
        id="noc_1",
        userId="usr_1",
        company="Postman",
        address="Golf Course Road",
        city="Bengaluru",
        state="Karnataka",
        pincode="560103",
        startDate=now,
        endDate=now + timedelta(days=30),
        status="REJECTED",
        message="Requesting an NOC for an off-campus role.",
        adminRemarks="Rejected: the organisation is not registered with the institute.",
        source="OFF_CAMPUS",
        verifiedByPlacementTeam=False,
        nocRequired=True,
        createdAt=now,
        updatedAt=now,
    )
    assert response.message == "Requesting an NOC for an off-campus role."
    assert response.adminRemarks == "Rejected: the organisation is not registered with the institute."
