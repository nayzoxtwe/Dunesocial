'use client';

import { BottomNav, MessageBubble, StoryBar } from '@dune/ui';
import { applyTeenNightMode } from '@dune/proto';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createTrpcClient } from '@/lib/trpcClient';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { useForm } from 'react-hook-form';

const QrReader = dynamic(() => import('react-qr-reader').then((mod) => mod.QrReader), { ssr: false });

type ConversationSummary = {
  id: string;
  type: string;
  lastMessage: {
    id: string;
    text: string | null;
    createdAt: string;
    sender: { id: string; display: string };
  } | null;
  participant: { id: string; display: string; status: string | null } | null;
};

type MessageItem = {
  id: string;
  createdAt: string;
  kind: string;
  text: string | null;
  mediaUrl: string | null;
  sender: { id: string; display: string };
};

type StoryItem = {
  id: string;
  userId: string;
  mediaUrl: string;
  expiresAt: string;
};

type WalletState = {
  wallet: { coins: number };
  transfers: { id: string; coins: number; memo: string | null; createdAt: string; fromId: string; toId: string }[];
};

const tabs = ['home', 'explore', 'scan', 'create', 'messages'] as const;
type Tab = (typeof tabs)[number];

export default function HomePage() {
  const { data: session, status } = useSession();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [friends, setFriends] = useState<{ id: string; display: string; status: string }[]>([]);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [nightModeActive, setNightModeActive] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isTeen, setIsTeen] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  const client = useMemo(() => {
    if (session?.apiToken) {
      return createTrpcClient(session.apiToken);
    }
    return null;
  }, [session?.apiToken]);

  const loadInitialData = useCallback(async () => {
    if (!client || !session?.apiToken) return;
    const [userData, convs, storyFeed, walletData] = await Promise.all([
      client.user.me.query(),
      client.chat.list.query(),
      client.story.feed.query(),
      client.wallet.get.query()
    ]);
    setFriends(userData.friends);
    setConversations(convs);
    setStories(storyFeed as StoryItem[]);
    setWallet(walletData as WalletState);
    const teen = userData.user.role === 'TEEN';
    setIsTeen(teen);
    const nightActive = teen
      ? applyTeenNightMode(new Date(), userData.profile?.nightStart ?? undefined, userData.profile?.nightEnd ?? undefined)
      : false;
    setNightModeActive(nightActive);
    if (convs.length > 0) {
      setSelectedConversation(convs[0].id);
      const history = await client.chat.history.query({ conversationId: convs[0].id, limit: 30 });
      setMessages(history.items as MessageItem[]);
    }
    setClientReady(true);
  }, [client, session?.apiToken]);

  useEffect(() => {
    if (!client || !session?.apiToken) return;
    loadInitialData();
  }, [client, session?.apiToken, loadInitialData]);

  useEffect(() => {
    if (!session?.apiToken) return;
    const socket = connectSocket(session.apiToken);
    socket.on('message:new', (payload: MessageItem & { conversationId: string }) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === payload.conversationId
            ? {
                ...conv,
                lastMessage: {
                  id: payload.id,
                  text: payload.text,
                  createdAt: payload.createdAt,
                  sender: payload.sender
                }
              }
            : conv
        )
      );
      setMessages((prev) => (payload.conversationId === selectedConversation ? [...prev, payload] : prev));
    });
    socket.on('typing', ({ userId }) => {
      setTypingUsers((prev) => new Set(prev).add(userId));
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 1500);
    });
    socket.on('story:new', (story: StoryItem) => {
      setStories((prev) => [story, ...prev]);
    });
    socket.on('story:expired', (ids: string[]) => {
      setStories((prev) => prev.filter((story) => !ids.includes(story.id)));
    });
    socket.on('wallet:update', ({ balance }: { balance: number }) => {
      setWallet((prev) => (prev ? { ...prev, wallet: { coins: balance }, transfers: prev.transfers } : prev));
    });
    socket.on('presence:update', ({ userId, status: presence }) => {
      setFriends((prev) =>
        prev.map((friend) => (friend.id === userId ? { ...friend, status: presence } : friend))
      );
      setConversations((prev) =>
        prev.map((conv) =>
          conv.participant?.id === userId
            ? {
                ...conv,
                participant: { ...conv.participant, status: presence }
              }
            : conv
        )
      );
    });
    return () => {
      socket.removeAllListeners();
      disconnectSocket();
    };
  }, [session?.apiToken, selectedConversation]);

  useEffect(() => {
    if (!clientReady || !client) return;
    client.presence.set.mutate({ status: 'online' }).catch(() => undefined);
    return () => {
      getSocket()?.emit('presence', { status: 'offline' });
    };
  }, [clientReady, client]);

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      if (!client) return;
      setSelectedConversation(conversationId);
      const history = await client.chat.history.query({ conversationId, limit: 50 });
      setMessages(history.items as MessageItem[]);
    },
    [client]
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!client || !selectedConversation || !text.trim()) return;
      await client.chat.send.mutate({ conversationId: selectedConversation, text, kind: 'text' });
      getSocket()?.emit('typing', { conversationId: selectedConversation });
    },
    [client, selectedConversation]
  );

  const { register, handleSubmit, reset } = useForm<{ message: string }>({ defaultValues: { message: '' } });
  const messageField = register('message', {
    onChange: () => {
      if (selectedConversation) {
        getSocket()?.emit('typing', { conversationId: selectedConversation });
      }
    }
  });

  const onSubmit = handleSubmit(async ({ message }) => {
    await handleSendMessage(message);
    reset({ message: '' });
  });

  const handleTransfer = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      if (!client) return;
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const toId = formData.get('toId') as string;
      const coins = Number(formData.get('coins'));
      const memo = (formData.get('memo') as string) || undefined;
      await client.wallet.transfer.mutate({ toId, coins, memo });
      const updated = await client.wallet.get.query();
      setWallet(updated as WalletState);
      event.currentTarget.reset();
    },
    [client]
  );

  const handleIssueQR = useCallback(async () => {
    if (!client) return;
    const data = await client.friends.issueQR.mutate();
    setQrPreview(data.qrPng);
  }, [client]);

  const handleStoryUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!client) return;
      const file = event.target.files?.[0];
      if (!file) return;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      const base64 = typeof window !== 'undefined' ? window.btoa(binary) : '';
      const dataUrl = `data:${file.type};base64,${base64}`;
      const story = await client.story.post.mutate({ dataUrl });
      setStories((prev) => [story as StoryItem, ...prev]);
      event.target.value = '';
    },
    [client]
  );

  const handleScan = useCallback(
    async (result: string | null) => {
      if (!client || !result) return;
      try {
        const parsed = JSON.parse(result);
        if (parsed.payload && parsed.signature) {
          await client.friends.acceptQR.mutate({ payload: parsed.payload, signature: parsed.signature });
          const convs = await client.chat.list.query();
          setConversations(convs);
        }
      } catch (error) {
        console.error('Invalid QR payload', error);
      }
    },
    [client]
  );

  const isLoading = status === 'loading' || (status === 'authenticated' && !clientReady);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-neutral-400">Chargement…</div>;
  }

  if (!session) {
    const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const email = formData.get('email') as string;
      if (!email) return;
      await signIn('email', { email, redirect: false });
      alert('Lien magique envoyé dans les logs du serveur Next.js. Copiez-le pour vous connecter.');
    };

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0F] p-6 text-neutral-200">
        <h1 className="mb-4 text-3xl font-semibold">Dune Messenger</h1>
        <form onSubmit={handleLogin} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[#1F1F26] bg-[#15151B] p-6">
          <label className="text-sm text-neutral-400" htmlFor="email">
            Connexion par lien magique
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-xl bg-[#0B0B0F] px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline focus:outline-2 focus:outline-[#a855f7]"
            placeholder="toi@dune.local"
          />
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-br from-[#b26cff] to-[#7c3aed] py-2 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(124,58,237,.35)]"
          >
            Recevoir le lien magique
          </button>
          <p className="text-xs text-neutral-500">
            Astuce: utilisez les comptes seedés <code>moi@dune.local</code>, <code>nova@dune.local</code> ou <code>eden@dune.local</code>.
          </p>
        </form>
      </main>
    );
  }

  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversation);
  const storyBarItems = stories.map((story) => {
    const friend = friends.find((f) => f.id === story.userId);
    return {
      id: story.id,
      label: story.userId === session.user?.id ? 'Moi' : friend?.display ?? story.userId.slice(0, 4),
      seen: story.userId === session.user?.id
    };
  });

  return (
    <main className="relative min-h-screen pb-20">
      {isTeen && nightModeActive && (
        <div className="sticky top-0 z-20 flex items-center justify-between bg-[#7c3aed] px-4 py-2 text-sm text-white shadow-lg">
          <span>Mode nuit adolescent actif — messagerie en lecture seule.</span>
          <span className="text-xs text-white/70">
            {session.user?.role === 'TEEN' ? 'Demande un parent pour modifier la plage.' : ''}
          </span>
        </div>
      )}
      <section className="space-y-4 px-4 pb-4 pt-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">Bonjour {session.user?.email?.split('@')[0]}</p>
            <p className="text-sm text-neutral-400">{friends.length} amis connectés</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="rounded-full border border-[#23232A] px-3 py-1 text-xs text-neutral-400 hover:text-neutral-100"
          >
            Déconnexion
          </button>
        </header>
        <StoryBar items={storyBarItems} />
      </section>

      {activeTab === 'messages' && (
        <section className="grid gap-4 px-4 pb-6">
          <div className="space-y-3">
            <h2 className="text-sm uppercase tracking-wide text-neutral-500">Conversations</h2>
            <div className="flex gap-3 overflow-x-auto">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectConversation(conversation.id)}
                  className={`min-w-[160px] rounded-2xl border px-4 py-3 text-left transition ${
                    selectedConversation === conversation.id ? 'border-[#a855f7] bg-[#15151B]' : 'border-[#1F1F26] bg-[#0B0B0F]'
                  }`}
                >
                  <p className="font-semibold text-neutral-200">{conversation.participant?.display ?? 'Groupe'}</p>
                  <p className="text-xs text-neutral-500">
                    {conversation.lastMessage?.text
                      ? conversation.lastMessage.text
                      : 'Aucun message' }
                  </p>
                  {conversation.lastMessage?.createdAt && (
                    <p className="mt-1 text-[0.65rem] text-neutral-500">
                      {formatDistanceToNow(new Date(conversation.lastMessage.createdAt), { addSuffix: true, locale: fr })}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
          {selectedConversation && (
            <div className="rounded-3xl border border-[#1F1F26] bg-[#0B0B0F]">
              <div className="flex items-center justify-between border-b border-[#1F1F26] px-4 py-3 text-sm text-neutral-400">
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    activeConversation?.participant?.status === 'online'
                      ? 'bg-emerald-400'
                      : activeConversation?.participant?.status === 'busy'
                      ? 'bg-amber-400'
                      : 'bg-neutral-600'
                  }`} />
                  {activeConversation?.participant?.display ?? 'Conversation'}
                </span>
                {typingUsers.size > 0 && <span className="text-xs text-neutral-500">{Array.from(typingUsers).length} en train d'écrire…</span>}
              </div>
              <div className="flex max-h-[420px] flex-col gap-4 overflow-y-auto px-4 py-6">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    author={message.sender.id === session.user?.id ? 'self' : 'other'}
                    text={message.text ?? ''}
                    time={formatDistanceToNow(new Date(message.createdAt), { addSuffix: true, locale: fr })}
                  />
                ))}
              </div>
              <form onSubmit={onSubmit} className="border-t border-[#1F1F26] px-4 py-3">
                <div className="flex items-center gap-2 rounded-2xl bg-[#15151B] px-3 py-2">
                  <input
                    {...messageField}
                    disabled={isTeen && nightModeActive}
                    className="flex-1 bg-transparent text-sm text-[#EDEDED] placeholder:text-neutral-500 focus:outline-none"
                    placeholder={isTeen && nightModeActive ? 'Mode nuit actif' : 'Envoyer un message sécurisé'}
                  />
                  <button
                    type="submit"
                    className="rounded-full bg-[#23232A] px-3 py-1 text-sm text-neutral-300 hover:text-white"
                    disabled={isTeen && nightModeActive}
                  >
                    Envoyer
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {activeTab === 'create' && (
        <section className="space-y-6 px-4 pb-6">
          <div className="rounded-3xl border border-[#1F1F26] bg-[#15151B] p-6">
            <h3 className="text-lg font-semibold text-neutral-100">Publier une story</h3>
            <p className="mt-1 text-sm text-neutral-400">Choisissez une image ou un GIF, la story expirera dans 24h.</p>
            <input
              type="file"
              accept="image/*"
              onChange={handleStoryUpload}
              disabled={isTeen && nightModeActive}
              className="mt-4 text-sm text-neutral-300"
            />
          </div>
          <div className="rounded-3xl border border-[#1F1F26] bg-[#15151B] p-6">
            <h3 className="text-lg font-semibold text-neutral-100">Partager votre QR sécurisé</h3>
            <button
              onClick={handleIssueQR}
              className="mt-4 rounded-xl bg-gradient-to-br from-[#b26cff] to-[#7c3aed] px-4 py-2 text-sm font-semibold text-white"
            >
              Générer un QR
            </button>
            {qrPreview && (
              <img src={qrPreview} alt="QR d'ajout d'ami" className="mt-4 h-48 w-48 rounded-2xl border border-[#1F1F26]" />)
            }
          </div>
        </section>
      )}

      {activeTab === 'scan' && (
        <section className="px-4 pb-6">
          <div className="rounded-3xl border border-[#1F1F26] bg-[#15151B] p-6">
            <h3 className="text-lg font-semibold text-neutral-100">Scanner un QR</h3>
            <p className="mt-1 text-sm text-neutral-400">Cadrez le QR d'un ami pour créer un canal chiffré.</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#1F1F26]">
              <QrReader
                constraints={{ facingMode: 'environment' }}
                onResult={(result) => {
                  if (result) {
                    handleScan((result as unknown as { getText: () => string }).getText());
                  }
                }}
              />
            </div>
          </div>
        </section>
      )}

      {activeTab === 'home' && (
        <section className="px-4 pb-6">
          <div className="rounded-3xl border border-[#1F1F26] bg-[#15151B] p-6">
            <h3 className="text-lg font-semibold text-neutral-100">Statut & optimisation</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Statut actuel : <span className="font-medium text-neutral-100">{nightModeActive ? 'Mode nuit' : 'Disponible'}</span>
            </p>
            <p className="mt-2 text-sm text-neutral-400">
              Optimisation active : <span className="font-medium text-neutral-100">balanced</span>
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              Les contrôles parentaux s'appliquent automatiquement aux comptes ados.
            </p>
          </div>
        </section>
      )}

      {activeTab === 'explore' && (
        <section className="px-4 pb-6">
          <div className="rounded-3xl border border-[#1F1F26] bg-[#15151B] p-6">
            <h3 className="text-lg font-semibold text-neutral-100">Stories récentes</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {stories.map((story) => (
                <div key={story.id} className="overflow-hidden rounded-3xl border border-[#1F1F26]">
                  <img
                    src={story.mediaUrl.startsWith('http') ? story.mediaUrl : `${apiBase}${story.mediaUrl}`}
                    alt="story"
                    className="h-56 w-full object-cover"
                  />
                  <div className="px-4 py-2 text-xs text-neutral-400">
                    Expire {formatDistanceToNow(new Date(story.expiresAt), { addSuffix: true, locale: fr })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'messages' && wallet && (
        <section className="px-4 pb-6">
          <div className="rounded-3xl border border-[#1F1F26] bg-[#15151B] p-6">
            <h3 className="text-lg font-semibold text-neutral-100">Transférer des coins</h3>
            <p className="mt-1 text-sm text-neutral-400">Solde : {wallet.wallet.coins} coins</p>
            <form onSubmit={handleTransfer} className="mt-4 grid gap-3 md:grid-cols-4">
              <select name="toId" className="rounded-xl bg-[#0B0B0F] px-3 py-2 text-sm text-neutral-100" required>
                <option value="">Choisir un ami</option>
                {friends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.display}
                  </option>
                ))}
              </select>
              <input
                name="coins"
                type="number"
                min={1}
                className="rounded-xl bg-[#0B0B0F] px-3 py-2 text-sm text-neutral-100"
                placeholder="Coins"
                required
              />
              <input
                name="memo"
                className="rounded-xl bg-[#0B0B0F] px-3 py-2 text-sm text-neutral-100"
                placeholder="Mémo (optionnel)"
              />
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-br from-[#b26cff] to-[#7c3aed] px-3 py-2 text-sm font-semibold text-white"
              >
                Envoyer
              </button>
            </form>
            <h4 className="mt-6 text-sm font-semibold text-neutral-300">Historique</h4>
            <ul className="mt-2 space-y-2 text-sm text-neutral-400">
              {wallet.transfers.map((transfer) => (
                <li key={transfer.id} className="flex items-center justify-between rounded-xl bg-[#0B0B0F] px-3 py-2">
                  <span>
                    {transfer.coins} coins {transfer.fromId === session.user?.id ? 'envoyés' : 'reçus'}
                    {transfer.memo ? ` – ${transfer.memo}` : ''}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {formatDistanceToNow(new Date(transfer.createdAt), { addSuffix: true, locale: fr })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <BottomNav
        active={activeTab}
        unread={conversations.filter((conv) => conv.lastMessage && conv.lastMessage.sender.id !== session.user?.id).length}
        onSelect={setActiveTab}
      />
    </main>
  );
}
