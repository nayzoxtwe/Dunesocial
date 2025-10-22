import { useMemo } from 'react';
import { LucideHome, LucideCompass, LucideQrCode, LucidePlus, LucideMessageCircle } from 'lucide-react';

type BubbleProps = {
  author: 'self' | 'other';
  text: string;
  time: string;
};

const bubbleStyles = {
  self: 'bg-gradient-to-br from-[#b26cff] to-[#7c3aed] text-white rounded-2xl px-3 py-2 max-w-[78%] shadow-[0_2px_12px_rgba(124,58,237,.35)] ml-auto',
  other: 'bg-[#15151B] text-[#EDEDED] rounded-2xl px-3 py-2 max-w-[78%] border border-[#23232A]'
};

export function MessageBubble({ author, text, time }: BubbleProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className={bubbleStyles[author]}>{text}</div>
      <span className="text-xs text-neutral-400 mt-1 self-end">{time}</span>
    </div>
  );
}

type ChatViewProps = {
  messages: BubbleProps[];
  status?: 'online' | 'away' | 'offline';
};

export function ChatView({ messages, status = 'online' }: ChatViewProps) {
  const presence = useMemo(() => ({
    online: { label: 'En ligne', dot: 'bg-emerald-500' },
    away: { label: 'Occupé', dot: 'bg-amber-500' },
    offline: { label: 'Hors ligne', dot: 'bg-neutral-500' }
  })[status], [status]);

  return (
    <section className="flex h-full flex-col bg-[#0B0B0F] text-neutral-200">
      <header className="flex items-center gap-3 border-b border-[#1F1F26] px-4 py-3">
        <div className="relative">
          <div className="h-11 w-11 rounded-full bg-[#15151B]" />
          <span className={`absolute -right-1 -bottom-1 h-3 w-3 rounded-full border-2 border-[#0B0B0F] ${presence.dot}`} />
        </div>
        <div>
          <p className="font-semibold">Nova</p>
          <p className="text-sm text-neutral-400">{presence.label}</p>
        </div>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.map((message, index) => (
          <MessageBubble key={`${message.time}-${index}`} {...message} />
        ))}
      </div>
      <footer className="border-t border-[#1F1F26] px-4 py-3">
        <div className="flex items-center gap-2 rounded-2xl bg-[#15151B] px-3 py-2">
          <button className="rounded-full bg-[#23232A] p-2 text-neutral-300" aria-label="Ajouter un média">+</button>
          <input className="flex-1 bg-transparent text-sm text-[#EDEDED] placeholder:text-neutral-500 focus:outline-none" placeholder="Envoyer un message sécurisé" />
          <button className="rounded-full bg-[#23232A] p-2 text-neutral-300" aria-label="Envoyer un vocal">🎤</button>
        </div>
      </footer>
    </section>
  );
}

type Story = { id: string; label: string; seen?: boolean };

type StoryBarProps = {
  items: Story[];
};

export function StoryBar({ items }: StoryBarProps) {
  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-3">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col items-center gap-2 text-sm">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 ${item.seen ? 'border-[#1F1F26]' : 'border-transparent bg-gradient-to-tr from-[#b26cff] to-[#7c3aed]'}`}>
            <div className="h-14 w-14 rounded-full bg-[#15151B]" />
          </div>
          <span className="text-neutral-300">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

type BottomNavProps = {
  active: 'home' | 'explore' | 'scan' | 'create' | 'messages';
  unread?: number;
  onSelect?: (tab: BottomNavProps['active']) => void;
};

const tabs = [
  { id: 'home', label: 'Accueil', icon: LucideHome },
  { id: 'explore', label: 'Explorer', icon: LucideCompass },
  { id: 'scan', label: 'Scan QR', icon: LucideQrCode },
  { id: 'create', label: 'Créer', icon: LucidePlus },
  { id: 'messages', label: 'Messages', icon: LucideMessageCircle }
] as const;

export function BottomNav({ active, unread = 0, onSelect }: BottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 h-14 border-t border-[#1F1F26] bg-[#0B0B0F]/90 backdrop-blur">
      <ul className="mx-auto flex h-full max-w-md items-center justify-around text-xs text-neutral-400">
        {tabs.map(({ id, label, icon: Icon }) => (
          <li key={id} className="relative flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect?.(id)}
              className="flex flex-col items-center gap-1"
            >
              <Icon className={`h-5 w-5 ${active === id ? 'text-[#a855f7]' : 'text-neutral-500'}`} />
              <span className={active === id ? 'text-[#EDEDED]' : ''}>{label}</span>
              {id === 'messages' && unread > 0 && (
                <span className="absolute -top-1 right-2 min-w-[1.2rem] rounded-full bg-red-500 px-1 text-[0.65rem] text-white">
                  {unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DemoChatSurface() {
  const sampleMessages: BubbleProps[] = [
    { author: 'other', text: 'Prêt pour la session nocturne ?', time: '21:04' },
    { author: 'self', text: 'Oui, j’ai activé le mode focus 🔒', time: '21:05' },
    { author: 'other', text: 'On teste la nouvelle économie de stickers ?', time: '21:06' }
  ];

  const stories: Story[] = [
    { id: 'me', label: 'Moi', seen: true },
    { id: 'nova', label: 'Nova' },
    { id: 'eden', label: 'Eden' }
  ];

  return (
    <div className="relative min-h-screen pb-16">
      <StoryBar items={stories} />
      <ChatView messages={sampleMessages} />
      <BottomNav active="messages" unread={3} />
    </div>
  );
}
