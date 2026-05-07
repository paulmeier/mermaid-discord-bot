'use strict';

// Per-user cooldown window (milliseconds). Configurable via RENDER_COOLDOWN_MS.
const COOLDOWN_MS = parseInt(process.env.RENDER_COOLDOWN_MS || '10000', 10);

/** @type {Map<string, number>} userId → timestamp of last allowed render */
const userCooldowns = new Map();

// Periodically remove stale entries to prevent unbounded memory growth.
// .unref() ensures this timer doesn't keep the process alive on its own.
setInterval(() => {
  const cutoff = Date.now() - COOLDOWN_MS;
  for (const [userId, timestamp] of userCooldowns.entries()) {
    if (timestamp < cutoff) userCooldowns.delete(userId);
  }
}, 60_000).unref();

/**
 * Check whether a user is allowed to trigger a render right now.
 * If allowed, records the current timestamp for this user.
 *
 * @param {string} userId
 * @returns {{ allowed: boolean, remainingMs: number }}
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const last = userCooldowns.get(userId) ?? 0;
  const remainingMs = COOLDOWN_MS - (now - last);

  if (remainingMs > 0) {
    return { allowed: false, remainingMs };
  }

  userCooldowns.set(userId, now);
  return { allowed: true, remainingMs: 0 };
}

module.exports = { checkRateLimit, COOLDOWN_MS };
