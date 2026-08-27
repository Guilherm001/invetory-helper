import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const items = [
  { label: "Baixa", value: "Baixa" },
  { label: "Media", value: "Media" },
  { label: "Alta prioridade", value: "Alta prioridade" },
]

export function SelectDemo() {
  return (
    <Select items={items} >
      <SelectTrigger className="w-full max-w-30 h-full max-h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Status</SelectLabel>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
