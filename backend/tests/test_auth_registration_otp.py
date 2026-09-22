"""
Tests for POST /api/v1/auth/internal/send-registration-otp.

The one behaviour worth pinning down: when a real mailer is configured and
the send fails, the endpoint must say so (502) rather than the previous
fire-and-forget shape, which always answered `{"sent": True}` before the
background task even ran — reporting success for a code no inbox was ever
going to receive. The unconfigured-mailer path (local/demo, no
RESEND_API_KEY) is unchanged and still answers success, logging the code
instead.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.core.config import settings
from app.core.security import INTERNAL_TOKEN_PURPOSE_REGISTER_OTP_EMAIL

_EMAIL = "someone@iiitl.ac.in"
_CODE = "123456"


def _internal_token(*, purpose: str = INTERNAL_TOKEN_PURPOSE_REGISTER_OTP_EMAIL, email: str = _EMAIL, code: str = _CODE) -> str:
    payload = {
        "purpose": purpose,
        "email": email,
        "code": code,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=2),
    }
    return jwt.encode(payload, settings.auth_secret, algorithm="HS256")


@pytest.fixture()
def client():
    from main import app  # noqa: PLC0415

    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def test_delivery_not_configured_reports_success_and_logs(client, monkeypatch, caplog):
    from app.routers import auth as auth_router  # noqa: PLC0415

    monkeypatch.setattr(auth_router, "is_email_delivery_configured", lambda: False)

    with caplog.at_level("WARNING"):
        response = client.post(
            "/api/v1/auth/internal/send-registration-otp",
            headers={"Authorization": f"Bearer {_internal_token()}"},
        )

    assert response.status_code == 200
    assert response.json() == {"sent": True}
    assert any(_CODE in record.message for record in caplog.records)


def test_delivery_configured_and_send_succeeds(client, monkeypatch):
    from app.routers import auth as auth_router  # noqa: PLC0415

    monkeypatch.setattr(auth_router, "is_email_delivery_configured", lambda: True)
    monkeypatch.setattr(auth_router, "send_notification_email", lambda **kwargs: {"id": "email_123"})

    response = client.post(
        "/api/v1/auth/internal/send-registration-otp",
        headers={"Authorization": f"Bearer {_internal_token()}"},
    )

    assert response.status_code == 200
    assert response.json() == {"sent": True}


def test_delivery_configured_but_send_fails_reports_502_not_success(client, monkeypatch):
    """
    This is the regression this change closes: previously, a failed Resend
    call (bad/placeholder key, unverified sending domain, an outage) still
    answered `{"sent": True}` because the send ran in a background task
    after the response had already gone out.
    """
    from app.routers import auth as auth_router  # noqa: PLC0415

    monkeypatch.setattr(auth_router, "is_email_delivery_configured", lambda: True)
    monkeypatch.setattr(auth_router, "send_notification_email", lambda **kwargs: None)

    response = client.post(
        "/api/v1/auth/internal/send-registration-otp",
        headers={"Authorization": f"Bearer {_internal_token()}"},
    )

    assert response.status_code == 502
    assert response.json() != {"sent": True}


def test_wrong_purpose_token_is_rejected(client):
    response = client.post(
        "/api/v1/auth/internal/send-registration-otp",
        headers={"Authorization": f"Bearer {_internal_token(purpose='something-else')}"},
    )
    assert response.status_code == 401


def test_malformed_code_is_rejected(client):
    response = client.post(
        "/api/v1/auth/internal/send-registration-otp",
        headers={"Authorization": f"Bearer {_internal_token(code='12ab')}"},
    )
    assert response.status_code == 400
