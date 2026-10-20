import { useCallback, useEffect, useRef, useState } from 'react'

// Загрузка данных экрана. pollMs > 0 — тихо обновляем (родитель видит новые запросы без перезагрузки).
export function useData<T>(fetcher: () => Promise<T>, deps: unknown[] = [], pollMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef(fetcher)
  ref.current = fetcher

  const load = useCallback(async () => {
    try {
      setData(await ref.current())
      setError(null)
    } catch (e) {
      setError((e as Error).message || 'Ошибка загрузки')
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, deps)
  useEffect(() => {
    if (!pollMs) return
    const t = setInterval(load, pollMs)
    return () => clearInterval(t)
  }, [pollMs, load])

  return { data, error, reload: load }
}
