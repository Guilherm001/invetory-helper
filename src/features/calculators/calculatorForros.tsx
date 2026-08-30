import CardCalculator from "./card";
import Image from "next/image";

export default function CalculatorForros() {

  const calcularArea = (comprimento: number, largura: number) => {
    return comprimento * largura;
  };
  const calcularQTD = (largura: number) => {
    return 5 * largura
  }

  return (
    <div>
      <CardCalculator
        titulo="Calculadora Forros"

        label_comprimento="Digite comprimento (tamanho do forro)"
        label_largura="Digite a largura"

        placeholder_comprimento="Comprimento"
        placeholder_largura="Largura"

        label_button="Calcular"

        calcularFuncao={calcularArea}
        descricao_resultado1="m2"

        icone2={
          <Image src="/download.svg" width={30} height={30} alt="Forro" />
            }
        calcularFuncao2={calcularQTD} 
        descricao_resultado2="Barras de forro"
        

        result_resposta1="Área total em (m²)"
      />
    </div>
  );
}