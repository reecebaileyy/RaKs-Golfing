// Sends one-time sign-in codes. Email goes through Resend and texts through Twilio when their keys
// are set; otherwise the code is only written to the server log, which is enough for local work.
// No SDKs: both are a single HTTPS call.

import type { ContactKind } from "./contact";

export interface CodeMessage {
  kind: ContactKind;
  to: string;
  code: string;
}

export type Sender = (msg: CodeMessage) => Promise<void>;

const text = (code: string) => `${code} is your RaKs Golfing sign-in code. It expires in 10 minutes.`;

async function sendEmail({ to, code }: CodeMessage) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject: `${code} is your sign-in code`, text: text(code) }),
  });
  if (!res.ok) throw new Error(`Resend returned ${res.status}`);
}

async function sendSms({ to, code }: CodeMessage) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: text(code) }),
  });
  if (!res.ok) throw new Error(`Twilio returned ${res.status}`);
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
export const smsConfigured = () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);

/**
 * Demo and test switch: the API hands the code back so it can be shown on screen.
 * Never set it where real people sign in, since anyone could then sign in as anyone.
 */
export const echoCodes = () => process.env.LOGIN_CODE_ECHO === "1";

export const sendLoginCode: Sender = async (msg) => {
  if (msg.kind === "email" && emailConfigured()) return sendEmail(msg);
  if (msg.kind === "phone" && smsConfigured()) return sendSms(msg);
  console.info(`[login code] ${msg.kind} ${msg.to}: ${msg.code}`);
};
