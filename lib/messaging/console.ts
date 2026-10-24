// Phase 1 stub: prints the SMS to the server console instead of sending it.
// Rule 2: the phone number is masked to its last 3 digits, even here.
import type { Messenger } from "./index";

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length <= 3 ? "***" : `***${digits.slice(-3)}`;
}

export const consoleMessenger: Messenger = {
  async sendSms(to, text) {
    console.log(`[SMS stub] to ${maskPhone(to)}:\n${text}`);
  },
};
