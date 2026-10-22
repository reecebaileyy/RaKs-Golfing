-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('PREPAID', 'PAY_AT_COURSE');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'RELEASED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HandicapSource" AS ENUM ('NONE', 'APP', 'GHIN');

-- CreateEnum
CREATE TYPE "ScoreCardSource" AS ENUM ('MANUAL', 'MATCH');

-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('SINGLES_STROKE', 'SINGLES_MATCH', 'FOURBALL_STROKE', 'FOURBALL_MATCH', 'NINE_POINT', 'THREESOME_STROKE', 'THREESOME_MATCH');

-- CreateEnum
CREATE TYPE "ScoringBasis" AS ENUM ('NET', 'GROSS');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('OPEN', 'READY', 'LIVE', 'CONFIRMING', 'SETTLED', 'DISPUTED', 'VOID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PressOutcome" AS ENUM ('WON', 'TIED', 'LOST', 'MOOT');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('EXTERNAL', 'WALLET', 'HELD', 'PLATFORM');

-- CreateEnum
CREATE TYPE "WeatherKind" AS ENUM ('FORECAST', 'ACTUAL');

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "imageUrl" TEXT,
    "convenienceFeeCents" INTEGER NOT NULL DEFAULT 299,
    "taxRateBps" INTEGER NOT NULL DEFAULT 0,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT false,
    "cancelWindowHours" INTEGER NOT NULL DEFAULT 24,
    "policyNotes" TEXT NOT NULL DEFAULT '',
    "teeSheet" TEXT NOT NULL DEFAULT 'local',
    "externalCourseId" TEXT,
    "geofenceMeters" INTEGER NOT NULL DEFAULT 800,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeeTime" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "spotsLeft" INTEGER NOT NULL DEFAULT 4,
    "minPlayers" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "TeeTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "teeTimeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holes" INTEGER NOT NULL,
    "cartIncluded" BOOLEAN NOT NULL DEFAULT true,
    "greenFeeCents" INTEGER NOT NULL,
    "rackRateCents" INTEGER,
    "isHotDeal" BOOLEAN NOT NULL DEFAULT false,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'PAY_AT_COURSE',
    "minPlayers" INTEGER NOT NULL DEFAULT 1,
    "maxPlayers" INTEGER NOT NULL DEFAULT 4,
    "convenienceFeeCents" INTEGER,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "teeTimeId" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "players" INTEGER NOT NULL,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Golfer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "handicap" DOUBLE PRECISION,
    "userId" TEXT,

    CONSTRAINT "Golfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "confirmationCode" TEXT NOT NULL,
    "holdId" TEXT NOT NULL,
    "teeTimeId" TEXT NOT NULL,
    "rateId" TEXT NOT NULL,
    "golferId" TEXT NOT NULL,
    "players" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "greenFeeTotalCents" INTEGER NOT NULL,
    "convenienceFeeCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL,
    "protectionCents" INTEGER NOT NULL DEFAULT 0,
    "dueOnlineCents" INTEGER NOT NULL,
    "dueAtCourseCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "hasProtection" BOOLEAN NOT NULL DEFAULT false,
    "paymentRef" TEXT,
    "teeSheetRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "refundCents" INTEGER,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "homeCourseId" TEXT,
    "state" TEXT,
    "ghinNumber" TEXT,
    "ghinIndex" DOUBLE PRECISION,
    "ghinVerifiedAt" TIMESTAMP(3),
    "handicapIndex" DOUBLE PRECISION,
    "handicapSource" "HandicapSource" NOT NULL DEFAULT 'NONE',
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeeSet" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "courseRating" DOUBLE PRECISION NOT NULL,
    "slope" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "yards" INTEGER,

    CONSTRAINT "TeeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hole" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "strokeIndex" INTEGER NOT NULL,
    "yards" INTEGER,
    "teeLat" DOUBLE PRECISION,
    "teeLng" DOUBLE PRECISION,
    "greenLat" DOUBLE PRECISION,
    "greenLng" DOUBLE PRECISION,

    CONSTRAINT "Hole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teeSetId" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "holeStrokes" TEXT NOT NULL,
    "grossScore" INTEGER NOT NULL,
    "adjustedGross" INTEGER NOT NULL,
    "pcc" INTEGER NOT NULL DEFAULT 0,
    "differential" DOUBLE PRECISION NOT NULL,
    "countsForHandicap" BOOLEAN NOT NULL DEFAULT true,
    "source" "ScoreCardSource" NOT NULL DEFAULT 'MANUAL',
    "matchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "format" "MatchFormat" NOT NULL,
    "scoring" "ScoringBasis" NOT NULL,
    "stakeCents" INTEGER NOT NULL,
    "pointValueCents" INTEGER,
    "isOpenChallenge" BOOLEAN NOT NULL DEFAULT false,
    "status" "MatchStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teeTimeId" TEXT NOT NULL,
    "teeSetId" TEXT NOT NULL,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedTermsAt" TIMESTAMP(3),
    "pointVoteCents" INTEGER,
    "handicapIndex" DOUBLE PRECISION,
    "verifiedAtStart" BOOLEAN NOT NULL DEFAULT false,
    "courseHandicap" INTEGER,
    "playingHandicap" INTEGER,
    "strokesReceived" TEXT,
    "heldCents" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "disputeReason" TEXT,
    "resultCents" INTEGER,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoleScore" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "strokes" INTEGER NOT NULL,
    "enteredById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HoleScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Press" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" INTEGER NOT NULL,
    "opponentSide" INTEGER NOT NULL,
    "holeNumber" INTEGER NOT NULL,
    "calledById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "PressOutcome",

    CONSTRAINT "Press_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "userId" TEXT,
    "matchId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "paymentRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" TEXT NOT NULL,
    "kind" "WeatherKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "forTime" TIMESTAMP(3) NOT NULL,
    "reservationId" TEXT,
    "matchId" TEXT,
    "tempF" DOUBLE PRECISION,
    "feelsLikeF" DOUBLE PRECISION,
    "windMph" DOUBLE PRECISION,
    "windGustMph" DOUBLE PRECISION,
    "windDir" TEXT,
    "precipChance" INTEGER,
    "precipIn" DOUBLE PRECISION,
    "humidity" INTEGER,
    "conditions" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginCode" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "zip" TEXT,
    "roundsPerMonth" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredById" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GolfComment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GolfComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "TeeTime_courseId_startsAt_idx" ON "TeeTime"("courseId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Golfer_email_key" ON "Golfer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Golfer_userId_key" ON "Golfer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_confirmationCode_key" ON "Reservation"("confirmationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_holdId_key" ON "Reservation"("holdId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Hole_courseId_number_key" ON "Hole"("courseId", "number");

-- CreateIndex
CREATE INDEX "ScoreCard_userId_playedAt_idx" ON "ScoreCard"("userId", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Match_code_key" ON "Match"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Match_reservationId_key" ON "Match"("reservationId");

-- CreateIndex
CREATE INDEX "Match_status_isOpenChallenge_idx" ON "Match"("status", "isOpenChallenge");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_userId_key" ON "MatchPlayer"("matchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HoleScore_matchId_userId_holeNumber_key" ON "HoleScore"("matchId", "userId", "holeNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Press_matchId_side_opponentSide_key" ON "Press"("matchId", "side", "opponentSide");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_account_idx" ON "LedgerEntry"("userId", "account");

-- CreateIndex
CREATE INDEX "LedgerEntry_txId_idx" ON "LedgerEntry"("txId");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_reservationId_idx" ON "WeatherSnapshot"("reservationId");

-- CreateIndex
CREATE INDEX "WeatherSnapshot_matchId_idx" ON "WeatherSnapshot"("matchId");

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "LoginCode_target_createdAt_idx" ON "LoginCode"("target", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_userId_key" ON "WaitlistEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_referralCode_key" ON "WaitlistEntry"("referralCode");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE INDEX "GolfComment_hidden_createdAt_idx" ON "GolfComment"("hidden", "createdAt");

-- AddForeignKey
ALTER TABLE "TeeTime" ADD CONSTRAINT "TeeTime_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_teeTimeId_fkey" FOREIGN KEY ("teeTimeId") REFERENCES "TeeTime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_teeTimeId_fkey" FOREIGN KEY ("teeTimeId") REFERENCES "TeeTime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Golfer" ADD CONSTRAINT "Golfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_holdId_fkey" FOREIGN KEY ("holdId") REFERENCES "Hold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_teeTimeId_fkey" FOREIGN KEY ("teeTimeId") REFERENCES "TeeTime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_rateId_fkey" FOREIGN KEY ("rateId") REFERENCES "Rate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_golferId_fkey" FOREIGN KEY ("golferId") REFERENCES "Golfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeeSet" ADD CONSTRAINT "TeeSet_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hole" ADD CONSTRAINT "Hole_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreCard" ADD CONSTRAINT "ScoreCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreCard" ADD CONSTRAINT "ScoreCard_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreCard" ADD CONSTRAINT "ScoreCard_teeSetId_fkey" FOREIGN KEY ("teeSetId") REFERENCES "TeeSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teeTimeId_fkey" FOREIGN KEY ("teeTimeId") REFERENCES "TeeTime"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teeSetId_fkey" FOREIGN KEY ("teeSetId") REFERENCES "TeeSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoleScore" ADD CONSTRAINT "HoleScore_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Press" ADD CONSTRAINT "Press_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "WaitlistEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GolfComment" ADD CONSTRAINT "GolfComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
