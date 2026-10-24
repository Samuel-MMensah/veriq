// Screen 13: the USSD menu (Phase 1, tested; Phase 2 goes live through an aggregator).
// Stateless: the aggregator sends every answer so far as "1*1*2". Replies start with "CON " (ask
// more) or "END " (finish). Results go out by SMS through lib/messaging.
// Rule 2: the phone number is used to send the SMS and, hashed, as the device id for a report.
// It is never stored or logged in full.
import { createHash } from "node:crypto";
import { getSearchCandidates, listInsurers, listServices } from "@/lib/db/queries";
import type { Db } from "@/lib/db/supabase";
import { haversineKm } from "@/lib/geo";
import type { Messenger } from "@/lib/messaging";
import { submitReport } from "@/lib/reports/submit";
import { AREAS, SERVICE_CHIPS, type Area } from "@/lib/view/catalog";
import { buildResults, type ResultCard } from "@/lib/view/results";

export const ROOT_MENU = "VERIQ HEALTH\n1 Find hospital\n2 Is my card taken?\n3 Report refusal\n4 Emergency numbers";

const NOT_ON_MENU = "END Sorry, that isn't on the menu. Please dial again.";
const NO_PHONE = "END Sorry, we couldn't read your phone number. Please dial again.";
const EMERGENCY = "END Emergency: call 112\nAmbulance: call 193\nYour card never stops emergency care.";
const RADIUS_KM = 5;
const SMS_RESULTS = 3;
const REPORT_CHOICES = 5;
const USSD_AREAS = AREAS.slice(0, 8);

export type UssdDeps = {
  readDb: Db;
  serviceDb: Db;
  messenger: Messenger;
  /** REPORT_HASH_SECRET, for rule A. */
  secret: string;
  now: Date;
};

type Card = { slug: string | null; name: string };
/** A chosen value and the answers after it; a string is the reply to send instead. */
type Step<T> = { value: T; rest: string[] };

const numbered = (title: string, items: string[]) => `CON ${title}\n${items.map((x, i) => `${i + 1} ${x}`).join("\n")}`;
const pick = <T>(items: T[], answer: string | undefined): T | undefined =>
  answer && /^\d{1,2}$/.test(answer) ? items[Number(answer) - 1] : undefined;

/** SMS can't show "¢" on every phone, so cedis are written GHS there. */
const smsText = (s: string) => s.replace(/GH¢/g, "GHS");

/** Card choice: NHIS, Private (then which), and optionally No card. */
function cardStep(answers: string[], withCash: boolean): Step<Card> | string {
  const [first, second, ...more] = answers;
  if (first === undefined) return withCash ? "CON Your card?\n1 NHIS\n2 Private\n3 No card" : "CON Your card?\n1 NHIS\n2 Private";
  if (first === "1") return { value: { slug: "nhis", name: "NHIS" }, rest: answers.slice(1) };
  if (first === "3" && withCash) return { value: { slug: null, name: "no card" }, rest: answers.slice(1) };
  if (first !== "2") return NOT_ON_MENU;
  const privateCards = [
    { slug: "cosmopolitan", name: "Cosmopolitan Health" },
    { slug: "prudential", name: "Prudential" },
  ];
  if (second === undefined) return numbered("Which private card?", privateCards.map((c) => c.name));
  const card = pick(privateCards, second);
  return card ? { value: card, rest: more } : NOT_ON_MENU;
}

function areaStep(answers: string[]): Step<Area> | string {
  const [first, ...rest] = answers;
  if (first === undefined) return numbered("Near?", USSD_AREAS.map((a) => a.name));
  const area = pick(USSD_AREAS, first);
  return area ? { value: area, rest } : NOT_ON_MENU;
}

async function search(deps: UssdDeps, card: Card, serviceIds: string[], area: Area): Promise<ResultCard[]> {
  const [insurers, services] = await Promise.all([listInsurers(deps.readDb), listServices(deps.readDb)]);
  const insurer = card.slug ? insurers.find((i) => i.slug === card.slug) : null;
  if (card.slug && !insurer) return [];
  const candidates = await getSearchCandidates(deps.readDb, {
    serviceIds,
    insurerId: insurer?.id ?? null,
    lat: area.lat,
    lng: area.lng,
    radiusKm: RADIUS_KM,
    now: deps.now,
  });
  // Rules B, F, T and S1, exactly as the app shows them.
  return buildResults({
    candidates,
    serviceNames: new Map(services.map((s) => [s.id, s.name])),
    withCard: card.slug !== null,
    origin: area,
    radiusKm: RADIUS_KM,
    now: deps.now,
  }).cards;
}

/** "1) AKOMA MISSION HOSPITAL, Kaneshie 1.8km. NHIS: Confirmed by hospital 2 days ago. Antenatal clinic: Open till 4 pm." */
function hospitalLine(n: number, c: ResultCard, card: Card): string {
  const facts: string[] = [];
  if (c.badge && card.slug) facts.push(`${card.name}: ${c.badge.text}`);
  const warning = c.status.freshness.state === "aging" || c.status.freshness.state === "stale" ? ` (${c.status.freshness.warning})` : "";
  facts.push(`${c.serviceName}: ${c.status.word}${warning}`);
  facts.push(...c.topUps);
  return smsText(`${n}) ${c.name.toUpperCase()}, ${c.area} ${c.distanceKm}km. ${facts.join(". ")}.`);
}

async function findHospital(answers: string[], deps: UssdDeps, phone: string): Promise<string> {
  const card = cardStep(answers, true);
  if (typeof card === "string") return card;
  const [needAnswer, ...afterNeed] = card.rest;
  if (needAnswer === undefined) return numbered("Need?", SERVICE_CHIPS.map((c) => c.label));
  const need = pick(SERVICE_CHIPS, needAnswer);
  if (!need) return NOT_ON_MENU;
  const area = areaStep(afterNeed);
  if (typeof area === "string") return area;
  if (area.rest.length > 0) return NOT_ON_MENU;
  if (!phone) return NO_PHONE;

  const results = await search(deps, card.value, need.serviceIds, area.value);
  const cardLabel = card.value.slug ? card.value.name : "no card";
  if (results.length === 0) {
    return `END No hospitals within ${RADIUS_KM}km of ${area.value.name}${card.value.slug ? ` take ${card.value.name}` : ""}. Emergency? Call 112.`;
  }
  // Rule 1: every message with data says it is sample data.
  const sms = [
    `VERIQ (sample data): ${need.label}, ${cardLabel}, near ${area.value.name}`,
    ...results.slice(0, SMS_RESULTS).map((c, i) => hospitalLine(i + 1, c, card.value)),
    "Dial again and choose 3 to report a refusal.",
  ].join("\n");
  await deps.messenger.sendSms(phone, sms);
  return `END We sent you an SMS with ${results.length} ${results.length === 1 ? "hospital" : "hospitals"} near ${area.value.name}. Emergency? Call 112.`;
}

async function cardCheck(answers: string[], deps: UssdDeps, phone: string): Promise<string> {
  const card = cardStep(answers, false);
  if (typeof card === "string") return card;
  const area = areaStep(card.rest);
  if (typeof area === "string") return area;
  if (area.rest.length > 0) return NOT_ON_MENU;
  if (!phone) return NO_PHONE;

  const allServices = [...new Set(SERVICE_CHIPS.flatMap((c) => c.serviceIds))];
  const results = await search(deps, card.value, allServices, area.value);
  if (results.length === 0) return `END We know of no hospital within ${RADIUS_KM}km of ${area.value.name} that takes ${card.value.name}. Call first.`;
  const sms = [
    `VERIQ (sample data): ${card.value.name} near ${area.value.name}`,
    ...results.slice(0, SMS_RESULTS).map((c, i) => smsText(`${i + 1}) ${c.name.toUpperCase()}: ${c.badge?.text ?? "Unknown"} (${c.distanceKm}km)`)),
  ].join("\n");
  await deps.messenger.sendSms(phone, sms);
  return `END We sent you an SMS with what we know about ${card.value.name} near ${area.value.name}.`;
}

async function reportRefusal(answers: string[], deps: UssdDeps, phone: string): Promise<string> {
  const card = cardStep(answers, false);
  if (typeof card === "string") return card;
  const area = areaStep(card.rest);
  if (typeof area === "string") return area;

  // Every hospital nearby, nearest first: a card can be refused anywhere.
  const allServices = [...new Set(SERVICE_CHIPS.flatMap((c) => c.serviceIds))];
  const near = (
    await getSearchCandidates(deps.readDb, {
      serviceIds: allServices,
      insurerId: null,
      lat: area.value.lat,
      lng: area.value.lng,
      radiusKm: RADIUS_KM,
      now: deps.now,
    })
  )
    .map((c) => ({ facility: c.facility, km: haversineKm(area.value, c.facility) }))
    .filter((c) => c.km <= RADIUS_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, REPORT_CHOICES);

  const [choice, ...extra] = area.rest;
  if (choice === undefined) {
    if (near.length === 0) return `END We know of no hospital within ${RADIUS_KM}km of ${area.value.name}.`;
    return numbered("Which hospital?", near.map((n) => n.facility.name));
  }
  const hospital = pick(near, choice);
  if (!hospital || extra.length > 0) return NOT_ON_MENU;
  if (!phone) return NO_PHONE;

  const insurer = (await listInsurers(deps.readDb)).find((i) => i.slug === card.value.slug);
  if (!insurer) return NOT_ON_MENU;
  // Rule A: the device id is a hash of the phone number; submitReport hashes it again with the secret.
  const deviceId = `ussd-${createHash("sha256").update(phone).digest("hex").slice(0, 40)}`;
  const result = await submitReport({
    db: deps.serviceDb,
    body: { deviceId, facilityId: hospital.facility.id, insurerId: insurer.id, outcome: "refused" },
    secret: deps.secret,
    now: deps.now,
  });
  if (result.status === "counted") return "END Thank you. Your report is counted. It helps the next person.";
  if (result.status === "held") return "END Thank you. We'll check your report before it counts.";
  if (result.status === "already_counted") return `END ${result.message}`;
  return NOT_ON_MENU;
}

export async function handleUssd({ text, phone }: { text: string; phone: string }, deps: UssdDeps): Promise<string> {
  const answers = text === "" ? [] : text.split("*").map((a) => a.trim());
  const [first, ...rest] = answers;
  if (first === undefined) return `CON ${ROOT_MENU}`;
  if (first === "1") return findHospital(rest, deps, phone);
  if (first === "2") return cardCheck(rest, deps, phone);
  if (first === "3") return reportRefusal(rest, deps, phone);
  if (first === "4" && rest.length === 0) return EMERGENCY;
  return NOT_ON_MENU;
}
