import { useState } from 'react'
import { api } from '../api'
import type { LoginResult } from '../api'
import { Btn, Card, Field, Header, Note } from '../ui'

export function LoginScreen({ onSuccess }: { onSuccess: (user: LoginResult) => void }) {
  const [login, setLogin] = useState('')
  const [hint, setHint] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <Header title="Вход в Moby" subtitle="Семейный банкинг" tall />
      <div className="-mt-12 space-y-4 px-4 pb-6">
        <Card className="space-y-4 shadow-[0_10px_30px_-18px_rgba(20,20,22,0.35)]">
          <Field
            label="Логин"
            value={login}
            onChange={(v) => { setLogin(v); setError(null) }}
            placeholder="Ваше имя"
          />
          {error && <Note tone="red" icon="x">{error}</Note>}
          <Btn onClick={async () => {
            try {
              const user = await api.login(login)
              onSuccess(user)
            } catch (e) {
              setError((e as Error).message || 'Не удалось войти')
            }
          }}
          >
            Войти
          </Btn>
        </Card>

        <button
          type="button"
          onClick={() => setHint((v) => !v)}
          className="w-full text-center text-sm font-medium text-[#2F6FE4]"
        >
          Нет входа? Оформить пакет
        </button>

        {hint && (
          <Note icon="shield">
            В демо семья Ивановых уже есть. Пакет оформляет родитель — войдите словом «мама».
            Коды: мама, миша, аня.
          </Note>
        )}

        <p className="px-1 text-center text-xs text-muted">
          Для демо: мама · миша · аня
        </p>
      </div>
    </>
  )
}
