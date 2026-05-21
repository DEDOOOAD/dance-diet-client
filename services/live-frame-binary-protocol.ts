export const LIVE_BINARY_PROTOCOL_MAGIC = 'DDF1';
export const LIVE_BINARY_PROTOCOL_VERSION = 1;

const HEADER_SIZE = 9;
const textEncoder = new TextEncoder();
const headerMagicBytes = new Uint8Array([0x44, 0x44, 0x46, 0x31]);

export type BinaryFrameMetadata = {
  type: 'frame_binary';
  session_id: string;
  frame_index: number;
};

function toUint8Array(payload: ArrayBuffer | Uint8Array) {
  if (payload instanceof Uint8Array) {
    return payload;
  }

  return new Uint8Array(payload);
}

// Packet layout: 4-byte magic + 1-byte version + 4-byte metadata length + JSON metadata + raw JPEG bytes.
export function buildLiveBinaryFramePacket(
  metadata: BinaryFrameMetadata,
  payload: ArrayBuffer | Uint8Array
) {
  const metadataBytes = textEncoder.encode(JSON.stringify(metadata));
  const payloadBytes = toUint8Array(payload);
  const packet = new Uint8Array(HEADER_SIZE + metadataBytes.byteLength + payloadBytes.byteLength);

  packet.set(headerMagicBytes, 0);
  packet[4] = LIVE_BINARY_PROTOCOL_VERSION;

  const view = new DataView(packet.buffer);
  view.setUint32(5, metadataBytes.byteLength, true);

  packet.set(metadataBytes, HEADER_SIZE);
  packet.set(payloadBytes, HEADER_SIZE + metadataBytes.byteLength);

  return packet.buffer;
}

export function formatBinaryPayloadBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}
