from __future__ import annotations

import json
import struct
from typing import Any


LIVE_BINARY_PROTOCOL_MAGIC = b"DDF1"
LIVE_BINARY_PROTOCOL_VERSION = 1
HEADER_SIZE = 9


class BinaryFrameProtocolError(ValueError):
    pass


def build_live_binary_frame_packet(metadata: dict[str, Any], payload: bytes) -> bytes:
    metadata_bytes = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return (
        LIVE_BINARY_PROTOCOL_MAGIC
        + bytes([LIVE_BINARY_PROTOCOL_VERSION])
        + struct.pack("<I", len(metadata_bytes))
        + metadata_bytes
        + payload
    )


def parse_live_binary_frame_packet(packet: bytes) -> tuple[dict[str, Any], bytes]:
    if len(packet) < HEADER_SIZE:
        raise BinaryFrameProtocolError("Binary frame packet is too small.")

    if packet[:4] != LIVE_BINARY_PROTOCOL_MAGIC:
        raise BinaryFrameProtocolError("Binary frame packet magic does not match DDF1.")

    version = packet[4]
    if version != LIVE_BINARY_PROTOCOL_VERSION:
        raise BinaryFrameProtocolError(f"Unsupported binary frame packet version: {version}.")

    metadata_length = struct.unpack("<I", packet[5:9])[0]
    metadata_start = HEADER_SIZE
    metadata_end = metadata_start + metadata_length
    if metadata_end > len(packet):
        raise BinaryFrameProtocolError("Binary frame packet metadata length is invalid.")

    metadata_raw = packet[metadata_start:metadata_end]
    try:
        metadata = json.loads(metadata_raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise BinaryFrameProtocolError("Binary frame packet metadata is not valid UTF-8 JSON.") from exc

    if not isinstance(metadata, dict):
        raise BinaryFrameProtocolError("Binary frame packet metadata must decode to a JSON object.")

    if metadata.get("type") != "frame_binary":
        raise BinaryFrameProtocolError("Binary frame packet metadata type must be 'frame_binary'.")

    payload = packet[metadata_end:]
    declared_byte_length = metadata.get("byte_length")
    if isinstance(declared_byte_length, int) and declared_byte_length != len(payload):
        raise BinaryFrameProtocolError("Binary frame packet byte_length does not match the payload size.")

    metadata.setdefault("version", version)
    metadata.setdefault("byte_length", len(payload))
    return metadata, payload
