import type { ReactNode } from 'react'

export default function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="mr-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-slate-500">
      {children}
    </kbd>
  )
}