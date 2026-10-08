import { SiHackthebox } from "react-icons/si"
import { SlClock } from "react-icons/sl"
import { LuArrowUp } from "react-icons/lu"
import type { Product } from "../services/listService"

interface CardsProps {
  products: Product[]
  loading?: boolean
}

export default function Cards({ products, loading = false }: CardsProps) {
  const total = products.length
  const pendentes = products.filter((p) => p.status === "Pendente").length
  const altaPrioridade = products.filter((p) => p.priority === "Alta").length

  const items = [
    {
      label: "Total de Produtos",
      value: total,
      bg: "bg-[#8ed6d6]",
      icon: <SiHackthebox color="#079C9C" size={25} />,
    },
    {
      label: "Pendentes",
      value: pendentes,
      bg: "bg-[#FEF4DB]",
      icon: <SlClock color="#E3A534" size={25} />,
    },
    {
      label: "Alta Prioridade",
      value: altaPrioridade,
      bg: "bg-[#f8c1c1]",
      icon: <LuArrowUp color="#c70000" size={25} />,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-md mb-4 mx-4 md:mx-10"
        >
          <div
            className={`flex items-center justify-center w-13 h-13 ${item.bg} rounded-full shadow-md`}
          >
            {item.icon}
          </div>
          <div>
            <p className="text-lg text-gray-800">{item.label}</p>
            <p className="text-2xl font-bold text-gray-800">
              {loading ? "-" : item.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}