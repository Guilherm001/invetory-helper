  const desconto = Number(venda.desconto ?? 0)
  if (desconto > 0) {
    c.linha(esquerdaDireita('Subtotal', reais(venda.total)))
    c.linha(esquerdaDireita('Desconto', `- ${reais(desconto)}`))
  }
  c.negrito(true).tamanho(0x01).linha(esquerdaDireita('TOTAL', reais(Number(venda.total) - desconto))).tamanho(0).negrito(false)