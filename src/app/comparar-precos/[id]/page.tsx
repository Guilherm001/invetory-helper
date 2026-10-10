import ComparacaoDetalhe from '@/features/comparar-precos/components/ComparacaoDetalhe'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ComparacaoDetalhe id={id} />
}