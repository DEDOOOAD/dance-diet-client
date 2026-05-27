from pathlib import Path
import shutil


WORKSPACE = Path(r"C:\Users\USER-PC\Desktop\dance-diet-client-mobileV4-vision-stream\tmp\server_transport_updates")
SERVER = Path(r"C:\Users\USER-PC\Desktop\dance-diet-main_ver_0_2")


def copy_file(name: str, destination: Path) -> None:
    shutil.copy2(WORKSPACE / name, destination)


copy_file("live_frame_binary_protocol.py", SERVER / "servers" / "general_server" / "live_frame_binary_protocol.py")
copy_file("session_manager.py", SERVER / "servers" / "general_server" / "session_manager.py")
copy_file("socket_routes.py", SERVER / "servers" / "general_server" / "socket_routes.py")
copy_file("live_session_client_test.py", SERVER / "live_session_client_test.py")

server_path = SERVER / "servers" / "general_server" / "server.py"
server_text = server_path.read_text(encoding="utf-8")
server_text = server_text.replace(
    '<div class="stat"><span class="label">Payload Chars</span><span class="value" id="payloadChars">-</span></div>',
    '<div class="stat"><span class="label">Payload Bytes</span><span class="value" id="payloadChars">-</span></div>',
)
server_text = server_text.replace(
    "document.getElementById('payloadChars').textContent = data.latest_frame_base64_chars ?? '-';",
    "document.getElementById('payloadChars').textContent = data.latest_frame_payload_bytes ?? '-';",
)
server_path.write_text(server_text, encoding="utf-8")

readme_path = SERVER / "README.md"
readme_text = readme_path.read_text(encoding="utf-8")
old_block = """Example WebSocket flow:

1. Call `POST /api/live/session/start`
2. Read the returned `ws_url`
3. Connect to `WS /ws/live/{session_id}`
4. Send messages like:

```json
{
  "type": "frame",
  "frame_index": 1,
  "timestamp_ms": 33,
  "image_base64": "..."
}
```"""
new_block = """Example WebSocket flow:

1. Call `POST /api/live/session/start`
2. Read the returned `ws_url`
3. Connect to `WS /ws/live/{session_id}`
4. Send binary packets whose metadata looks like:

```json
{
  "type": "frame_binary",
  "version": 1,
  "session_id": "dance_...",
  "frame_index": 1,
  "captured_at": 1712900000000,
  "width": 320,
  "height": 240,
  "mime_type": "image/jpeg",
  "byte_length": 18234,
  "orientation": "portrait",
  "is_mirrored": false,
  "source_timestamp": 33
}
```

The packet layout is `DDF1` magic + version + metadata length + JSON metadata + raw JPEG bytes.
"""
if old_block in readme_text:
    readme_text = readme_text.replace(old_block, new_block)
readme_path.write_text(readme_text, encoding="utf-8")

print("SERVER_BINARY_TRANSPORT_UPDATED")
