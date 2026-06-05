'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, clearToken, getToken } from '@/lib/api';
import { disconnectSocket, getSocket } from '@/lib/socket';
import {
  Conversation,
  ConversationUpdatedEvent,
  InboxFilter,
  Manager,
  Message,
  MessageNewEvent,
  REALTIME_EVENTS,
} from '@/lib/types';

export default function InboxPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; email: string }>('/auth/me');
      return data;
    },
  });

  const managersQuery = useQuery({
    queryKey: ['managers'],
    queryFn: async () => {
      const { data } = await api.get<Manager[]>('/users');
      return data;
    },
  });

  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const { data } = await api.get<Conversation[]>('/conversations');
      return data;
    },
  });

  useEffect(() => {
    if (!getToken()) return;
    const socket = getSocket();
    const onNew = (payload: MessageNewEvent) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (prev) => {
        const others = (prev ?? []).filter(
          (c) => c.id !== payload.conversation.id,
        );
        return [payload.conversation, ...others];
      });
      queryClient.setQueryData<Message[]>(
        ['messages', payload.conversation.id],
        (prev) => {
          if (!prev) return prev;
          if (prev.some((m) => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        },
      );
    };
    const onUpdated = (payload: ConversationUpdatedEvent) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (prev) =>
        (prev ?? []).map((c) =>
          c.id === payload.conversation.id ? payload.conversation : c,
        ),
      );
    };
    socket.on(REALTIME_EVENTS.MESSAGE_NEW, onNew);
    socket.on(REALTIME_EVENTS.CONVERSATION_UPDATED, onUpdated);
    return () => {
      socket.off(REALTIME_EVENTS.MESSAGE_NEW, onNew);
      socket.off(REALTIME_EVENTS.CONVERSATION_UPDATED, onUpdated);
    };
  }, [queryClient]);

  const conversations = conversationsQuery.data ?? [];
  const myId = meQuery.data?.id;

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'mine') {
      list = list.filter((c) => c.assignedTo?.id === myId);
    } else if (filter === 'unassigned') {
      list = list.filter((c) => !c.assignedTo);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        [c.contact.name, c.contact.username, c.lastMessageText]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [conversations, filter, search, myId]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  function logout() {
    clearToken();
    disconnectSocket();
    router.replace('/login');
  }

  const counts = useMemo(
    () => ({
      all: conversations.length,
      mine: conversations.filter((c) => c.assignedTo?.id === myId).length,
      unassigned: conversations.filter((c) => !c.assignedTo).length,
    }),
    [conversations, myId],
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-brand-600">Omnicom</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            Telegram bot
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {meQuery.data && (
            <span className="hidden text-slate-400 sm:inline">
              {meQuery.data.email}
            </span>
          )}
          <button
            onClick={() => router.push('/connect')}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
          >
            Бот
          </button>
          <button
            onClick={logout}
            className="rounded-lg px-3 py-1.5 font-medium text-slate-400 hover:text-slate-600"
          >
            Выйти
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-80 flex-col border-r border-slate-200 bg-white">
          <div className="space-y-2 border-b border-slate-100 p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск диалога…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
            <div className="flex gap-1 text-xs font-medium">
              <FilterTab
                label={`Все ${counts.all}`}
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              />
              <FilterTab
                label={`Мои ${counts.mine}`}
                active={filter === 'mine'}
                onClick={() => setFilter('mine')}
              />
              <FilterTab
                label={`Без менеджера ${counts.unassigned}`}
                active={filter === 'unassigned'}
                onClick={() => setFilter('unassigned')}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsQuery.isLoading && (
              <p className="p-4 text-sm text-slate-400">Загрузка…</p>
            )}
            {!conversationsQuery.isLoading && filtered.length === 0 && (
              <p className="p-4 text-sm text-slate-400">
                Нет диалогов. Напишите вашему боту в Telegram — диалог появится
                здесь.
              </p>
            )}
            {filtered.map((c) => (
              <ConversationItem
                key={c.id}
                conversation={c}
                active={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-slate-50">
          {selected ? (
            <Thread
              conversation={selected}
              managers={managersQuery.data ?? []}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              Выберите диалог слева
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 transition ${
        active
          ? 'bg-brand-50 text-brand-700'
          : 'text-slate-500 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function contactTitle(conversation: Conversation): string {
  return (
    conversation.contact.name ||
    (conversation.contact.username
      ? '@' + conversation.contact.username
      : conversation.contact.externalId)
  );
}

function ConversationItem({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const title = contactTitle(conversation);
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left transition ${
        active ? 'bg-brand-50' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
        {title.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate font-medium text-slate-800">{title}</p>
          {conversation.unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs text-white">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <p className="truncate text-sm text-slate-500">
          {conversation.lastMessageText ?? 'Нет сообщений'}
        </p>
        <div className="mt-1">
          {conversation.assignedTo ? (
            <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
              {conversation.assignedTo.name || conversation.assignedTo.email}
            </span>
          ) : (
            <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-600">
              без менеджера
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function Thread({
  conversation,
  managers,
}: {
  conversation: Conversation;
  managers: Manager[];
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: async () => {
      const { data } = await api.get<Message[]>(
        `/conversations/${conversation.id}/messages`,
      );
      return data;
    },
  });

  useEffect(() => {
    api.post(`/conversations/${conversation.id}/read`).catch(() => undefined);
  }, [conversation.id]);

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (value: string) => {
      const { data } = await api.post<Message>(
        `/conversations/${conversation.id}/messages`,
        { text: value },
      );
      return data;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(
        ['messages', conversation.id],
        (prev) => {
          if (!prev) return [message];
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        },
      );
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (userId: string | null) => {
      const { data } = await api.post<Conversation>(
        `/conversations/${conversation.id}/assign`,
        { userId },
      );
      return data;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (prev) =>
        (prev ?? []).map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });

  function onSend(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    sendMutation.mutate(value);
  }

  const title = contactTitle(conversation);

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
            {title.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-slate-800">{title}</p>
            {conversation.contact.username && (
              <p className="text-xs text-slate-400">
                @{conversation.contact.username}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Менеджер:</span>
          <select
            value={conversation.assignedTo?.id ?? ''}
            onChange={(e) =>
              assignMutation.mutate(e.target.value === '' ? null : e.target.value)
            }
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">— не назначен —</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-6 py-4">
        {messagesQuery.isLoading && (
          <p className="text-sm text-slate-400">Загрузка сообщений…</p>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSend}
        className="flex items-center gap-2 border-t border-slate-200 bg-white px-6 py-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишите сообщение…"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={sendMutation.isPending || !text.trim()}
          className="rounded-full bg-brand-600 px-5 py-2 font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          Отправить
        </button>
      </form>
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const out = message.direction === 'out';
  return (
    <div className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
          out
            ? 'rounded-br-sm bg-brand-600 text-white'
            : 'rounded-bl-sm bg-white text-slate-800'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.text}</p>
        <p
          className={`mt-1 text-right text-[10px] ${
            out ? 'text-brand-100' : 'text-slate-400'
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
