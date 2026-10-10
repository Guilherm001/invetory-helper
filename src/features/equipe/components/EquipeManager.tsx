'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, Trash2, UserPlus, Users } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  criarFuncionario,
  redefinirSenhaFuncionario,
  removerFuncionario,
  type Resultado,
} from '../actions'

type Funcionario = { id: string; nome: string | null; email: string | null }

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20'

export function EquipeManager({ funcionarios }: { funcionarios: Funcionario[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [trocando, setTrocando] = useState<string | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)

  const executar = (
    fn: () => Promise<Resultado>,
    textoOk: string,
    depois?: () => void
  ) =>
    start(async () => {
      setMsg(null)
      try {
        const r = await fn()
        if (r.ok) {
          setMsg({ tipo: 'ok', texto: textoOk })
          depois?.()
          router.refresh()
        } else {
          setMsg({ tipo: 'erro', texto: r.erro })
        }
      }  catch (err) {
  console.error('[equipe]', err)
  const digest = (err as { digest?: string })?.digest
  setMsg({
    tipo: 'erro',
    texto: `Falha ao falar com o servidor${digest ? ` (código ${digest})` : ''}`,
  })
}
    })

  return (
    <div className="w-full pb-10">
      <div className="mt-7 py-4">
        <h3 className="text-3xl font-bold">Equipe</h3>
        <p className="text-sm text-gray-400">
          Crie o acesso dos funcionários. Eles veem apenas Produtos e Calculadora.
        </p>
      </div>

      {msg && (
        <p
          role={msg.tipo === 'erro' ? 'alert' : 'status'}
          className={`mb-4 rounded-lg border px-3 py-2 text-sm md:max-w-xl ${
            msg.tipo === 'erro'
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {msg.texto}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          executar(
            () => criarFuncionario({ nome, email, senha }),
            'Funcionário criado.',
            () => {
              setNome('')
              setEmail('')
              setSenha('')
            }
          )
        }}
        className="mb-8 space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:max-w-xl"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <UserPlus className="size-4 text-[#079C9C]" />
          Novo funcionário
        </p>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome (ex: Balcão)"
          className={inputClass}
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="Email de acesso"
          autoComplete="off"
          className={inputClass}
        />
        <input
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          type="text"
          placeholder="Senha (mínimo 6 caracteres)"
          autoComplete="off"
          className={inputClass}
        />
        <Button
          type="submit"
          disabled={pending}
          className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Criar funcionário
        </Button>
        <p className="text-xs text-slate-400">
          O email não precisa existir de verdade, mas então a recuperação de senha por
          email não funciona para ele. Se esquecer, você define uma nova senha aqui.
        </p>
      </form>

      <div className="space-y-2 md:max-w-xl">
        {funcionarios.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-center">
            <Users className="size-8 text-slate-300" />
            <p className="text-sm text-slate-500">Nenhum funcionário ainda.</p>
          </div>
        )}

        {funcionarios.map((f) => (
          <div
            key={f.id}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{f.nome || 'Sem nome'}</p>
                <p className="truncate text-sm text-slate-500">{f.email}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  title="Trocar senha"
                  aria-label={`Trocar senha de ${f.nome}`}
                  onClick={() => {
                    setTrocando(trocando === f.id ? null : f.id)
                    setNovaSenha('')
                  }}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-[#079C9C]/10 hover:text-[#079C9C]"
                >
                  <KeyRound className="size-[18px]" />
                </button>
                <button
                  type="button"
                  title="Remover"
                  aria-label={`Remover ${f.nome}`}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Remover o acesso de ${f.nome || f.email}?`)) return
                    executar(() => removerFuncionario(f.id), 'Funcionário removido.')
                  }}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-[18px]" />
                </button>
              </div>
            </div>

            {trocando === f.id && (
              <div className="mt-3 flex gap-2">
                <input
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="Nova senha"
                  autoComplete="off"
                  className={inputClass}
                />
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    executar(
                      () => redefinirSenhaFuncionario(f.id, novaSenha),
                      'Senha alterada.',
                      () => {
                        setTrocando(null)
                        setNovaSenha('')
                      }
                    )
                  }
                  className="bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
                >
                  Salvar
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}