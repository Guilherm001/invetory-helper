// só conta diálogos realmente abertos e visíveis
export function dialogoAberto(): boolean {
  const els = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [role="alertdialog"]'
  )
  return Array.from(els).some((el) => {
    if (el.getAttribute('data-state') === 'closed') return false
    if (el.closest('[aria-hidden="true"], [hidden]')) return false
    if (el.getClientRects().length === 0) return false
    return getComputedStyle(el).visibility !== 'hidden'
  })
}

// true se a pessoa está digitando em algum campo
export function digitando(alvo: EventTarget | null): boolean {
  return !!(alvo as HTMLElement | null)?.closest?.(
    'input, textarea, select, [contenteditable="true"]'
  )
}