const DAY = 86_400_000;

/** French capitalizes the first word only: "vendredi 13 novembre" → "Vendredi 13 novembre". */
export function capitalize(text: string): string {
  return text ? text[0].toLocaleUpperCase('fr') + text.slice(1) : text;
}

const startOfDay = (time: number) => {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** "Aujourd'hui", "Hier", or "lundi 3 novembre". */
export function dayLabel(iso: string, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso).getTime())) / DAY);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  return capitalize(new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function sameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a).getTime()) === startOfDay(new Date(b).getTime());
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** 0:07, 1:32 */
export function durationLabel(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Stable pseudo-random bar heights (0.18 to 1) for a voice note. */
export function waveform(seed: string, count = 28): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Array.from({ length: count }, (_, index) => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    const random = (hash >>> 0) / 4294967295;
    const envelope = 0.55 + 0.45 * Math.sin((index / count) * Math.PI);
    return Math.max(0.18, Math.min(1, random * envelope + 0.15));
  });
}
