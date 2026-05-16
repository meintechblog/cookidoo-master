export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <div className="animate-fade-in -mx-6 -my-8 lg:mx-0 lg:my-0">
      <div className="bg-charcoal-900 lg:rounded-2xl overflow-hidden shadow-card lg:m-0">
        <div className="bg-charcoal-800 px-5 py-3 flex items-center gap-3 border-b border-charcoal-700">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <div className="text-charcoal-200 text-sm font-mono">
            claude — /opt/cookidoo-master
          </div>
          <div className="ml-auto text-xs text-charcoal-400">
            tmux session: <span className="text-hero-400">thermomix</span> · persistent
          </div>
        </div>
        <iframe
          src="/chat-shell/"
          className="w-full h-[80vh] block bg-charcoal-900"
          title="Claude Code embedded chat"
          allow="clipboard-read; clipboard-write"
        />
      </div>
      <div className="px-6 lg:px-0 mt-6 text-sm text-charcoal-600">
        <p>
          Volle Claude-Code-Session direkt im Browser — gleicher User wie deine lokale Session.
          Mit allen Skills (<code className="bg-cream-100 px-1.5 py-0.5 rounded">/thermomix-master</code>,
          <code className="bg-cream-100 px-1.5 py-0.5 rounded">/gsd:*</code>) und dem geclonten Repo unter
          <code className="bg-cream-100 px-1.5 py-0.5 rounded">/opt/cookidoo-master/</code>.
        </p>
        <p className="mt-2">
          Browser zumachen schließt die Session NICHT — tmux hält sie am Leben. Wenn das Cookie/Auth-Token abläuft,
          einmalig auf dem Mac neu einloggen und{" "}
          <code className="bg-cream-100 px-1.5 py-0.5 rounded">~/.claude/.credentials.json</code> via rsync
          ins LXC kopieren (oder die Steps aus <code className="bg-cream-100 px-1.5 py-0.5 rounded">webapp/README.md</code> wiederholen).
        </p>
      </div>
    </div>
  );
}
