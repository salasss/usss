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
