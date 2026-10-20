# Game rules

How RaKs Golfing scores matches, handles handicaps, settles money and ranks
golfers. Play follows the USGA Rules of Golf; handicaps follow the USGA Rules of
Handicapping (World Handicap System). The code is pure and unit tested:
`src/lib/golf/` for matches and `src/lib/rankingMath.ts` for rankings.

## Handicaps

- **Score differential** = (113 / Slope) x (adjusted gross score - Course
  Rating - PCC), to one decimal.
- **Adjusted gross score** caps each hole at net double bogey: par + 2 + the
  strokes the golfer gets on that hole. A golfer with no handicap yet is capped
  at par + 5.
- **Handicap Index** comes from the latest 20 differentials using the WHS table
  (3 scores: lowest minus 2.0; 5 scores: the lowest; 20 scores: average of the
  best 8), capped at 54.0.
- **Which index a golfer plays off**: a GHIN index an admin has checked; else
  the app's index once they have 5 score cards; else the GHIN index they
  reported (shown as "GHIN on file").
- **Verified badge**: GHIN checked by an admin and at least one round entered in
  the app. Until the USGA licenses GHIN lookup, the check is done by hand at
  `/admin/verify`.
- To play matches, a golfer needs a GHIN number on file or 5 score cards.

## Strokes in a match

- **Course handicap** = Index x (Slope / 113) + (Course Rating - Par), rounded.
- **Playing handicap** = course handicap x the USGA allowance for the format:
  singles match play 100%, singles stroke play 95%, four-ball match play 90%,
  four-ball stroke play 85%, nine point 100%, threesome matches 100% (match)
  or 95% (stroke).
- Strokes are given **off the low**: the lowest playing handicap gets none, the
  others get the difference, starting on stroke index 1. More than 18 wraps to a
  second stroke on the hardest holes.
- Everything is frozen when the match is full (READY), so later rounds don't
  change a match already booked.
- **Gross** matches use no strokes. Net or gross is agreed before booking.

## Formats

| Format | Players | How a hole or match is won |
| --- | --- | --- |
| 1v1 stroke play | 2 | Lower total over 18 |
| 1v1 match play | 2 | Holes won; closed out when one side is up more holes than remain |
| 2v2 best ball stroke / match play | 4 | Each side's best score on each hole |
| Threesome stroke / match play | 3 | Each pair is its own 1v1 match |
| Nine point game | 3 | 9 points a hole: 5-3-1; ties split 4-4-1, 5-2-2 or 3-3-3 |

A hole counts once everyone in the match (or pair) has a score on it.

## ALOHA PRESS

Double or nothing, called by the side that's down, once per match (once per
pair in threesomes). Not available in the nine point game.

- **When**: match play, on any remaining hole once the match is closed out, or
  on the last hole if it's still alive and they're down. Stroke play: the last
  hole only, when behind after 17.
- **Win the pressed hole**: all bets in that match are washed; nobody pays.
- **Tie it**: the match stands as if there were no press.
- **Lose it**: the pressing side pays double.
- In stroke play, if the pressing side ends up winning or tying the match
  outright anyway, the normal result stands.
- Calling a press holds one more stake from every player on the pressing side.

## Money

- **Wager hold** at booking or joining: the stake for 1v1, best ball and nine
  point (where the stake is the loss cap), twice the stake for threesomes.
- **Settlement** after everyone confirms the card: in 1v1 and threesome pairs the
  loser pays the stake to the winner; in best ball each loser pays one stake and
  each winner gets one; a lost press doubles it. Nine point: each pair settles
  the point difference times the point value, then no one loses more than the
  cap and winners are scaled down so it still adds up. Payouts always sum to
  zero; the platform takes no cut.
- Money flow and the ledger in detail: [wagers.md](wagers.md).

## Rankings

A score from 0 to 100, from four parts, each scaled across all ranked golfers:

| Part | Weight | Measured as |
| --- | --- | --- |
| Win/loss | 35% | Win rate (ties count half), pulled toward 50% until about 10 matches |
| Strength of opponents | 35% | An Elo rating replayed over every settled match. Opponents' strength blends their rating with their handicap. Results against unverified opponents count 60%. |
| Scoring | 15% | Average of the best 8 of the last 20 differentials |
| Profit | 15% | All-time wagering result on a log curve, so one big win doesn't dominate |

A golfer needs 3 settled matches to be ranked. Void and cancelled matches never
count. The constants live at the top of `src/lib/rankingMath.ts`.
