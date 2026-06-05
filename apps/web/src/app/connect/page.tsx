'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api, getToken } from '@/lib/api';
import { BotStatus } from '@/lib/types';

export default function ConnectPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  const statusQuery = useQuery({
    queryKey: ['bot-status'],
    queryFn: async () => {
      const { data } = await api.get<BotStatus>('/telegram/status');
      return data;
    },
    refetchInterval: 5000,
  });

  const status = statusQuery.data;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-xl font-bold text-slate-900">Подключение Telegram</h1>
        <p className="mt-1 text-sm text-slate-500">
          Платформа работает через Telegram-бота. Клиенты пишут боту, их
          сообщения попадают в общий инбокс, а менеджеры отвечают из интерфейса.
        </p>

        <div className="mt-6 rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">
              Статус бота
            </span>
            <StatusBadge status={status} />
          </div>
          {status?.username && (
            <p className="mt-2 text-sm text-slate-500">
              Бот:{' '}
              <a
                href={`https://t.me/${status.username}`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-600 hover:underline"
              >
                @{status.username}
              </a>
            </p>
          )}
          {status && !status.configured && (
            <p className="mt-2 text-sm text-amber-600">
              Токен бота не задан. Добавьте <code>TELEGRAM_BOT_TOKEN</code> в
              <code>.env</code> и перезапустите API.
            </p>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">
            Как создать бота (1 минута)
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Откройте в Telegram{' '}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:underline"
              >
                @BotFather
              </a>
            </li>
            <li>
              Отправьте команду <code>/newbot</code> и следуйте инструкциям
            </li>
            <li>Скопируйте выданный токен</li>
            <li>
              Вставьте его в <code>.env</code> как{' '}
              <code>TELEGRAM_BOT_TOKEN</code> и перезапустите API
            </li>
            <li>Напишите своему боту — диалог появится в инбоксе</li>
          </ol>
        </div>

        <button
          onClick={() => router.replace('/inbox')}
          className="mt-8 w-full rounded-lg bg-brand-600 py-2.5 font-medium text-white transition hover:bg-brand-700"
        >
          Перейти в инбокс
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: BotStatus }) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
        проверка…
      </span>
    );
  }
  if (status.online) {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        онлайн
      </span>
    );
  }
  if (status.configured) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
        запускается…
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
      не настроен
    </span>
  );
}
