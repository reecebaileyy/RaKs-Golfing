// `npm run sweep`: voids open matches teeing off within 2 hours and refunds their wagers.
// Pages and match APIs also sweep lazily; run this from cron to keep it timely.
import { db } from "../db";
import { sweepMatches } from "./matches";

sweepMatches(new Date())
  .then((n) => console.log(`Voided ${n} open match${n === 1 ? "" : "es"}.`))
  .finally(() => db.$disconnect());
