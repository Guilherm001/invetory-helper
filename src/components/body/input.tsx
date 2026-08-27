import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function InputDemo() {
  return (
    <Field>
      <Input id="input-demo-api-key" type="password" placeholder="digite o nome do produto desejado"
      className="h-10"
      />
      
    </Field>
  )
}
