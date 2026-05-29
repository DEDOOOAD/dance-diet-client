# Vision Frame Stream Experiment

This copy keeps the `react-native-vision-camera` preview flow and sends JPEG snapshots as binary WebSocket packets:

- VisionCamera preview and capture
- Binary packets with JSON metadata + JPEG payload

## Packet format

Each packet uses:

- 4-byte magic: `DDF1`
- 1-byte version
- 4-byte little-endian metadata length
- UTF-8 JSON metadata
- Raw `image/jpeg` bytes

## Current capture flow

1. Open a VisionCamera live session.
2. Keep the live preview mounted.
3. Capture JPEG snapshots from VisionCamera.
4. Read the snapshot file as raw bytes.
5. Send the frame as a binary packet with metadata such as `session_id`, `frame_index`, `width`, `height`, and `mime_type`.

## Important limits

1. This build does not work in Expo Go. VisionCamera is a native module, so use a native dev build.
2. JPEG binary transport is smaller than base64 JSON, but capture and JPEG encoding time can still be the FPS bottleneck.
3. This path sends JPEG snapshots, not raw RGB frame buffers.

## Added pieces

- `react-native-vision-camera`
- `react-native-worklets-core`
- `expo-build-properties`
- `react-native-vision-camera` config plugin in `app.json`

## Typical commands

```bash
npx expo prebuild
npx expo run:android
```
