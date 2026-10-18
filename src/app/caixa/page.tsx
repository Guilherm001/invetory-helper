import CaixaEscolha from '@/features/caixa/components/CaixaEscolha'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>
}) {
  const { layout } = await searchParams
  return <CaixaEscolha inicial={layout === 'pdv' ? 'pdv' : 'classico'} />
}