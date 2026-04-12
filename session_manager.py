from __future__ import annotations

import base64
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException, Request

from servers.general_server.config import PORT
from servers.shared.schemas import (
    LiveSessionEndResponse,
    LiveSessionStartRequest,
    LiveSessionStartResponse,
)


LOGGER = logging.getLogger("uvicorn.error")
LIVE_SESSIONS: dict[str, dict[str, object]] = {}
FRAME_ACTIVITY_GAP_SECONDS = 3.0
RECENT_ACTIVITY_TAIL_SECONDS = 0.5


def build_ws_url(session_id: str, http_request: Request | None = None) -> str:
    if http_request is None:
        return f"ws://127.0.0.1:{PORT}/ws/live/{session_id}"

    forwarded_proto = (http_request.headers.get("x-forwarded-proto") or http_request.url.scheme).split(",")[0].strip()
    forwarded_host = http_request.headers.get("x-forwarded-host")
    host = (forwarded_host or http_request.headers.get("host") or http_request.base_url.netloc).split(",")[0].strip()
    ws_scheme = "wss" if forwarded_proto == "https" else "ws"
    return f"{ws_scheme}://{host}/ws/live/{session_id}"


def create_live_session(
    request: LiveSessionStartRequest,
    http_request: Request | None = None,
) -> LiveSessionStartResponse:
    started_at = datetime.now(timezone.utc)
    session_id = f"dance_{uuid4()}"
    ws_url = build_ws_url(session_id, http_request)

    LIVE_SESSIONS[session_id] = {
        "session_id": session_id,
        "user_id": request.user_id,
        "dance_type": request.dance_type,
        "content_id": request.content_id,
        "status": "active",
        "started_at": started_at,
        "ended_at": None,
        "total_frames": 0,
        "elapsed_seconds": 0.0,
        "last_frame_at": None,
        "total_calories": 0.0,
        "latest_frame_index": None,
        "latest_frame_image_bytes": None,
        "latest_frame_mime_type": "image/jpeg",
        "latest_frame_width": None,
        "latest_frame_height": None,
        "latest_frame_received_at": None,
        "latest_frame_image_bytes_length": None,
        "latest_frame_payload_bytes": None,
        "latest_frame_transport": None,
    }

    LOGGER.info(
        "Created live session session_id=%s user_id=%s dance_type=%s content_id=%s ws_url=%s",
        session_id,
        request.user_id,
        request.dance_type,
        request.content_id,
        ws_url,
    )

    return LiveSessionStartResponse(
        session_id=session_id,
        user_id=request.user_id,
        status="active",
        started_at=started_at,
        ws_url=ws_url,
        dance_type=request.dance_type,
        content_id=request.content_id,
    )


def get_live_session(session_id: str) -> dict[str, object]:
    session = LIVE_SESSIONS.get(session_id)
    if session is None:
        LOGGER.warning("Live session not found session_id=%s active_sessions=%s", session_id, len(LIVE_SESSIONS))
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def require_active_session(session_id: str) -> dict[str, object]:
    session = get_live_session(session_id)
    if session["status"] != "active":
        LOGGER.warning(
            "Live session is not active session_id=%s status=%s",
            session_id,
            session["status"],
        )
        raise HTTPException(status_code=400, detail="Session is not active")
    return session


def calculate_dance_elapsed_seconds(
    session: dict[str, object],
    reference_time: datetime | None = None,
) -> float:
    elapsed_seconds = float(session.get("elapsed_seconds", 0.0))
    last_frame_at = session.get("last_frame_at")

    if reference_time is not None and isinstance(last_frame_at, datetime):
        tail_seconds = max(0.0, (reference_time - last_frame_at).total_seconds())
        if tail_seconds <= RECENT_ACTIVITY_TAIL_SECONDS:
            return round(elapsed_seconds + tail_seconds, 1)

    return round(elapsed_seconds, 1)


def record_live_session_frame(
    session_id: str,
    frame_index: object | None = None,
    image_bytes: bytes | None = None,
    payload_bytes: int | None = None,
    width: object | None = None,
    height: object | None = None,
    mime_type: str | None = None,
    transport: str | None = None,
) -> dict[str, object]:
    session = require_active_session(session_id)
    received_at = datetime.now(timezone.utc)
    last_frame_at = session.get("last_frame_at")
    frame_gap_seconds: float | None = None

    if isinstance(last_frame_at, datetime):
        frame_gap_seconds = max(0.0, (received_at - last_frame_at).total_seconds())
        if frame_gap_seconds <= FRAME_ACTIVITY_GAP_SECONDS:
            session["elapsed_seconds"] = float(session["elapsed_seconds"]) + frame_gap_seconds

    session["last_frame_at"] = received_at
    session["latest_frame_received_at"] = received_at
    session["total_frames"] = int(session["total_frames"]) + 1
    session["latest_frame_index"] = frame_index

    if isinstance(image_bytes, (bytes, bytearray)):
        normalized_image_bytes = bytes(image_bytes)
        session["latest_frame_image_bytes"] = normalized_image_bytes
        session["latest_frame_image_bytes_length"] = len(normalized_image_bytes)

    if isinstance(payload_bytes, int):
        session["latest_frame_payload_bytes"] = payload_bytes

    if isinstance(width, int):
        session["latest_frame_width"] = width

    if isinstance(height, int):
        session["latest_frame_height"] = height

    if isinstance(mime_type, str) and mime_type:
        session["latest_frame_mime_type"] = mime_type

    if isinstance(transport, str) and transport:
        session["latest_frame_transport"] = transport

    total_frames = int(session["total_frames"])

    if total_frames <= 5 or total_frames % 30 == 0:
        LOGGER.info(
            "Recorded live frame session_id=%s frame_index=%s total_frames=%s payload_bytes=%s image_bytes=%s size=%sx%s transport=%s gap_seconds=%s elapsed_seconds=%s",
            session_id,
            frame_index,
            total_frames,
            session.get("latest_frame_payload_bytes"),
            session.get("latest_frame_image_bytes_length"),
            session.get("latest_frame_width"),
            session.get("latest_frame_height"),
            session.get("latest_frame_transport"),
            frame_gap_seconds,
            session["elapsed_seconds"],
        )

    return session


def get_live_session_debug_snapshot(session_id: str) -> dict[str, object]:
    session = get_live_session(session_id)
    image_bytes = session.get("latest_frame_image_bytes")
    mime_type = str(session.get("latest_frame_mime_type") or "image/jpeg")
    has_frame = isinstance(image_bytes, (bytes, bytearray)) and bool(image_bytes)
    image_data_url = None

    if has_frame:
        image_data_url = f"data:{mime_type};base64," + base64.b64encode(bytes(image_bytes)).decode("ascii")

    return {
        "session_id": str(session["session_id"]),
        "status": str(session["status"]),
        "user_id": str(session["user_id"]),
        "dance_type": session.get("dance_type"),
        "content_id": session.get("content_id"),
        "started_at": session.get("started_at"),
        "ended_at": session.get("ended_at"),
        "total_frames": int(session["total_frames"]),
        "elapsed_seconds": float(session["elapsed_seconds"]),
        "total_calories": float(session["total_calories"]),
        "latest_frame_index": session.get("latest_frame_index"),
        "latest_frame_width": session.get("latest_frame_width"),
        "latest_frame_height": session.get("latest_frame_height"),
        "latest_frame_received_at": session.get("latest_frame_received_at"),
        "latest_frame_image_bytes_length": session.get("latest_frame_image_bytes_length"),
        "latest_frame_payload_bytes": session.get("latest_frame_payload_bytes"),
        "latest_frame_transport": session.get("latest_frame_transport"),
        "has_frame": has_frame,
        "image_data_url": image_data_url,
    }


def end_live_session(session_id: str) -> LiveSessionEndResponse:
    session = get_live_session(session_id)
    if session["status"] == "ended":
        LOGGER.warning("Live session already ended session_id=%s", session_id)
        raise HTTPException(status_code=400, detail="Session already ended")

    ended_at = datetime.now(timezone.utc)
    session["status"] = "ended"
    session["ended_at"] = ended_at
    session["elapsed_seconds"] = calculate_dance_elapsed_seconds(session, ended_at)

    LOGGER.info(
        "Ended live session session_id=%s total_frames=%s elapsed_seconds=%s total_calories=%s",
        session_id,
        session["total_frames"],
        session["elapsed_seconds"],
        session["total_calories"],
    )

    return LiveSessionEndResponse(
        session_id=str(session["session_id"]),
        status="ended",
        ended_at=ended_at,
        total_frames=int(session["total_frames"]),
        elapsed_seconds=float(session["elapsed_seconds"]),
        total_calories=float(session["total_calories"]),
        message="Session ended successfully.",
    )
