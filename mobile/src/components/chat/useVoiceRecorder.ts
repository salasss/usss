import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useEffect, useState } from 'react';

/** Longest voice note accepted by the backend is 10 minutes; stay well below. */
export const MAX_VOICE_MS = 5 * 60 * 1000;
const LEVELS = 32;

export type VoiceRecording = { uri: string; durationMs: number };

/** Records a voice note (AAC .m4a) and exposes live levels for the waveform. */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => {
      const status = recorder.getStatus();
      setElapsed(status.durationMillis);
      // Metering is in dBFS (-160 to 0); speech mostly sits above -50.
      const level = Math.max(0.08, Math.min(1, ((status.metering ?? -60) + 55) / 55));
      setLevels((current) => [...current.slice(1 - LEVELS), level]);
    }, 110);
    return () => clearInterval(timer);
  }, [recording, recorder]);

  /** Returns false when the microphone permission is refused. */
  const start = async (): Promise<boolean> => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return false;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setElapsed(0);
    setLevels([]);
    setRecording(true);
    return true;
  };

  /** Stops the recording; `null` when there is no usable file. */
  const stop = async (): Promise<VoiceRecording | null> => {
    const durationMs = recorder.getStatus().durationMillis;
    await recorder.stop();
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    const uri = recorder.uri;
    return uri && durationMs >= 500 ? { uri, durationMs } : null;
  };

  return { recording, elapsed, levels, start, stop };
}
