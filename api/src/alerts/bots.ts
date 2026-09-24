import { regionName } from "../lib/bd";
import { randomId } from "../lib/random";
import { type AlertChannel, type Board, type BotKey, alertRegions, claimTelegramCode, deleteAlert, saveAlert } from "./repo";

/** One Telegram bot per board: @gklagbebot for GK Lagbe, @opponentlagbebot for Opponent Lagbe. */
export type Bot = {
  key: BotKey;
  board: Board;
  channel: AlertChannel;
  token?: string;
  username?: string;
  /** Words for this bot's replies. */
  what: string; // "a game near you needs a keeper"
  name: string; // "GK Lagbe"
};

export type BotEnv = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
  TELEGRAM_OPP_BOT_TOKEN?: string;
  TELEGRAM_OPP_BOT_USERNAME?: string;
};

export function botsFor(env: BotEnv): Record<BotKey, Bot> {
  return {
    gk: {
      key: "gk",
      board: "gk_needed",
      channel: "telegram",
      token: env.TELEGRAM_BOT_TOKEN,
      username: env.TELEGRAM_BOT_USERNAME,
      what: "a game near you needs a keeper",
      name: "GK Lagbe",
    },
    opp: {
      key: "opp",
      board: "opponent_needed",
      channel: "telegram_opp",
      token: env.TELEGRAM_OPP_BOT_TOKEN,
      username: env.TELEGRAM_OPP_BOT_USERNAME,
      what: "a team near you is looking for a match",
      name: "Opponent Lagbe",
    },
  };
}

export const botForBoard = (bots: Record<BotKey, Bot>, board: unknown): Bot =>
  board === "opponent_needed" ? bots.opp : bots.gk;

const placesText = (regions: string) =>
  regions ? regions.split(",").map((slug) => regionName(slug) ?? slug).join(", ") : "anywhere in Bangladesh";

/** Works out the bot's reply to one message; saves or removes the chat's alert as needed. */
export async function replyTo(db: D1Database, bot: Bot, chat: string, text: string, siteUrl: string): Promise<string> {
  const page = `${siteUrl}/alerts`;
  const start = /^\/start\s+([0-9A-Za-z]{1,32})/.exec(text);

  if (start) {
    const regions = await claimTelegramCode(db, start[1], chat, bot.key);
    if (regions === null) {
      return `That link doesn't work here — it's for another bot, or was already used on another Telegram account. Get a fresh one from ${page}`;
    }
    await saveAlert(db, randomId(12), bot.channel, chat, regions, bot.board);
    return (
      `Done. I'll message you when ${bot.what} in ${placesText(regions)}.\n\n` +
      `Change your places on the Alerts page and I'll follow along: ${page}\nSend /stop to turn alerts off.`
    );
  }
  if (/^\/status/.test(text)) {
    const regions = await alertRegions(db, bot.channel, chat);
    return regions === null
      ? `${bot.name} alerts are off for this chat. Turn them on from ${page}`
      : `I'm watching ${placesText(regions)} — you'll hear when ${bot.what}. /stop turns this off.`;
  }
  if (/^\/places/.test(text)) {
    return `Open the Alerts page, change your places, and these alerts update too: ${page}`;
  }
  if (/^\/stop/.test(text)) {
    await deleteAlert(db, bot.channel, chat);
    return `Stopped. You won't get any more ${bot.name} alerts. Turn them back on any time from ${page}`;
  }
  return (
    `I send ${bot.name} alerts: a message whenever ${bot.what}.\n\n` +
    "/status — which places I'm watching\n/places — how to change them\n/stop — no more alerts\n\n" +
    `To start, tap Connect Telegram on ${page}`
  );
}

export async function sendTelegram(token: string, chatId: string | number, text: string, fetcher: typeof fetch = fetch) {
  return fetcher(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
