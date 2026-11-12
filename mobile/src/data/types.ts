export type Member = {
  userId: string;
  seat: 1 | 2;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: string;
};

export type Invite = {
  code: string;
  expiresAt: string;
  expired: boolean;
};

export type Couple = {
  id: string;
  /** Both seats are taken: the bubble is open. */
  complete: boolean;
  invite: Invite | null;
  togetherSince: string | null;
  createdAt: string;
  members: Member[];
};

/** Current mood of one partner, 0 to 100 on each axis. */
export type Mood = {
  userId: string;
  energy: number;
  mood: number;
  updatedAt: string;
};

export type EventColor = 'peach' | 'rose' | 'lilac' | 'butter' | 'mint';

export type CalendarEvent = {
  id: string;
  title: string;
  startsAt: string;
  color: EventColor;
  createdBy: string | null;
};

export type NewEvent = {
  title: string;
  startsAt: string;
  color: EventColor;
};

export type MemoryCategory = 'trip' | 'night' | 'date' | 'simple';

export type Memory = {
  id: string;
  title: string;
  note: string | null;
  category: MemoryCategory;
  /** Path in the private couple-media bucket. */
  photoPath: string;
  takenOn: string;
  isFavorite: boolean;
  createdAt: string;
  createdBy: string | null;
};
