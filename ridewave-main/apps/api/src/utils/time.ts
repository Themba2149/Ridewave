// South Africa has no daylight saving: Africa/Johannesburg is a fixed UTC+2.
export const SAST_OFFSET_MS = 2 * 3600_000;
export const DAY_MS = 86_400_000;
export const startOfLocalDay = (ms: number) => Math.floor((ms + SAST_OFFSET_MS) / DAY_MS) * DAY_MS - SAST_OFFSET_MS;
export const localDate = (ms: number) => new Date(ms + SAST_OFFSET_MS).toISOString().slice(0, 10);
