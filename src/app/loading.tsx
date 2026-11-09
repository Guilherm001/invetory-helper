// app/loading.tsx
// Aparece na hora ao clicar num link, enquanto a próxima rota carrega.
// Rotas que tiverem o próprio loading.tsx usam o delas.
export default function Loading() {
  return (
    <div className="w-full animate-pulse pb-10" aria-busy="true">
      <div className="mt-7 py-4">
        <div className="h-8 w-64 rounded bg-slate-100" />
        <div className="mt-2 h-4 w-96 max-w-full rounded bg-slate-100" />
      </div>

      <div className="mb-3 h-10 w-full rounded-lg bg-slate-100" />

      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-14 rounded-xl border border-slate-100 bg-slate-50"
          />
        ))}
      </div>
    </div>
  )
}