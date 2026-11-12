import type { Couple } from '@/data/types';

/** Error returned by the usss backend: `{ error: <code>, message }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type CoupleDto = {
  id: string;
  complete: boolean;
  invite: { code: string; expires_at: string; expired: boolean } | null;
  together_since: string | null;
  created_at: string;
  members: {
    user_id: string;
    seat: 1 | 2;
    display_name: string;
    avatar_url: string | null;
    joined_at: string;
  }[];
};

function toCouple(dto: CoupleDto): Couple {
  return {
    id: dto.id,
    complete: dto.complete,
    invite: dto.invite
      ? { code: dto.invite.code, expiresAt: dto.invite.expires_at, expired: dto.invite.expired }
      : null,
    togetherSince: dto.together_since,
    createdAt: dto.created_at,
    members: dto.members.map((member) => ({
      userId: member.user_id,
      seat: member.seat,
      displayName: member.display_name,
      avatarUrl: member.avatar_url,
      joinedAt: member.joined_at,
    })),
  };
}

export type Api = ReturnType<typeof createApi>;

/** REST client of the usss backend, authenticated with the Supabase access token. */
export function createApi(baseUrl: string, getToken: () => Promise<string | null>) {
  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const token = await getToken();
    if (!token) throw new ApiError(401, 'unauthorized', 'not signed in');

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'network', 'network unreachable');
    }

    const text = await response.text();
    const json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    if (!response.ok) {
      throw new ApiError(
        response.status,
        typeof json?.error === 'string' ? json.error : 'http_error',
        typeof json?.message === 'string' ? json.message : response.statusText,
      );
    }
    return json as T;
  }

  const couple = (path: string, method: 'GET' | 'POST', body?: unknown) =>
    request<{ couple: CoupleDto | null }>(method, path, body).then((result) =>
      result.couple ? toCouple(result.couple) : null,
    );

  const required = (value: Couple | null) => {
    if (!value) throw new ApiError(500, 'http_error', 'missing couple in response');
    return value;
  };

  return {
    getCouple: () => couple('/couple', 'GET'),
    createCouple: () => couple('/couple', 'POST').then(required),
    joinCouple: (code: string) => couple('/couple/join', 'POST', { code }).then(required),
    renewInvite: () => couple('/couple/invite', 'POST').then(required),
    /** WebSocket endpoint of the realtime channel. */
    socketUrl: () => `${baseUrl.replace(/^http/, 'ws')}/ws`,
    getToken,
  };
}

/** French message for a backend error code. */
export function describeApiError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Une erreur est survenue. Réessaie dans un instant.';
  switch (error.code) {
    case 'network':
      return 'Connexion impossible. Vérifie ta connexion internet.';
    case 'invite_not_found':
      return "Ce code n'existe pas ou a déjà servi.";
    case 'invite_expired':
      return 'Ce code a expiré : demande-en un nouveau.';
    case 'couple_complete':
      return 'Cette bulle a déjà ses deux membres.';
    case 'already_paired':
      return 'Tu fais déjà partie d’une bulle.';
    case 'bad_request':
      return 'Un code contient 8 lettres ou chiffres.';
    case 'unauthorized':
      return 'Ta session a expiré, reconnecte-toi.';
    case 'not_configured':
      return "Le serveur usss n'est pas configuré dans cette version de l'app.";
    default:
      return 'Une erreur est survenue. Réessaie dans un instant.';
  }
}
