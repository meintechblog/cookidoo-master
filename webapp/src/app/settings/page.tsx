export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="animate-fade-in max-w-3xl">
      <h1 className="font-display text-3xl font-bold mb-6">Einstellungen</h1>
      <div className="bg-white rounded-2xl p-6 shadow-card space-y-6">
        <section>
          <h2 className="font-display text-xl font-bold mb-2">Cookidoo-Account</h2>
          <p className="text-sm text-charcoal-600 mb-3">
            Der Cookidoo-Login wird als Playwright-Profil unter <code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded">~/cookidoo-automation/profile/</code> gespeichert.
            Aktuell wird er beim Container-Setup vom Host übertragen — UI-Login-Management kommt in einer späteren Version.
          </p>
          <div className="text-sm text-charcoal-500">Status: <span className="font-medium text-charcoal-800">aus Profil-Verzeichnis übernommen</span></div>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold mb-2">Auto-Update</h2>
          <p className="text-sm text-charcoal-600 mb-3">
            Die Webapp pullt automatisch aus dem GitHub-Repo (thermomix-master) alle 10 Minuten via systemd-Timer.
            Bei neuen Commits in <code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded">main</code> wird automatisch <code>npm install + build + restart</code> ausgeführt.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold mb-2">Pipeline-Worker</h2>
          <p className="text-sm text-charcoal-600">
            Gepinnte URLs werden vom Worker-Service alle 60 Sek. abgearbeitet:<br />
            <code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded">extract → adapt → audit → pipeline 01-06 → publish → screenshot → commit</code>
          </p>
        </section>
      </div>
    </div>
  );
}
