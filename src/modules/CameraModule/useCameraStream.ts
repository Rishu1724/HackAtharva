import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraView } from 'expo-camera';

export type DriverFlag = 'DROWSY' | 'DISTRACTED' | 'NORMAL';

type AnalyzeFrameResponse = {
  flag?: DriverFlag;
};

type UseCameraStreamParams = {
  backendUrl: string;
  driverId: string;
  intervalMs?: number;
};

export function useCameraStream({ backendUrl, driverId, intervalMs = 1000 }: UseCameraStreamParams) {
  const cameraRef = useRef<CameraView | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);

  const [flag, setFlag] = useState<DriverFlag>('NORMAL');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);

  const postFrame = useCallback(
    async (base64Image: string) => {
      const response = await fetch(`${backendUrl}/ai/analyze-frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId,
          imageBase64: base64Image,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Frame upload failed: ${response.status}`);
      }

      const data = (await response.json()) as AnalyzeFrameResponse;
      setFlag(data.flag ?? 'NORMAL');
      setLastSentAt(new Date().toISOString());
    },
    [backendUrl, driverId]
  );

  const captureAndSendFrame = useCallback(async () => {
    if (!cameraRef.current || inFlightRef.current) {
      return;
    }

    try {
      inFlightRef.current = true;
      setError(null);

      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.4,
        skipProcessing: true,
      });

      if (!photo.base64) {
        throw new Error('Could not encode frame to base64');
      }

      await postFrame(photo.base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stream camera frame');
    } finally {
      inFlightRef.current = false;
    }
  }, [postFrame]);

  const stopStreaming = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStreaming = useCallback(async () => {
    if (isStreaming) {
      return;
    }

    setIsStreaming(true);
    await captureAndSendFrame();

    intervalRef.current = setInterval(() => {
      captureAndSendFrame();
    }, intervalMs);
  }, [captureAndSendFrame, intervalMs, isStreaming]);

  const toggleStream = useCallback(async () => {
    if (isStreaming) {
      stopStreaming();
    } else {
      await startStreaming();
    }
  }, [isStreaming, startStreaming, stopStreaming]);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    cameraRef,
    flag,
    isStreaming,
    error,
    lastSentAt,
    startStreaming,
    stopStreaming,
    toggleStream,
  };
}
