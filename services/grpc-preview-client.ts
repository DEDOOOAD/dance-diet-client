import { getGeneralServerHttpBaseUrl } from '@/services/server-config';
import { NativeModules, Platform } from 'react-native';
import { Reader, Writer } from 'protobufjs/minimal';

const GRPC_UPLOAD_SERVICE = '/dance_diet.mobile.v1.DanceWorkoutIngestService';
const DEFAULT_GRPC_PORT = '50051';
const GRPC_UNAVAILABLE_MESSAGE =
  'Native gRPC is unavailable. Use an Expo development build on Android or iOS instead of Expo Go or web.';

type GrpcHeaders = Record<string, string>;

type NativeUnaryResult = {
  response?: Uint8Array;
};

type NativeUnaryCall = PromiseLike<NativeUnaryResult>;

type NativeGrpcClient = {
  setHost: (host: string) => void;
  setInsecure: (insecure: boolean) => void;
  initGrpcChannel: () => void;
  unaryCall: (method: string, data: Uint8Array, headers?: GrpcHeaders) => NativeUnaryCall;
};

/**
 *
 * ```proto
 * syntax = "proto3";
 *
 * package dance_diet.mobile.v1;
 *
 * service DanceWorkoutIngestService {
 *   rpc StartSession (StartSessionRequest) returns (StartSessionResponse);
 *   rpc UploadFrame (UploadFrameRequest) returns (UploadFrameResponse);
 *   rpc EndSession (EndSessionRequest) returns (EndSessionResponse);
 * }
 *
 * message StartSessionRequest {
 *   string user_id = 1;         // 운동을 시작한 사용자 id
 *   string dance_type = 2;      // 앱에서 선택한 춤 장르/카테고리
 *   string content_id = 3;      // 앱에서 선택한 콘텐츠 id
 *   string client_name = 4;     // 앱/클라이언트 식별자, 예: dance-diet-mobile
 *   string device_platform = 5; // ios / android / web
 *   int64 started_at_ms = 6;    // 운동 시작 시점의 로컬 밀리초 타임스탬프
 * }
 *
 * message StartSessionResponse {
 *   bool ok = 1;
 *   string session_id = 2;      // 서버가 발급했거나 그대로 돌려준 세션 id
 *   string note = 3;            // 선택적인 상태/디버그 메시지
 *   string accepted_at = 4;     // 서버 수신 시각이 있다면 그 값
 * }
 *
 * message UploadFrameRequest {
 *   string session_id = 1;      // 이 프레임이 속한 업로드 세션 id
 *   int32 frame_index = 2;      // 0부터 시작하는 프레임 순번
 *   int64 timestamp_ms = 3;     // 프레임 캡처 시점의 로컬 타임스탬프
 *   string image_base64 = 4;    // 실제로 캡처한 이미지 payload
 *   int32 width = 5;            // 프레임 가로 픽셀 수
 *   int32 height = 6;           // 프레임 세로 픽셀 수
 *   string mime_type = 7;       // image/jpeg, image/png 등 인코딩 형식
 * }
 *
 * message UploadFrameResponse {
 *   bool ok = 1;
 *   int32 frame_index = 2;      // 서버가 정상 수신했다고 응답한 프레임 번호
 *   string note = 3;            // 선택적인 상태/디버그 메시지
 *   string accepted_at = 4;     // 서버 수신 시각이 있다면 그 값
 * }
 *
 * message EndSessionRequest {
 *   string session_id = 1;      // 종료하려는 세션 id
 *   int32 total_frames = 2;     // 앱이 업로드 시도한 전체 프레임 수
 *   int64 ended_at_ms = 3;      // 세션 종료 시점의 로컬 타임스탬프
 * }
 *
 * message EndSessionResponse {
 *   bool ok = 1;
 *   string session_id = 2;
 *   int32 total_frames = 3;
 *   string note = 4;
 *   string accepted_at = 5;
 * }
 * ```
 */
export const APP_FIRST_GRPC_UPLOAD_PROTO = String.raw`syntax = "proto3";

package dance_diet.mobile.v1;

service DanceWorkoutIngestService {
  rpc StartSession (StartSessionRequest) returns (StartSessionResponse);
  rpc UploadFrame (UploadFrameRequest) returns (UploadFrameResponse);
  rpc EndSession (EndSessionRequest) returns (EndSessionResponse);
}

message StartSessionRequest {
  string user_id = 1;
  string dance_type = 2;
  string content_id = 3;
  string client_name = 4;
  string device_platform = 5;
  int64 started_at_ms = 6;
}

message StartSessionResponse {
  bool ok = 1;
  string session_id = 2;
  string note = 3;
  string accepted_at = 4;
}

message UploadFrameRequest {
  string session_id = 1;
  int32 frame_index = 2;
  int64 timestamp_ms = 3;
  string image_base64 = 4;
  int32 width = 5;
  int32 height = 6;
  string mime_type = 7;
}

message UploadFrameResponse {
  bool ok = 1;
  int32 frame_index = 2;
  string note = 3;
  string accepted_at = 4;
}

message EndSessionRequest {
  string session_id = 1;
  int32 total_frames = 2;
  int64 ended_at_ms = 3;
}

message EndSessionResponse {
  bool ok = 1;
  string session_id = 2;
  int32 total_frames = 3;
  string note = 4;
  string accepted_at = 5;
}`;

export type UploadSessionStartRequest = {
  /** proto 필드 1: string user_id */
  userId: string;
  /** proto 필드 2: string dance_type */
  danceType: string;
  /** proto 필드 3: string content_id */
  contentId: string;
  /** proto 필드 4: string client_name */
  clientName: string;
  /** proto 필드 5: string device_platform */
  devicePlatform: string;
  /** proto 필드 6: int64 started_at_ms */
  startedAtMs: number;
};

export type UploadSessionStartResponse = {
  ok: boolean;
  sessionId: string;
  note: string;
  acceptedAt: string;
};

export type UploadFrameRequest = {
  /** proto 필드 1: string session_id */
  sessionId: string;
  /** proto 필드 2: int32 frame_index */
  frameIndex: number;
  /** proto 필드 3: int64 timestamp_ms */
  timestampMs: number;
  /** proto 필드 4: string image_base64 */
  imageBase64: string;
  /** proto 필드 5: int32 width */
  width: number;
  /** proto 필드 6: int32 height */
  height: number;
  /** proto 필드 7: string mime_type */
  mimeType: string;
};

export type UploadFrameResponse = {
  ok: boolean;
  frameIndex: number;
  note: string;
  acceptedAt: string;
};

export type UploadSessionEndRequest = {
  /** proto 필드 1: string session_id */
  sessionId: string;
  /** proto 필드 2: int32 total_frames */
  totalFrames: number;
  /** proto 필드 3: int64 ended_at_ms */
  endedAtMs: number;
};

export type UploadSessionEndResponse = {
  ok: boolean;
  sessionId: string;
  totalFrames: number;
  note: string;
  acceptedAt: string;
};

let grpcClientInstance: NativeGrpcClient | null = null;
let activeGrpcTarget: string | null = null;

function hasUrlScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function withDefaultPort(value: string) {
  if (/:\d+$/.test(value) || /^\[[^\]]+\]:\d+$/.test(value)) {
    return value;
  }

  return `${value}:${DEFAULT_GRPC_PORT}`;
}

function normalizeGrpcTarget(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!hasUrlScheme(trimmed)) {
    return withDefaultPort(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.host || withDefaultPort(parsed.hostname);
  } catch {
    return trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  }
}

function getDefaultGrpcTarget() {
  try {
    const parsed = new URL(getGeneralServerHttpBaseUrl());
    return `${parsed.hostname}:${DEFAULT_GRPC_PORT}`;
  } catch {
    return `127.0.0.1:${DEFAULT_GRPC_PORT}`;
  }
}

export function getPreviewGrpcTarget() {
  const explicitTarget = process.env.EXPO_PUBLIC_GRPC_TARGET?.trim();
  if (explicitTarget) {
    return normalizeGrpcTarget(explicitTarget) ?? getDefaultGrpcTarget();
  }

  const explicitHost = process.env.EXPO_PUBLIC_GRPC_HOST?.trim();
  if (explicitHost) {
    return normalizeGrpcTarget(explicitHost) ?? getDefaultGrpcTarget();
  }

  const explicitPort = process.env.EXPO_PUBLIC_GRPC_PORT?.trim();
  if (explicitPort) {
    try {
      const parsed = new URL(getGeneralServerHttpBaseUrl());
      return `${parsed.hostname}:${explicitPort}`;
    } catch {
      return `127.0.0.1:${explicitPort}`;
    }
  }

  return getDefaultGrpcTarget();
}

export function isPreviewGrpcAvailable() {
  return Platform.OS !== 'web' && Boolean(NativeModules.Grpc);
}

export function getPreviewGrpcUnavailableMessage() {
  return GRPC_UNAVAILABLE_MESSAGE;
}

function getNativeGrpcClientConstructor(): new () => NativeGrpcClient {
  const runtimeModule = require('@krishnafkh/react-native-grpc') as {
    GrpcClient: new () => NativeGrpcClient;
  };

  return runtimeModule.GrpcClient;
}

function ensureGrpcClient() {
  if (!isPreviewGrpcAvailable()) {
    throw new Error(GRPC_UNAVAILABLE_MESSAGE);
  }

  if (!grpcClientInstance) {
    const GrpcClient = getNativeGrpcClientConstructor();
    grpcClientInstance = new GrpcClient();
  }

  return grpcClientInstance;
}

export function preparePreviewGrpcClient() {
  const client = ensureGrpcClient();
  const target = getPreviewGrpcTarget();

  if (activeGrpcTarget !== target) {
    activeGrpcTarget = target;
  }

  client.setHost(target);
  client.setInsecure(true);
  client.initGrpcChannel();
}

function decodeMessage<T>(input: Uint8Array, decoder: (reader: Reader, length?: number) => T) {
  return decoder(Reader.create(input), input.length);
}

function encodeStartSessionRequest(message: UploadSessionStartRequest) {
  const writer = Writer.create();

  if (message.userId) {
    writer.uint32(10).string(message.userId);
  }

  if (message.danceType) {
    writer.uint32(18).string(message.danceType);
  }

  if (message.contentId) {
    writer.uint32(26).string(message.contentId);
  }

  if (message.clientName) {
    writer.uint32(34).string(message.clientName);
  }

  if (message.devicePlatform) {
    writer.uint32(42).string(message.devicePlatform);
  }

  if (message.startedAtMs !== 0) {
    writer.uint32(48).int64(message.startedAtMs);
  }

  return writer.finish();
}

function decodeStartSessionResponse(reader: Reader, length?: number): UploadSessionStartResponse {
  const end = length === undefined ? reader.len : reader.pos + length;
  const message: UploadSessionStartResponse = {
    ok: false,
    sessionId: '',
    note: '',
    acceptedAt: '',
  };

  while (reader.pos < end) {
    const tag = reader.uint32();

    switch (tag >>> 3) {
      case 1:
        message.ok = reader.bool();
        break;
      case 2:
        message.sessionId = reader.string();
        break;
      case 3:
        message.note = reader.string();
        break;
      case 4:
        message.acceptedAt = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return message;
}

function encodeUploadFrameRequest(message: UploadFrameRequest) {
  const writer = Writer.create();

  if (message.sessionId) {
    writer.uint32(10).string(message.sessionId);
  }

  if (message.frameIndex !== 0) {
    writer.uint32(16).int32(message.frameIndex);
  }

  if (message.timestampMs !== 0) {
    writer.uint32(24).int64(message.timestampMs);
  }

  if (message.imageBase64) {
    writer.uint32(34).string(message.imageBase64);
  }

  if (message.width !== 0) {
    writer.uint32(40).int32(message.width);
  }

  if (message.height !== 0) {
    writer.uint32(48).int32(message.height);
  }

  if (message.mimeType) {
    writer.uint32(58).string(message.mimeType);
  }

  return writer.finish();
}

function decodeUploadFrameResponse(reader: Reader, length?: number): UploadFrameResponse {
  const end = length === undefined ? reader.len : reader.pos + length;
  const message: UploadFrameResponse = {
    ok: false,
    frameIndex: 0,
    note: '',
    acceptedAt: '',
  };

  while (reader.pos < end) {
    const tag = reader.uint32();

    switch (tag >>> 3) {
      case 1:
        message.ok = reader.bool();
        break;
      case 2:
        message.frameIndex = reader.int32();
        break;
      case 3:
        message.note = reader.string();
        break;
      case 4:
        message.acceptedAt = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return message;
}

function encodeEndSessionRequest(message: UploadSessionEndRequest) {
  const writer = Writer.create();

  if (message.sessionId) {
    writer.uint32(10).string(message.sessionId);
  }

  if (message.totalFrames !== 0) {
    writer.uint32(16).int32(message.totalFrames);
  }

  if (message.endedAtMs !== 0) {
    writer.uint32(24).int64(message.endedAtMs);
  }

  return writer.finish();
}

function decodeEndSessionResponse(reader: Reader, length?: number): UploadSessionEndResponse {
  const end = length === undefined ? reader.len : reader.pos + length;
  const message: UploadSessionEndResponse = {
    ok: false,
    sessionId: '',
    totalFrames: 0,
    note: '',
    acceptedAt: '',
  };

  while (reader.pos < end) {
    const tag = reader.uint32();

    switch (tag >>> 3) {
      case 1:
        message.ok = reader.bool();
        break;
      case 2:
        message.sessionId = reader.string();
        break;
      case 3:
        message.totalFrames = reader.int32();
        break;
      case 4:
        message.note = reader.string();
        break;
      case 5:
        message.acceptedAt = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
        break;
    }
  }

  return message;
}

async function unaryCall<TResponse>(
  method: string,
  payload: Uint8Array,
  decode: (reader: Reader, length?: number) => TResponse
) {
  const client = ensureGrpcClient();
  const result = await client.unaryCall(method, payload, {});

  if (!result.response) {
    throw new Error(`No response received from ${method}`);
  }

  return decodeMessage(result.response, decode);
}

export async function startPreviewUploadSession(request: UploadSessionStartRequest) {
  return unaryCall(`${GRPC_UPLOAD_SERVICE}/StartSession`, encodeStartSessionRequest(request), decodeStartSessionResponse);
}

export async function uploadPreviewFrame(request: UploadFrameRequest) {
  return unaryCall(`${GRPC_UPLOAD_SERVICE}/UploadFrame`, encodeUploadFrameRequest(request), decodeUploadFrameResponse);
}

export async function endPreviewUploadSession(request: UploadSessionEndRequest) {
  return unaryCall(`${GRPC_UPLOAD_SERVICE}/EndSession`, encodeEndSessionRequest(request), decodeEndSessionResponse);
}
