import "dotenv/config";
import path from "node:path";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente obrigatória: ${name}`);
  return value;
}

function optional(name, fallback) {
  return process.env[name] ?? fallback;
}

function optionalNumber(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  openai: {
    apiKey: required("OPENAI_API_KEY"),
    model: optional("OPENAI_MODEL", "gpt-4.1"),
  },
  bot: {
    name: optional("BOT_NAME", "Futebot"),
    phone: process.env.BOT_PHONE,
  },
  database: {
    path: path.resolve(optional("DATABASE_PATH", "./data/futebot.db")),
  },
  whatsapp: {
    authStatePath: path.resolve(optional("AUTH_STATE_PATH", "./auth_info")),
  },
  stickers: {
    path: path.resolve(optional("STICKERS_PATH", "./stickers")),
  },
  behavior: {
    messagesPerResponse: optionalNumber("MESSAGES_PER_RESPONSE", 15),
    maxContextMessages: optionalNumber("MAX_CONTEXT_MESSAGES", 30),
  },
  openaiGeneration: {
    temperature: optionalNumber("OPENAI_TEMPERATURE", 1.05),
    frequencyPenalty: optionalNumber("OPENAI_FREQUENCY_PENALTY", 0.7),
    presencePenalty: optionalNumber("OPENAI_PRESENCE_PENALTY", 0.5),
  },
  worldCup: {
    until: optional("WORLD_CUP_UNTIL", "2026-07-20"),
    tournamentId: 16,
    alertPollIntervalMs: optionalNumber("WORLD_CUP_ALERT_POLL_MS", 30_000),
    get enabled() {
      if (process.env.WORLD_CUP_FOCUS === "false") return false;
      const end = new Date(`${this.until}T23:59:59`);
      return Number.isFinite(end.getTime()) && Date.now() <= end.getTime();
    },
  },
  logLevel: optional("LOG_LEVEL", "info"),
};
