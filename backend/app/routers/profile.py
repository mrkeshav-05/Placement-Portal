import re
import os
from pathlib import Path
from fastapi import APIRouter, Depends, Form, HTTPException, Response, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.rate_limit import Throttle
from app.dependencies import get_db, require_student
from app.models.db import User, Resume
from app.schemas.student import (
    AadhaarUnlockRequest,
    AadhaarUpdate,
    CollegeIdUnlockRequest,
    CollegeIdUpdate,
    PanUnlockRequest,
    PanUpdate,
    ResumeResponse,
    ResumeUpdate,
    StudentProfileResponse,
    StudentProfileUpdate,
)
from app.core.encryption import (
    decrypt_bytes,
    decrypt_value,
    encrypt_bytes,
    encrypt_value,
    is_encrypted,
)
from app.core.storage import LOCAL_UPLOADS_DIR, delete_file, validate_pdf

router = APIRouter(prefix="/profile", tags=["profile"])

# The number doubles as the challenge that unlocks a document's own scan
# (see the three `*-doc/unlock` routes below), and until now nothing limited
# how many numbers a caller could try. Keyed by (user, document type), so
# guessing the Aadhaar number does not also lock out a correct PAN.
_unlock_throttle = Throttle("identity-doc-unlock", window_seconds=15 * 60, lockout_seconds=15 * 60, max_attempts=8)


async def _guard_unlock_attempt(user_id: str, doc_type: str) -> str:
    throttle_key = f"{user_id}:{doc_type}"
    if await _unlock_throttle.is_locked_out(throttle_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many incorrect attempts. Try again in a few minutes.",
        )
    return throttle_key


def _mask_aadhaar(encrypted_val: str | None) -> str | None:
    if not encrypted_val or not is_encrypted(encrypted_val):
        return None
    try:
        raw = decrypt_value(encrypted_val)
        if len(raw) >= 4:
            return f"•••• •••• {raw[-4:]}"
        return "•••• •••• ••••"
    except Exception:
        return "•••• •••• ••••"


def _mask_college_id(encrypted_val: str | None) -> str | None:
    if not encrypted_val or not is_encrypted(encrypted_val):
        return None
    try:
        raw = decrypt_value(encrypted_val)
        if len(raw) >= 4:
            return f"••••{raw[-4:]}"
        return "••••"
    except Exception:
        return "••••"


def _mask_pan(encrypted_val: str | None) -> str | None:
    if not encrypted_val or not is_encrypted(encrypted_val):
        return None
    try:
        raw = decrypt_value(encrypted_val)
        if len(raw) >= 4:
            return f"••••• {raw[-4:]}"
        return "••••• ••••"
    except Exception:
        return "••••• ••••"


@router.get("", response_model=StudentProfileResponse)
async def get_profile(
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return StudentProfileResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        personalEmail=user.personalEmail,
        rollNumber=user.rollNumber,
        branch=user.branch,
        batch=user.batch,
        degree=user.degree,
        category=user.category,
        gender=user.gender,
        dateOfBirth=user.dateOfBirth,
        bloodGroup=user.bloodGroup,
        contactNumber=user.contactNumber,
        altContactNumber=user.altContactNumber,
        currentAddress=user.currentAddress,
        permanentAddress=user.permanentAddress,
        aadhaarProvided=bool(user.aadhaarEncrypted),
        aadhaarMasked=_mask_aadhaar(user.aadhaarEncrypted),
        aadhaarDocProvided=bool(user.aadhaarDocUrl),
        aadhaarDocFileName=user.aadhaarDocFileName,
        panProvided=bool(user.panCardEncrypted),
        panMasked=_mask_pan(user.panCardEncrypted),
        panDocProvided=bool(user.panCardDocUrl),
        panDocFileName=user.panCardDocFileName,
        collegeIdProvided=bool(user.collegeIdEncrypted),
        collegeIdMasked=_mask_college_id(user.collegeIdEncrypted),
        collegeIdDocProvided=bool(user.collegeIdDocUrl),
        collegeIdDocFileName=user.collegeIdDocFileName,
        class10Percent=user.class10Percent,
        class12Percent=user.class12Percent,
        cgpa=user.cgpa,
        backlogs=user.backlogs,
        bans=user.bans,
    )


@router.patch("")
async def update_profile(
    profile_data: StudentProfileUpdate,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_dict = profile_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(user, key, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.put("/aadhaar")
async def save_aadhaar(
    data: AadhaarUpdate,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    clean_aadhaar = data.aadhaar.strip()
    if not clean_aadhaar.isdigit() or len(clean_aadhaar) != 12:
        raise HTTPException(status_code=400, detail="Aadhaar must be a valid 12-digit number.")

    user.aadhaarEncrypted = encrypt_value(clean_aadhaar)
    await db.commit()
    return {"message": "Aadhaar saved securely", "masked": f"•••• •••• {clean_aadhaar[-4:]}"}


@router.put("/pan")
async def save_pan(
    data: PanUpdate,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    clean_pan = data.pan.strip().upper()
    user.panCardEncrypted = encrypt_value(clean_pan)
    await db.commit()
    return {"message": "PAN saved securely", "masked": f"••••• {clean_pan[-4:]}"}


@router.post("/aadhaar-doc")
async def upload_aadhaar_document(
    file: UploadFile = File(...),
    aadhaar: str = Form(...),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    clean_aadhaar = aadhaar.strip()
    if not clean_aadhaar.isdigit() or len(clean_aadhaar) != 12:
        raise HTTPException(status_code=400, detail="Aadhaar must be a valid 12-digit number.")

    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Read and validate PDF
    content = await file.read()
    try:
        validate_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Encrypt the document file bytes with AES-256-GCM
    encrypted_payload = encrypt_bytes(content)

    # Save to encrypted disk storage
    target_dir = LOCAL_UPLOADS_DIR / "identity_docs" / user.id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "aadhaar.enc"
    target_file.write_bytes(encrypted_payload)

    # Save encrypted number and document relative path in database
    user.aadhaarEncrypted = encrypt_value(clean_aadhaar)
    user.aadhaarDocUrl = f"identity_docs/{user.id}/aadhaar.enc"
    user.aadhaarDocFileName = file.filename or "aadhaar_card.pdf"

    await db.commit()
    return {
        "message": "Aadhaar document encrypted and saved securely.",
        "fileName": user.aadhaarDocFileName,
        "masked": f"•••• •••• {clean_aadhaar[-4:]}",
    }


@router.post("/pan-doc")
async def upload_pan_document(
    file: UploadFile = File(...),
    pan: str = Form(...),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    clean_pan = pan.strip().upper()
    if len(clean_pan) != 10:
        raise HTTPException(status_code=400, detail="PAN must be a valid 10-character code.")

    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    content = await file.read()
    try:
        validate_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    encrypted_payload = encrypt_bytes(content)

    target_dir = LOCAL_UPLOADS_DIR / "identity_docs" / user.id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "pan.enc"
    target_file.write_bytes(encrypted_payload)

    user.panCardEncrypted = encrypt_value(clean_pan)
    user.panCardDocUrl = f"identity_docs/{user.id}/pan.enc"
    user.panCardDocFileName = file.filename or "pan_card.pdf"

    await db.commit()
    return {
        "message": "PAN document encrypted and saved securely.",
        "fileName": user.panCardDocFileName,
        "masked": f"••••• {clean_pan[-4:]}",
    }


@router.post("/aadhaar-doc/unlock")
async def unlock_aadhaar_document(
    request_data: AadhaarUnlockRequest,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    throttle_key = await _guard_unlock_attempt(user_payload["sub"], "aadhaar")

    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user or not user.aadhaarDocUrl:
        raise HTTPException(status_code=404, detail="Aadhaar document not found.")

    if not user.aadhaarEncrypted:
        raise HTTPException(status_code=400, detail="No Aadhaar number on record.")

    # Verify matching Aadhaar number
    try:
        real_aadhaar = decrypt_value(user.aadhaarEncrypted)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt identity record.")

    if real_aadhaar != request_data.aadhaar.strip():
        await _unlock_throttle.record_attempt(throttle_key)
        raise HTTPException(
            status_code=403,
            detail="Incorrect Aadhaar number. Verification failed and document cannot be unlocked.",
        )
    await _unlock_throttle.clear(throttle_key)

    # Read and decrypt file
    file_path = LOCAL_UPLOADS_DIR / user.aadhaarDocUrl
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Encrypted document file not found.")

    try:
        encrypted_bytes = file_path.read_bytes()
        decrypted_pdf = decrypt_bytes(encrypted_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")

    return Response(
        content=decrypted_pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{user.aadhaarDocFileName or 'aadhaar.pdf'}\"",
            "X-Frame-Options": "SAMEORIGIN",
        },
    )


@router.post("/pan-doc/unlock")
async def unlock_pan_document(
    request_data: PanUnlockRequest,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    throttle_key = await _guard_unlock_attempt(user_payload["sub"], "pan")

    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user or not user.panCardDocUrl:
        raise HTTPException(status_code=404, detail="PAN document not found.")

    if not user.panCardEncrypted:
        raise HTTPException(status_code=400, detail="No PAN number on record.")

    try:
        real_pan = decrypt_value(user.panCardEncrypted)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt identity record.")

    if real_pan.upper() != request_data.pan.strip().upper():
        await _unlock_throttle.record_attempt(throttle_key)
        raise HTTPException(
            status_code=403,
            detail="Incorrect PAN number. Verification failed and document cannot be unlocked.",
        )
    await _unlock_throttle.clear(throttle_key)

    file_path = LOCAL_UPLOADS_DIR / user.panCardDocUrl
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Encrypted document file not found.")

    try:
        encrypted_bytes = file_path.read_bytes()
        decrypted_pdf = decrypt_bytes(encrypted_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")

    return Response(
        content=decrypted_pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{user.panCardDocFileName or 'pan.pdf'}\"",
            "X-Frame-Options": "SAMEORIGIN",
        },
    )


@router.delete("/aadhaar-doc")
async def delete_aadhaar_document(
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.aadhaarDocUrl:
        file_path = LOCAL_UPLOADS_DIR / user.aadhaarDocUrl
        if file_path.exists():
            try:
                os.remove(file_path)
            except Exception:
                pass
        user.aadhaarDocUrl = None
        user.aadhaarDocFileName = None
        await db.commit()

    return {"message": "Aadhaar document removed successfully."}


@router.delete("/pan-doc")
async def delete_pan_document(
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.panCardDocUrl:
        file_path = LOCAL_UPLOADS_DIR / user.panCardDocUrl
        if file_path.exists():
            try:
                os.remove(file_path)
            except Exception:
                pass
        user.panCardDocUrl = None
        user.panCardDocFileName = None
        await db.commit()

    return {"message": "PAN document removed successfully."}


@router.get("/resumes", response_model=list[ResumeResponse])
async def list_resumes(
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    resumes = await db.scalars(
        select(Resume)
        .where(Resume.userId == user_payload["sub"])
        .order_by(Resume.uploadedAt.desc())
    )
    return resumes.all()


@router.patch("/resumes/{resume_id}", response_model=ResumeResponse)
async def update_resume_label(
    resume_id: str,
    data: ResumeUpdate,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    resume = await db.scalar(
        select(Resume).where(Resume.id == resume_id, Resume.userId == user_payload["sub"])
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    resume.label = data.label.strip()
    await db.commit()
    await db.refresh(resume)
    return resume


@router.delete("/resumes/{resume_id}")
async def delete_resume(
    resume_id: str,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    resume = await db.scalar(
        select(Resume).where(Resume.id == resume_id, Resume.userId == user_payload["sub"])
    )
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found.")

    # Delete local or cloud file
    delete_file(resume.fileUrl)

    await db.delete(resume)
    await db.commit()
    return {"message": "Resume deleted successfully."}




# ---------------------------------------------------------------------------
# College ID card
#
# Mirrors the Aadhaar and PAN flow: the card number is encrypted at rest, the
# scan is encrypted on disk, and the number is the challenge that unlocks it.
# The number is normalised to upper case on the way in so that the unlock
# comparison does not fail on casing the student did not intend.
# ---------------------------------------------------------------------------


def _normalise_college_id(value: str) -> str:
    return value.strip().upper()


@router.put("/college-id")
async def save_college_id(
    data: CollegeIdUpdate,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    clean = _normalise_college_id(data.collegeId)
    user.collegeIdEncrypted = encrypt_value(clean)
    await db.commit()
    return {"message": "College ID saved securely", "masked": f"••••{clean[-4:]}"}


@router.post("/college-id-doc")
async def upload_college_id_document(
    file: UploadFile = File(...),
    collegeId: str = Form(...),
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    clean = _normalise_college_id(collegeId)
    if not re.fullmatch(r"[A-Z0-9/-]{4,20}", clean):
        raise HTTPException(
            status_code=400,
            detail="College ID must be 4-20 letters, digits, hyphens, or slashes.",
        )

    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    content = await file.read()
    try:
        validate_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    encrypted_payload = encrypt_bytes(content)

    target_dir = LOCAL_UPLOADS_DIR / "identity_docs" / user.id
    target_dir.mkdir(parents=True, exist_ok=True)
    target_file = target_dir / "college_id.enc"
    target_file.write_bytes(encrypted_payload)

    user.collegeIdEncrypted = encrypt_value(clean)
    user.collegeIdDocUrl = f"identity_docs/{user.id}/college_id.enc"
    user.collegeIdDocFileName = file.filename or "college_id.pdf"

    await db.commit()
    return {
        "message": "College ID document encrypted and saved securely.",
        "fileName": user.collegeIdDocFileName,
        "masked": f"••••{clean[-4:]}",
    }


@router.post("/college-id-doc/unlock")
async def unlock_college_id_document(
    request_data: CollegeIdUnlockRequest,
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    throttle_key = await _guard_unlock_attempt(user_payload["sub"], "college-id")

    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user or not user.collegeIdDocUrl:
        raise HTTPException(status_code=404, detail="College ID document not found.")

    if not user.collegeIdEncrypted:
        raise HTTPException(status_code=400, detail="No College ID number on record.")

    try:
        real_college_id = decrypt_value(user.collegeIdEncrypted)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt identity record.")

    if real_college_id != _normalise_college_id(request_data.collegeId):
        await _unlock_throttle.record_attempt(throttle_key)
        raise HTTPException(
            status_code=403,
            detail="Incorrect College ID number. Verification failed and document cannot be unlocked.",
        )
    await _unlock_throttle.clear(throttle_key)

    file_path = LOCAL_UPLOADS_DIR / user.collegeIdDocUrl
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Encrypted document file not found.")

    try:
        encrypted_bytes = file_path.read_bytes()
        decrypted_pdf = decrypt_bytes(encrypted_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decryption failed: {str(e)}")

    return Response(
        content=decrypted_pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=\"{user.collegeIdDocFileName or 'college_id.pdf'}\"",
            "X-Frame-Options": "SAMEORIGIN",
        },
    )


@router.delete("/college-id-doc")
async def delete_college_id_document(
    user_payload: dict = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_payload["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.collegeIdDocUrl:
        file_path = LOCAL_UPLOADS_DIR / user.collegeIdDocUrl
        if file_path.exists():
            try:
                os.remove(file_path)
            except Exception:
                pass
        user.collegeIdDocUrl = None
        user.collegeIdDocFileName = None
        await db.commit()

    return {"message": "College ID document removed successfully."}
