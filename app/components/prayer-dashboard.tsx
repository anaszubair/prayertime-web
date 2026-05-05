"use client";

import { useState, useEffect } from "react";

const TIME_ZONE = "Asia/Karachi";
const METHOD = 1; // University of Islamic Sciences, Karachi
const FALLBACK_LAT = 24.8607;
const FALLBACK_LNG = 67.0011;
const FALLBACK_CITY = "Karachi, Pakistan";

// ─── Types ───────────────────────────────────────────────────────────────────

type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

type PrayerDefinition = {
  key: PrayerKey;
  apiKey: string;
  name: string;
  detail: string;
  tone: string;
};

type PrayerTime = {
  key: PrayerKey;
  name: string;
  detail: string;
  minutes: number;
  time: string;
  tone: string;
};

type ScheduleDay = {
  isoDate: string;
  weekday: string;
  dateLabel: string;
  prayers: PrayerTime[];
};

type ApiTimings = Record<string, string>;

type ApiDayEntry = {
  timings: ApiTimings;
  date: {
    readable: string;
    gregorian: {
      day: string;
      weekday: { en: string };
      month: { number: number; en: string };
      year: string;
    };
    hijri: {
      day: string;
      weekday: { en: string };
      month: { en: string };
      year: string;
    };
  };
};

type LocationState = {
  lat: number;
  lng: number;
  city: string;
};

type PrayerDashboardProps = {
  initialNowIso: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PRAYER_DEFINITIONS: PrayerDefinition[] = [
  {
    key: "fajr",
    apiKey: "Fajr",
    name: "Fajr",
    detail: "Quiet beginning before sunrise",
    tone: "from-sky-100 via-white to-cyan-50",
  },
  {
    key: "sunrise",
    apiKey: "Sunrise",
    name: "Sunrise",
    detail: "Morning glow and reflection",
    tone: "from-amber-100 via-orange-50 to-white",
  },
  {
    key: "dhuhr",
    apiKey: "Dhuhr",
    name: "Dhuhr",
    detail: "Midday pause and balance",
    tone: "from-emerald-50 via-white to-lime-50",
  },
  {
    key: "asr",
    apiKey: "Asr",
    name: "Asr",
    detail: "Afternoon stillness",
    tone: "from-teal-50 via-white to-cyan-50",
  },
  {
    key: "maghrib",
    apiKey: "Maghrib",
    name: "Maghrib",
    detail: "Sunset warmth",
    tone: "from-rose-100 via-orange-50 to-white",
  },
  {
    key: "isha",
    apiKey: "Isha",
    name: "Isha",
    detail: "Evening calm",
    tone: "from-slate-100 via-indigo-50 to-white",
  },
];

// ─── Formatters ──────────────────────────────────────────────────────────────

const fullDateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function getPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((p) => p.type === type)?.value ?? "";
}

function formatFullDate(date: Date): string {
  const parts = fullDateFormatter.formatToParts(date);
  return `${getPart(parts, "weekday")}, ${getPart(parts, "day")} ${getPart(parts, "month")} ${getPart(parts, "year")}`;
}

function getClockParts(date: Date) {
  const parts = timeFormatter.formatToParts(date);
  return {
    hour: getPart(parts, "hour"),
    minute: getPart(parts, "minute"),
    second: getPart(parts, "second"),
  };
}

// ─── Time Helpers ─────────────────────────────────────────────────────────────

/** Parse "05:07 (PKT)" or "05:07" → total minutes from midnight */
function parseTimeToMinutes(timeStr: string): number {
  const clean = timeStr.replace(/\s*\([^)]+\)/, "").trim();
  const [h, m] = clean.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes → "05:07 AM" */
function minutesToDisplay(totalMinutes: number): string {
  const safe = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function parseDayEntry(entry: ApiDayEntry): PrayerTime[] {
  return PRAYER_DEFINITIONS.map((def) => {
    const rawTime = entry.timings[def.apiKey] ?? "00:00";
    const minutes = parseTimeToMinutes(rawTime);
    return {
      key: def.key,
      name: def.name,
      detail: def.detail,
      minutes,
      time: minutesToDisplay(minutes),
      tone: def.tone,
    };
  });
}

function getCurrentMomentSeconds(date: Date): number {
  const { hour, minute, second } = getClockParts(date);
  return Number(hour) * 3600 + Number(minute) * 60 + Number(second);
}

function getCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function getNextPrayer(now: Date, schedule: ScheduleDay[]) {
  const current = getCurrentMomentSeconds(now);
  const todayPrayers = schedule[0]?.prayers ?? [];

  for (const prayer of todayPrayers) {
    if (prayer.minutes * 60 > current) {
      return {
        ...prayer,
        dayLabel: "Today",
        countdown: getCountdown(prayer.minutes * 60 - current),
      };
    }
  }

  const tomorrowFajr = schedule[1]?.prayers[0] ?? todayPrayers[0];
  return {
    ...tomorrowFajr,
    dayLabel: "Tomorrow",
    countdown: getCountdown(86400 - current + tomorrowFajr.minutes * 60),
  };
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function ClockCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-white/15 bg-white/10 px-4 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur">
      <div className="font-mono text-4xl font-semibold tracking-[0.18em] text-white sm:text-5xl">
        {value}
      </div>
      <div className="mt-2 text-[0.68rem] uppercase tracking-[0.32em] text-white/60">
        {label}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="flex min-h-[32rem] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="mt-4 text-base text-slate-600">Loading prayer times…</p>
        </div>
      </div>
    </section>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="flex min-h-[32rem] items-center justify-center p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-base text-red-800">{message}</p>
          <button
            onClick={onRetry}
            className="mt-5 rounded-full bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            Try again
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PrayerDashboard({ initialNowIso }: PrayerDashboardProps) {
  const [now, setNow] = useState(() => new Date(initialNowIso));
  const [location, setLocation] = useState<LocationState | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [hijriDate, setHijriDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationReady, setLocationReady] = useState(false);

  // ── Live clock ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // ── Geolocation ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function resolveLocation(lat: number, lng: number, fallback: boolean) {
      let city = FALLBACK_CITY;

      if (!fallback) {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
          );
          const data = await res.json();
          const name = data.city || data.locality || data.principalSubdivision || "";
          city = name ? `${name}, ${data.countryName ?? ""}`.trim().replace(/,\s*$/, "") : "Your Location";
        } catch {
          city = "Your Location";
        }
      }

      setLocation({ lat, lng, city });
      setLocationReady(true);
    }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolveLocation(pos.coords.latitude, pos.coords.longitude, false),
        () => resolveLocation(FALLBACK_LAT, FALLBACK_LNG, true),
        { timeout: 8000 },
      );
    } else {
      resolveLocation(FALLBACK_LAT, FALLBACK_LNG, true);
    }
  }, []);

  // ── Fetch prayer data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!locationReady || !location) return;

    const { lat, lng } = location;

    async function fetchPrayerData() {
      setLoading(true);
      setError(null);

      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const todayDay = today.getDate();

        // Next month
        const nextMonthDate = new Date(year, month, 1);
        const nextYear = nextMonthDate.getFullYear();
        const nextMonth = nextMonthDate.getMonth() + 1;

        const base = `https://api.aladhan.com/v1`;
        const params = `latitude=${lat}&longitude=${lng}&method=${METHOD}&school=1`;

        const [todayRes, curMonthRes, nextMonthRes] = await Promise.all([
          fetch(`${base}/timings?${params}`),
          fetch(`${base}/calendar/${year}/${month}?${params}`),
          fetch(`${base}/calendar/${nextYear}/${nextMonth}?${params}`),
        ]);

        if (!todayRes.ok || !curMonthRes.ok) {
          throw new Error("Prayer time API returned an error. Please try again.");
        }

        const [todayJson, curMonthJson, nextMonthJson] = await Promise.all([
          todayRes.json(),
          curMonthRes.json(),
          nextMonthRes.json(),
        ]);

        if (todayJson.code !== 200) throw new Error(todayJson.status ?? "Failed to fetch today's times");
        if (curMonthJson.code !== 200) throw new Error(curMonthJson.status ?? "Failed to fetch monthly times");

        // Hijri date from API (accurate)
        const hijri = todayJson.data.date.hijri;
        setHijriDate(
          `${hijri.weekday.en}, ${hijri.day} ${hijri.month.en} ${hijri.year} AH`,
        );

        // Build 30-day schedule from today
        const curMonthDays: ApiDayEntry[] = curMonthJson.data ?? [];
        const nextMonthDays: ApiDayEntry[] = nextMonthJson.data ?? [];

        const fromToday = curMonthDays.filter(
          (entry) => parseInt(entry.date.gregorian.day, 10) >= todayDay,
        );

        const needed = Math.max(0, 30 - fromToday.length);
        const combined = [...fromToday, ...nextMonthDays.slice(0, needed)];

        const scheduleData: ScheduleDay[] = combined.map((entry) => {
          const g = entry.date.gregorian;
          const dayStr = g.day.padStart(2, "0");
          const monStr = String(g.month.number).padStart(2, "0");
          const isoDate = `${g.year}-${monStr}-${dayStr}T00:00:00Z`;

          return {
            isoDate,
            weekday: g.weekday.en.slice(0, 3),
            dateLabel: entry.date.readable,
            prayers: parseDayEntry(entry),
          };
        });

        setSchedule(scheduleData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading prayer times.",
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPrayerData();
  }, [locationReady, location]);

  // ── Derived state ────────────────────────────────────────────────────────────

  const clock = getClockParts(now);
  const gregorianDate = formatFullDate(now);
  const todayPrayerTimes = schedule[0]?.prayers ?? [];
  const nextPrayer = schedule.length > 0 ? getNextPrayer(now, schedule) : null;
  const cityLabel = location?.city ?? FALLBACK_CITY;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <LoadingSpinner />;
  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => setLocationReady((v) => !v)}
      />
    );

  return (
    <section className="relative isolate overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,_rgba(255,224,130,0.45),_transparent_55%)]" />
      <div className="absolute right-0 top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(14,116,144,0.16),_transparent_70%)] blur-3xl" />
      <div className="absolute left-0 top-80 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(21,128,61,0.12),_transparent_72%)] blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Row 1: Hero + Clock ── */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">

          {/* Hero card */}
          <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_80px_rgba(90,74,42,0.12)] backdrop-blur xl:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-amber-900">
              Live Prayer Schedule
            </div>

            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-5xl">
              Daily prayer times with a calm, beautiful home dashboard.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Live digital clock, Gregorian and Hijri dates, today&apos;s
              prayer widget, and a real-time 30-day timetable — all sourced
              from the Aladhan API using your location.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50/80 px-4 py-4">
                <div className="text-[0.72rem] uppercase tracking-[0.28em] text-emerald-700">
                  Location
                </div>
                <div className="mt-2 text-lg font-semibold text-emerald-950">
                  {cityLabel}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-sky-100 bg-sky-50/80 px-4 py-4">
                <div className="text-[0.72rem] uppercase tracking-[0.28em] text-sky-700">
                  Next Prayer
                </div>
                <div className="mt-2 text-lg font-semibold text-sky-950">
                  {nextPrayer ? `${nextPrayer.name} ${nextPrayer.dayLabel}` : "—"}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-amber-100 bg-orange-50/80 px-4 py-4">
                <div className="text-[0.72rem] uppercase tracking-[0.28em] text-orange-700">
                  Countdown
                </div>
                <div className="mt-2 text-lg font-semibold text-orange-950">
                  {nextPrayer?.countdown ?? "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Clock card */}
          <div className="rounded-[2rem] border border-slate-800 bg-[linear-gradient(160deg,#07243a_0%,#10314b_48%,#122235_100%)] p-6 text-white shadow-[0_24px_80px_rgba(7,36,58,0.3)] xl:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.32em] text-sky-200/75">
                  Live Digital Clock
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  Current Time
                </h2>
              </div>
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[0.72rem] uppercase tracking-[0.28em] text-sky-100/80">
                {TIME_ZONE}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <ClockCell label="Hours" value={clock.hour} />
              <ClockCell label="Minutes" value={clock.minute} />
              <ClockCell label="Seconds" value={clock.second} />
            </div>

            <div className="mt-8 space-y-4">
              <div className="rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4">
                <div className="text-[0.72rem] uppercase tracking-[0.28em] text-sky-100/65">
                  Gregorian Date
                </div>
                <div className="mt-2 text-lg font-medium leading-7 text-white">
                  {gregorianDate}
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-white/12 bg-white/8 px-4 py-4">
                <div className="text-[0.72rem] uppercase tracking-[0.28em] text-sky-100/65">
                  Hijri Date
                </div>
                <div className="mt-2 text-lg font-medium leading-7 text-white">
                  {hijriDate || "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Row 2: Prayer Widget + Snapshot ── */}
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">

          {/* Today's prayer times */}
          <div className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_80px_rgba(90,74,42,0.12)] backdrop-blur xl:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.32em] text-slate-500">
                  Prayer Widget
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                  Today&apos;s Prayer Times
                </h2>
              </div>
              {nextPrayer && (
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-900">
                  Next up: {nextPrayer.name} at {nextPrayer.time}
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {todayPrayerTimes.map((prayer) => {
                const isNext = prayer.key === nextPrayer?.key;
                return (
                  <article
                    key={prayer.key}
                    className={`rounded-[1.6rem] border p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-1 ${
                      isNext
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))]"
                    }`}
                  >
                    <div className={`rounded-[1.2rem] bg-gradient-to-br p-4 ${prayer.tone}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">
                            {prayer.name}
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {prayer.detail}
                          </p>
                        </div>
                        {isNext && (
                          <span className="rounded-full bg-emerald-700 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white">
                            Next
                          </span>
                        )}
                      </div>
                      <div className="mt-6 font-mono text-3xl font-semibold tracking-[0.08em] text-slate-950">
                        {prayer.time}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Focus panel */}
          <aside className="rounded-[2rem] border border-white/70 bg-white/78 p-6 shadow-[0_24px_80px_rgba(90,74,42,0.12)] backdrop-blur xl:p-8">
            <p className="text-[0.72rem] uppercase tracking-[0.32em] text-slate-500">
              Focus Panel
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
              Prayer Snapshot
            </h2>

            {nextPrayer && (
              <div className="mt-6 rounded-[1.7rem] bg-[linear-gradient(145deg,#163b2c_0%,#1f6a4c_100%)] p-6 text-white shadow-[0_18px_55px_rgba(22,59,44,0.25)]">
                <div className="text-sm uppercase tracking-[0.28em] text-emerald-100/70">
                  Coming Up
                </div>
                <div className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
                  {nextPrayer.name}
                </div>
                <div className="mt-2 text-lg text-emerald-50/90">
                  {nextPrayer.dayLabel} at {nextPrayer.time}
                </div>

                <div className="mt-8 rounded-[1.4rem] border border-white/12 bg-white/10 px-4 py-4">
                  <div className="text-[0.72rem] uppercase tracking-[0.28em] text-emerald-100/65">
                    Time Remaining
                  </div>
                  <div className="mt-2 font-mono text-3xl font-semibold tracking-[0.12em] text-white">
                    {nextPrayer.countdown}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              <div className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50/80 px-4 py-4">
                <div className="text-[0.72rem] uppercase tracking-[0.28em] text-emerald-800">
                  Data Source
                </div>
                <p className="mt-2 text-sm leading-6 text-emerald-950">
                  Live data from Aladhan API using the University of Islamic
                  Sciences, Karachi calculation method.
                </p>
              </div>

              <div className="rounded-[1.4rem] border border-sky-100 bg-sky-50/80 px-4 py-4">
                <div className="text-[0.72rem] uppercase tracking-[0.28em] text-sky-800">
                  Schedule Range
                </div>
                <p className="mt-2 text-sm leading-6 text-sky-950">
                  The table below shows 30 real days starting from today in{" "}
                  {TIME_ZONE}.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Row 3: 30-Day Table ── */}
        <section className="rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_rgba(90,74,42,0.12)] backdrop-blur xl:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[0.72rem] uppercase tracking-[0.32em] text-slate-500">
                30 Day Overview
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">
                Prayer Time Table
              </h2>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-600">
              Live timetable · {cityLabel}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.6rem] border border-slate-200/80">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-slate-900 text-sm uppercase tracking-[0.22em] text-slate-100">
                  <tr>
                    <th className="px-4 py-4 font-medium">Day</th>
                    <th className="px-4 py-4 font-medium">Date</th>
                    <th className="px-4 py-4 font-medium">Fajr</th>
                    <th className="px-4 py-4 font-medium">Sunrise</th>
                    <th className="px-4 py-4 font-medium">Dhuhr</th>
                    <th className="px-4 py-4 font-medium">Asr</th>
                    <th className="px-4 py-4 font-medium">Maghrib</th>
                    <th className="px-4 py-4 font-medium">Isha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white/90 text-sm text-slate-700">
                  {schedule.map((day, index) => (
                    <tr
                      key={day.isoDate}
                      className={`transition-colors hover:bg-amber-50/70 ${
                        index === 0 ? "bg-emerald-50/60" : "bg-white/90"
                      }`}
                    >
                      <td className="px-4 py-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-3">
                          <span>{day.weekday}</span>
                          {index === 0 && (
                            <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.2em] text-white">
                              Today
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">{day.dateLabel}</td>
                      {day.prayers.map((prayer) => (
                        <td
                          key={`${day.isoDate}-${prayer.key}`}
                          className="px-4 py-4 font-medium text-slate-800"
                        >
                          {prayer.time}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
