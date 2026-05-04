from __future__ import annotations

import base64
import binascii
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from servers.general_server.live_frame_binary_protocol import (
    BinaryFrameProtocolError,
    parse_live_binary_frame_packet,
)
from servers.general_server.session_manager import (
    calculate_dance_elapsed_seconds,
    record_live_session_frame,
    require_active_session,
)
from servers.general_server.socket_manager import connect, disconnect


LOGGER = logging.getLogger("uvicorn.error")
router = APIRouter()


def _optional_int(value: object | None) -> int | None:
    return value if isinstance(value, int) else None


async def _send_error(websocket: WebSocket, session_id: str, message: str) -> None:
    await websocket.send_json(
        {
            "type": "error",
            "session_id": session_id,
            "message": message,
        }
    )


async def _record_and_ack_frame(
    websocket: WebSocket,
    *,
    session_id: str,
    frame_index: int | None,
    image_bytes: bytes,
    payload_bytes: int,
    width: int | None,
    height: int | None,
    mime_type: str,
    transport: str,
) -> None:
    if frame_index is not None and (frame_index < 5 or frame_index % 30 == 0):
        LOGGER.info(
            "Live frame received session_id=%s frame_index=%s payload_bytes=%s image_bytes=%s size=%sx%s transport=%s mime_type=%s",
            session_id,
            frame_index,
            payload_bytes,
            len(image_bytes),
            width,
            height,
            transport,
            mime_type,
        )

    session = record_live_session_frame(
        session_id,
        frame_index=frame_index,
        image_bytes=image_bytes,
        payload_bytes=payload_bytes,
        width=width,
        height=height,
        mime_type=mime_type,
        transport=transport,
    )
    ack_payload = {
        "type": "frame_ack",
        "session_id": session_id,
        "frame_index": frame_index,
        "total_frames": session["total_frames"],
        "elapsed_seconds": calculate_dance_elapsed_seconds(session),
        "total_calories": session["total_calories"],
        "payload_bytes": payload_bytes,
        "transport": transport,
    }
    await websocket.send_json(ack_payload)

    total_frames = int(session["total_frames"])
    if total_frames <= 5 or total_frames % 30 == 0:
        LOGGER.info(
            "Live frame ack sent session_id=%s frame_index=%s total_frames=%s elapsed_seconds=%s transport=%s",
            session_id,
            frame_index,
            ack_payload["total_frames"],
            ack_payload["elapsed_seconds"],
            transport,
        )


async def _handle_binary_frame(
    websocket: WebSocket,
    *,
    session_id: str,
    payload_bytes: bytes,
) -> None:
    try:
        metadata, image_bytes = parse_live_binary_frame_packet(payload_bytes)
    except BinaryFrameProtocolError as exc:
        LOGGER.warning(
            "Invalid binary frame packet session_id=%s error=%s",
            session_id,
            exc,
        )
        await _send_error(websocket, session_id, str(exc))
        return

    packet_session_id = metadata.get("session_id")
    if isinstance(packet_session_id, str) and packet_session_id != session_id:
        await _send_error(websocket, session_id, "Binary frame session_id does not match the socket session.")
        return

    frame_index = _optional_int(metadata.get("frame_index"))
    width = _optional_int(metadata.get("width"))
    height = _optional_int(metadata.get("height"))
    mime_type = str(metadata.get("mime_type") or "image/jpeg")

    await _record_and_ack_frame(
        websocket,
        session_id=session_id,
        frame_index=frame_index,
        image_bytes=image_bytes,
        payload_bytes=len(payload_bytes),
        width=width,
        height=height,
        mime_type=mime_type,
        transport="binary_jpeg",
    )


async def _handle_text_message(
    websocket: WebSocket,
    *,
    session_id: str,
    payload_text: str,
) -> None:
    try:
        payload = json.loads(payload_text)
    except json.JSONDecodeError:
        LOGGER.warning("Invalid JSON WebSocket message session_id=%s", session_id)
        await _send_error(websocket, session_id, "Invalid JSON WebSocket message.")
        return

    message_type = str(payload.get("type", "unknown"))

    if message_type == "frame":
        image_base64 = payload.get("image_base64")
        if not isinstance(image_base64, str) or not image_base64:
            await _send_error(websocket, session_id, "Missing image_base64 in text frame payload.")
            return

        try:
            image_bytes = base64.b64decode(image_base64, validate=False)
        except (ValueError, binascii.Error):
            await _send_error(websocket, session_id, "image_base64 is not valid base64 data.")
            return

        await _record_and_ack_frame(
            websocket,
            session_id=session_id,
            frame_index=_optional_int(payload.get("frame_index")),
            image_bytes=image_bytes,
            payload_bytes=len(payload_text.encode("utf-8")),
            width=_optional_int(payload.get("width")),
            height=_optional_int(payload.get("height")),
            mime_type=str(payload.get("mime_type") or "image/jpeg"),
            transport="json_base64",
        )
        return

    if message_type == "ping":
        LOGGER.info("Live ping received session_id=%s", session_id)
        await websocket.send_json({"type": "pong", "session_id": session_id})
        return

    LOGGER.warning(
        "Unsupported WebSocket text message session_id=%s type=%s keys=%s",
        session_id,
        message_type,
        sorted(payload.keys()),
    )
    await _send_error(websocket, session_id, "Unsupported message type")


@router.websocket("/ws/live/{session_id}")
async def live_session_socket(websocket: WebSocket, session_id: str) -> None:
    client_host = websocket.client.host if websocket.client else "unknown"
    client_port = websocket.client.port if websocket.client else "unknown"

    LOGGER.info(
        "Live WebSocket requested session_id=%s client=%s:%s",
        session_id,
        client_host,
        client_port,
    )

    require_active_session(session_id)
    await connect(session_id, websocket)

    try:
        await websocket.send_json(
            {
                "type": "session_ready",
                "session_id": session_id,
                "message": "WebSocket connected",
            }
        )
        LOGGER.info("Live WebSocket ready session_id=%s client=%s:%s", session_id, client_host, client_port)

        while True:
            message = await websocket.receive()
            message_type = message.get("type")

            if message_type == "websocket.disconnect":
                raise WebSocketDisconnect(code=1000)

            bytes_payload = message.get("bytes")
            if isinstance(bytes_payload, (bytes, bytearray)):
                await _handle_binary_frame(websocket, session_id=session_id, payload_bytes=bytes(bytes_payload))
                continue

            text_payload = message.get("text")
            if isinstance(text_payload, str):
                await _handle_text_message(websocket, session_id=session_id, payload_text=text_payload)
                continue

            LOGGER.warning(
                "Unsupported WebSocket message envelope session_id=%s keys=%s",
                session_id,
                sorted(message.keys()),
            )
            await _send_error(websocket, session_id, "Unsupported WebSocket message envelope")
    except WebSocketDisconnect as exc:
        LOGGER.warning(
            "Live WebSocket disconnected session_id=%s code=%s reason=%s client=%s:%s",
            session_id,
            getattr(exc, "code", None),
            getattr(exc, "reason", None),
            client_host,
            client_port,
        )
    except Exception:
        LOGGER.exception(
            "Unhandled live WebSocket error session_id=%s client=%s:%s",
            session_id,
            client_host,
            client_port,
        )
        try:
            await websocket.send_json(
                {
                    "type": "error",
                    "session_id": session_id,
                    "message": "Internal server error while handling live session.",
                }
            )
        except Exception:
            LOGGER.exception("Failed to send terminal error payload session_id=%s", session_id)
    finally:
        disconnect(session_id)
