export function formatBotMessage(text) {
  if (!text) return null;

  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim() || null;
}
