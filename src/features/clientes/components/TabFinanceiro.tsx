'use client'

import { useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import { paraNumero } from '@/features/caixa/lib/calculos'
import {
  ajustarCredito,
  salvarConfig,
  type FichaFinanceira,
  type MovCredito,
  type MovPendencia,
} from '../services/fichaService'
import { FORMA_ROTULO, dataCurta, dataHora, reais } from '../lib/formatar'

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#079C9C] focus:ring-2 focus:ring-[#079C9C]/20 md:text-sm'

const TIPO_CREDITO: Record<MovCredito['tipo'], string> = {
  devolucao: 'Devolução',
  manual_credito: 'Crédito manual',
  manual_debito: 'Débito manual',
  uso: 'Usado em pedido',
}

function Secao({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-700">{titulo}</h4>
      {sub && <p className="mb-3 text-xs text-slate-400">{sub}</p>}
      {!sub && <div className="mb-3" />}
      {children}
    </section>
  )
}

function Mensagem({ m }: { m: { tipo: 'ok' | 'erro'; texto: string } | null }) {
  if (!m) return null
  return (
    <p
      role={m.tipo === 'erro' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
        m.tipo === 'erro'
          ? 'border-red-200 bg-red-50 text-red-600'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {m.tipo === 'erro' ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      )}
      {m.texto}
    </p>
  )
}

export default function TabFinanceiro({
  clienteId,
  ficha,
  onMudou,
}: {
  clienteId: string
  ficha: FichaFinanceira
  onMudou: () => Promise<void>
}) {
  const { config, saldos } = ficha

  // ---------- pendência ----------
  const [permitida, setPermitida] = useState(config.permitida)
  const [dias, setDias] = useState(String(config.dias))
  const [limite, setLimite] = useState(config.limite > 0 ? String(config.limite).replace('.', ',') : '')
  const [salvandoCfg, setSalvandoCfg] = useState(false)
  const [msgCfg, setMsgCfg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const limiteNum = paraNumero(limite)
  const abaixoDoQueDeve = permitida && Number.isFinite(limiteNum) && limiteNum < saldos.devendo

  const guardarConfig = async () => {
    setMsgCfg(null)
    const d = Number(dias)
    if (!Number.isInteger(d) || d < 1 || d > 365) {
      setMsgCfg({ tipo: 'erro', texto: 'O prazo deve ser de 1 a 365 dias.' })
      return
    }
    const l = limite.trim() === '' ? 0 : paraNumero(limite)
    if (!Number.isFinite(l) || l < 0) {
      setMsgCfg({ tipo: 'erro', texto: 'Limite inválido.' })
      return
    }
    if (permitida && l <= 0) {
      setMsgCfg({ tipo: 'erro', texto: 'Defina o limite de pendência para liberar.' })
      return
    }

    setSalvandoCfg(true)
    try {
      await salvarConfig(clienteId, { permitida, dias: d, limite: l })
      await onMudou()
      setMsgCfg({
        tipo: 'ok',
        texto: permitida ? 'Pendência liberada para este cliente.' : 'Pendência bloqueada para este cliente.',
      })
    } catch (e) {
      setMsgCfg({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Não foi possível salvar' })
    } finally {
      setSalvandoCfg(false)
    }
  }

  // ---------- crédito manual ----------
  const [tipoAjuste, setTipoAjuste] = useState<'credito' | 'debito'>('credito')
  const [valorAjuste, setValorAjuste] = useState('')
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [ajustando, setAjustando] = useState(false)
  const [msgAjuste, setMsgAjuste] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const lancarAjuste = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsgAjuste(null)
    const v = paraNumero(valorAjuste)
    if (!Number.isFinite(v) || v <= 0) {
      setMsgAjuste({ tipo: 'erro', texto: 'Informe um valor maior que zero.' })
      return
    }
    if (motivoAjuste.trim().length < 3) {
      setMsgAjuste({ tipo: 'erro', texto: 'Informe o motivo.' })
      return
    }

    setAjustando(true)
    try {
      await ajustarCredito(clienteId, tipoAjuste, v, motivoAjuste.trim())
      await onMudou()
      setValorAjuste('')
      setMotivoAjuste('')
      setMsgAjuste({
        tipo: 'ok',
        texto: tipoAjuste === 'credito' ? 'Crédito lançado.' : 'Crédito removido.',
      })
    } catch (err) {
      setMsgAjuste({ tipo: 'erro', texto: err instanceof Error ? err.message : 'Não foi possível lançar' })
    } finally {
      setAjustando(false)
    }
  }

  const disponivel = Math.max(0, config.limite - saldos.devendo)

  return (
    <div className="space-y-4">
      {/* pendência */}
      <Secao
        titulo="Pendência (venda a prazo)"
        sub="Vem bloqueada. Só vende a prazo quem o dono liberar aqui."
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              checked={permitida}
              onChange={(e) => setPermitida(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[#079C9C]"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-700">
                Permitir pendência para este cliente
              </span>
              <span className="block text-xs text-slate-500">
                Marque só se você confia no cliente. Dá para mudar o prazo e o limite quando quiser.
              </span>
            </span>
          </label>

          {permitida && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="pend-dias" className="block text-sm font-semibold text-slate-700">
                  Prazo (dias)
                </label>
                <input
                  id="pend-dias"
                  value={dias}
                  onChange={(e) => setDias(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  inputMode="numeric"
                  className={inputClass}
                />
                <p className="text-xs text-slate-400">Quantos dias ele pode ficar devendo.</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pend-limite" className="block text-sm font-semibold text-slate-700">
                  Limite (R$)
                </label>
                <input
                  id="pend-limite"
                  value={limite}
                  onChange={(e) => setLimite(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={inputClass}
                />
                <p className="text-xs text-slate-400">Quanto ele pode dever ao mesmo tempo.</p>
              </div>
            </div>
          )}

          {abaixoDoQueDeve && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              O limite está abaixo do que ele já deve ({reais(saldos.devendo)}). Ele não consegue nova
              pendência até pagar a diferença.
            </p>
          )}

          {config.permitida && (
            <p className="text-sm text-slate-600">
              Hoje: limite de <strong>{reais(config.limite)}</strong>, prazo de{' '}
              <strong>{config.dias} dias</strong>. Disponível: <strong>{reais(disponivel)}</strong>.
              {saldos.proximo_vencimento && (
                <> Próximo vencimento: {dataCurta(saldos.proximo_vencimento)}.</>
              )}
            </p>
          )}

          <Mensagem m={msgCfg} />

          <Button
            type="button"
            onClick={guardarConfig}
            disabled={salvandoCfg}
            className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {salvandoCfg && <Loader2 className="size-4 animate-spin" />}
            Salvar configuração
          </Button>
        </div>
      </Secao>

      {/* crédito manual */}
      <Secao
        titulo="Crédito do cliente"
        sub="O crédito de devolução é lançado no caixa. Aqui você faz ajustes manuais."
      >
        <form onSubmit={lancarAjuste} className="space-y-3">
          <div role="radiogroup" aria-label="Tipo de ajuste" className="grid grid-cols-2 gap-2">
            {(
              [
                ['credito', 'Lançar crédito', Plus],
                ['debito', 'Remover crédito', Minus],
              ] as const
            ).map(([valor, rotulo, Icone]) => (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={tipoAjuste === valor}
                onClick={() => setTipoAjuste(valor)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  tipoAjuste === valor
                    ? valor === 'credito'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-red-300 bg-red-50 text-red-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icone className="size-4" />
                {rotulo}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
            <input
              value={valorAjuste}
              onChange={(e) => setValorAjuste(e.target.value)}
              inputMode="decimal"
              placeholder="Valor (R$)"
              aria-label="Valor do ajuste"
              className={inputClass}
            />
            <input
              value={motivoAjuste}
              onChange={(e) => setMotivoAjuste(e.target.value)}
              maxLength={200}
              placeholder="Motivo"
              aria-label="Motivo do ajuste"
              className={inputClass}
            />
          </div>

          <p className="text-xs text-slate-400">
            Saldo atual: <strong>{reais(saldos.credito)}</strong>. Remover não deixa o saldo ficar negativo.
          </p>

          <Mensagem m={msgAjuste} />

          <Button
            type="submit"
            disabled={ajustando}
            className="gap-2 bg-[#079C9C] text-white hover:bg-[#079C9C]/90"
          >
            {ajustando && <Loader2 className="size-4 animate-spin" />}
            {tipoAjuste === 'credito' ? 'Lançar crédito' : 'Remover crédito'}
          </Button>
        </form>
      </Secao>

      {/* extratos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Extrato de crédito">
          {ficha.credito.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Nenhum lançamento.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ficha.credito.map((m) => (
                <li key={m.id} className={`flex items-start justify-between gap-3 py-2 ${m.estornado ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 text-sm">
                    <p className={`font-medium text-slate-800 ${m.estornado ? 'line-through' : ''}`}>
                      {TIPO_CREDITO[m.tipo]}
                      {m.tipo === 'uso' && m.venda_numero ? ` nº ${m.venda_numero}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dataHora(m.criado_em)} · {m.feito_por}
                      {m.estornado ? ' · desfeito' : ''}
                    </p>
                    {m.motivo && <p className="text-xs text-slate-500">{m.motivo}</p>}
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${m.valor > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {m.valor > 0 ? '+' : '-'} {reais(Math.abs(m.valor))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Extrato de pendência">
          {ficha.pendencia.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">Nenhum lançamento.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ficha.pendencia.map((m: MovPendencia) => (
                <li key={m.id} className={`flex items-start justify-between gap-3 py-2 ${m.estornado ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 text-sm">
                    <p className={`font-medium text-slate-800 ${m.estornado ? 'line-through' : ''}`}>
                      {m.tipo === 'venda'
                        ? `Pedido nº ${m.venda_numero ?? '—'} a prazo`
                        : `Pagamento${m.forma ? ` (${FORMA_ROTULO[m.forma] ?? m.forma})` : ''}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      {dataHora(m.criado_em)} · {m.feito_por}
                      {m.estornado ? ' · desfeito' : ''}
                    </p>
                    {m.tipo === 'venda' && m.vencimento && (
                      <p className="text-xs text-slate-500">Vence em {dataCurta(m.vencimento)}</p>
                    )}
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${m.tipo === 'venda' ? 'text-amber-600' : 'text-emerald-700'}`}>
                    {m.tipo === 'venda' ? '+' : '-'} {reais(m.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  )
}