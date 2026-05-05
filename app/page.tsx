import PrayerDashboard from "./components/prayer-dashboard";

export default function Home() {
  return (
    <main className="flex-1">
      <PrayerDashboard initialNowIso={new Date().toISOString()} />
    </main>
  );
}
