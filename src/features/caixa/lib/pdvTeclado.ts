import type { MouseEvent } from 'react'

// só conta como "janela aberta" uma janela que está de fato aberta
const DIALOGO_ABERTO =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'

export const temDialogoAberto = () =>
  typeof document !== 'undefined' && !!document.querySelector(DIALOGO_ABERTO)

// o alvo da tecla é um campo de digitar
export const emCampo = (alvo: EventTarget | null) =>
  !!alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes((alvo as HTMLElement).tagName)

// usado em onMouseDown: o clique funciona, mas o botão não puxa o cursor para ele
// (assim o teclado continua valendo depois de clicar)
export const naoTirarFoco = (e: MouseEvent) => e.preventDefault()