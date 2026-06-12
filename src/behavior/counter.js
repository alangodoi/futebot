const groupCounters = new Map();

export function trackGroupMessage(groupJid) {
  const count = (groupCounters.get(groupJid) ?? 0) + 1;
  groupCounters.set(groupJid, count);
  return count;
}
