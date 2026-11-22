/** An error whose message is already safe and clear to show to the user. */
export class UserFacingError extends Error {}

/** Turns database/network errors into messages a non-technical person can act on. */
export function friendlyError(e: unknown): string {
  if (e instanceof UserFacingError) return e.message;
  const err = e as { code?: string; message?: string } | null;
  switch (err?.code) {
    case '23505': return 'That already exists. Choose a different one.';
    case '23503': return 'This item is linked to other records. Remove those first, then try again.';
    case '42501': return 'You do not have permission to do that.';
    case '23514': return 'One of the values is not allowed. Check the form and try again.';
  }
  if (err?.message?.toLowerCase().includes('failed to fetch')) return 'Network problem. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
