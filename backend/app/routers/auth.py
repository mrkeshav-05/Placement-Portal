import asyncio
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import (
    INTERNAL_TOKEN_PURPOSE_REGISTER_OTP_EMAIL,
    require_internal_purpose_token,
)
from app.dependencies import get_current_user
from app.services.email import is_email_delivery_configured, send_notification_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_OTP_PATTERN = re.compile(r"^\d{6}$")


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return user


@router.post("/internal/send-registration-otp")
async def send_registration_otp_email(
    token_payload: dict = Depends(
        require_internal_purpose_token(INTERNAL_TOKEN_PURPOSE_REGISTER_OTP_EMAIL)
    ),
):
    """
    The only place a registration OTP is actually emailed. Called by the
    Next.js server, never a browser: the frontend generates and stores the
    code (it owns the User/VerificationToken tables via Prisma) and mints a
    short-lived token carrying it, this endpoint only relays it through the
    one real email sender this service has.
    """
    email = token_payload.get("email")
    code = str(token_payload.get("code") or "")
    if not email or not _OTP_PATTERN.fullmatch(code):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed token claims.")

    if not is_email_delivery_configured():
        # Matches send_notification_email's own dummy-key handling: never
        # block the feature on an unconfigured mailer, but an OTP that
        # only ever "sends" silently would leave registration unusable in
        # local/demo environments, so it goes to the server log instead.
        logger.warning("[DEV] Email delivery is not configured; registration OTP for %s is %s", email, code)
        return {"sent": True}

    # Awaited rather than a fire-and-forget BackgroundTasks entry: a
    # registration code is the one email in this service where the caller
    # (the Next.js route) needs to know delivery actually happened, so it can
    # tell the person their inbox will not get anything instead of showing a
    # false "code sent" — resend.Emails.send is a blocking HTTP call, run off
    # the event loop rather than awaited directly.
    result = await asyncio.to_thread(
        send_notification_email,
        to_email=email,
        subject="Verify your Placement Portal email",
        message=f"Your verification code is {code}. It expires in 10 minutes.",
        html_content=(
            "<p>Use this code to finish creating your Training &amp; Placement Portal account:</p>"
            f"<p style=\"font-size:28px;font-weight:700;letter-spacing:6px\">{code}</p>"
            "<p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>"
        ),
    )
    if result is None:
        # send_notification_email already logged the specific reason
        # (invalid key, unverified sending domain, Resend outage, ...); this
        # is only the signal the frontend needs to relay "could not send"
        # instead of silently reporting success for a code no inbox will
        # ever receive.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The verification email could not be sent.",
        )
    return {"sent": True}
