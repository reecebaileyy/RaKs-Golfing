// Request shapes shared by the checkout and match routes.
import { z } from "zod";

export const MatchSetupBody = z.object({
  format: z.enum(
    ["SINGLES_STROKE", "SINGLES_MATCH", "FOURBALL_STROKE", "FOURBALL_MATCH", "NINE_POINT", "THREESOME_STROKE", "THREESOME_MATCH"],
    { error: "Pick a match format." },
  ),
  scoring: z.enum(["NET", "GROSS"], { error: "Pick net or gross." }),
  stakeCents: z.number().int(),
  teeSetId: z.string().min(1, "Pick a set of tees."),
  isOpenChallenge: z.boolean(),
  pointVoteCents: z.number().int().nullish(),
});

export const JoinBody = z.object({
  side: z.number().int().min(0).max(2),
  acceptedTerms: z.boolean(),
  pointVoteCents: z.number().int().nullish(),
});
