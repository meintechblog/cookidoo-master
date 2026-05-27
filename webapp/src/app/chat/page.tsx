import { ChatRoom } from "@/components/ChatRoom";
import { chatList } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  const backlog = chatList(0);
  return (
    <div className="animate-fade-in -mx-6 -my-8 lg:mx-0 lg:my-0">
      <div className="bg-white lg:rounded-2xl overflow-hidden shadow-card lg:m-0 flex flex-col h-[85vh]">
        <header className="bg-charcoal-900 text-cream-50 px-5 py-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <div className="text-sm font-mono">
            cookidoo-master · chat-bridge
          </div>
          <div className="ml-auto text-xs text-charcoal-400">
            mit deiner laufenden Claude-Session auf dem Mac
          </div>
        </header>
        <ChatRoom initialBacklog={backlog} />
      </div>
      <div className="px-6 lg:px-0 mt-6 text-sm text-charcoal-600">
        <p>
          Schreib einfach rein — der Mac-Daemon polled hier alle 2&nbsp;s, pusht deinen Text via
          claude-peers-Broker an die cookidoo-master-Session, ihre Antwort landet hier per
          SSE-Stream als Bubble.
        </p>
        <p className="mt-2">
          Wenn die Session offline ist, queuen sich deine Nachrichten in SQLite und werden
          ausgeliefert sobald der Daemon wieder Verbindung hat.
        </p>
      </div>
    </div>
  );
}
