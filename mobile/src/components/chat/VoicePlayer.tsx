import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

type VoicePlayerValue = {
  activeId: string | null;
  playing: boolean;
  /** 0 to 1 for the active voice note. */
  progress: number;
  toggle: (id: string, url: string) => void;
};

const VoicePlayerContext = createContext<VoicePlayerValue | null>(null);

/** One audio player shared by every voice note of the conversation. */
export function VoicePlayerProvider({ children }: PropsWithChildren) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  const finished = status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05);

  const toggle = (id: string, url: string) => {
    if (id === activeId) {
      if (status.playing) {
        player.pause();
      } else {
        if (finished) void player.seekTo(0);
        player.play();
      }
      return;
    }
    player.replace({ uri: url });
    player.play();
    setActiveId(id);
  };

  const value: VoicePlayerValue = {
    activeId,
    playing: status.playing,
    progress: status.duration > 0 && !finished ? status.currentTime / status.duration : 0,
    toggle,
  };

  return <VoicePlayerContext.Provider value={value}>{children}</VoicePlayerContext.Provider>;
}

export function useVoicePlayer(): VoicePlayerValue {
  const value = useContext(VoicePlayerContext);
  if (!value) throw new Error('useVoicePlayer must be used inside <VoicePlayerProvider>');
  return value;
}
