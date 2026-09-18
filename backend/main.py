from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic can go here
    yield
    # Shutdown logic can go here

app = FastAPI(
    title="TNP Portal API",
    description="FastAPI backend for IIITL Placement Portal",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.routers import auth, dashboard, profile, jobs, applications, feedback, noc, announcements, team, notifications, uploads, users, interview_experiences, students, offers, analytics

app.include_router(auth.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(feedback.router, prefix="/api/v1")
app.include_router(noc.router, prefix="/api/v1")
app.include_router(announcements.router, prefix="/api/v1")
app.include_router(team.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(interview_experiences.router, prefix="/api/v1")
app.include_router(students.router, prefix="/api/v1")
app.include_router(offers.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")

# Database table browser at /admin, distinct from the frontend's admin portal.
# Mounted last so its catch-all routes cannot shadow an API path, and silent
# unless DB_ADMIN_PASSWORD is set — see app/admin/setup.py.
from app.admin import mount_admin

mount_admin(app)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

