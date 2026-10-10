import { ArrowDown, ArrowUp } from 'lucide-react'
import { formatarReais } from '@/features/comparar-precos/utils/melhorPreco'
import { LIMITE_ALTA, formatarVariacao } from '../utils/estatisticas'
import { variacaoContra, type Referencia } from '../utils/referencias'

interface Props {
  preco: number | undefined
  referencia: Referencia | undefined
}

export default function IndicadorHistorico({ preco, referencia }: Props) {
  if (preco === undefined || !referencia) return null

  const v = variacaoContra(referencia, preco)
  const menorJaVisto = preco <= referencia.menor
  const dica = `Última vez: ${formatarReais(referencia.ultimo)} em ${new Date(
    referencia.data
  ).toLocaleDateString('pt-BR')}`

  if (v === null && !menorJaVisto) return null

  let cor = 'text-slate-500'
  let icone: React.ReactNode = null
  let texto = 'igual à última vez'

  if (v !== null && v !== 0) {
    const subiu = v > 0
    cor = subiu
      ? v >= LIMITE_ALTA
        ? 'font-semibold text-red-600'
        : 'text-red-500'
      : 'text-emerald-600'
    icone = subiu ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
    texto = `${formatarVariacao(Math.abs(v)).replace('+', '')} vs. última vez`
  }

  return (
    <p
      title={dica}
      className={`mt-0.5 flex flex-wrap items-center justify-end gap-x-1 text-right text-[11px] ${cor}`}
    >
      {v !== null && (
        <span className="inline-flex items-center gap-0.5">
          {icone}
          {texto}
        </span>
      )}
      {menorJaVisto && (
        <span className="font-semibold text-emerald-700">
          {v !== null ? '· ' : ''}menor já visto
        </span>
      )}
    </p>
  )
}