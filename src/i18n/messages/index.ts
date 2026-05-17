import type { Locale } from "../locale";
import en, { type MessageTree } from "./en";
import vi from "./vi";

const messages: Record<Locale, MessageTree> = { en, vi: vi as MessageTree };

export type TranslationKey = string;

export function getMessages(locale: Locale) {
  return messages[locale];
}

export function translate(locale: Locale, key: TranslationKey): string {
  const parts = key.split(".");
  let node: unknown = messages[locale];

  for (const part of parts) {
    if (node === null || typeof node !== "object" || !(part in node)) {
      return key;
    }
    node = (node as Record<string, unknown>)[part];
  }

  return typeof node === "string" ? node : key;
}
