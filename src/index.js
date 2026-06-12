import { config } from "./config.js";
import { getDb } from "./memory/db.js";
import { logger } from "./logger.js";
import { getAvailableStickers } from "./stickers/registry.js";
import { startWhatsApp } from "./whatsapp/client.js";

async function main() {
  logger.info({ bot: config.bot.name }, "Iniciando Futebot");

  getDb();
  logger.info({ path: config.database.path }, "Banco de dados pronto");

  const stickers = getAvailableStickers();
  logger.info({ count: stickers.length, path: config.stickers.path }, "Stickers prontos");

  await startWhatsApp();
}

main().catch((error) => {
  logger.fatal({ error }, "Falha fatal");
  process.exit(1);
});
