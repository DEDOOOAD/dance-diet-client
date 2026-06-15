import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';

export type EncodedLiveFrame = {
  base64: string;
  byteLength: number;
  width: number;
  height: number;
};

let liveFrameJpegPlugin:
  | {
      call: (frame: Frame, options?: Record<string, number>) => EncodedLiveFrame | null;
    }
  | undefined
  | null = null;

function getLiveFrameJpegPlugin() {
  'worklet';

  if (liveFrameJpegPlugin !== null) {
    return liveFrameJpegPlugin;
  }

  liveFrameJpegPlugin = VisionCameraProxy.initFrameProcessorPlugin('encodeLiveFrameToJpeg', {}) as
    | {
        call: (frame: Frame, options?: Record<string, number>) => EncodedLiveFrame | null;
      }
    | undefined;

  return liveFrameJpegPlugin;
}

export function encodeLiveFrameToJpeg(frame: Frame, quality: number) {
  'worklet';

  const plugin = getLiveFrameJpegPlugin();
  if (plugin == null) {
    throw new Error('encodeLiveFrameToJpeg plugin is not available in this build.');
  }

  return plugin.call(frame, { quality });
}
