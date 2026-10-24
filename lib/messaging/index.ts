// Sending SMS. Phase 1 prints to the server console (console.ts); Phase 2 plugs a Ghanaian
// aggregator in behind the same interface (Prompt 14).
import { consoleMessenger } from "./console";

export interface Messenger {
  sendSms(to: string, text: string): Promise<void>;
}

export function getMessenger(): Messenger {
  return consoleMessenger;
}

/** For tests: keeps messages in memory. */
export function memoryMessenger(): Messenger & { sent: { to: string; text: string }[] } {
  const sent: { to: string; text: string }[] = [];
  return {
    sent,
    async sendSms(to, text) {
      sent.push({ to, text });
    },
  };
}
