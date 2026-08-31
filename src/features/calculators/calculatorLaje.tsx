import CardCalculator from "./card";
import Image from "next/image";

export default function CalculatotLaje() {

 

  const calcularLajota = (comprimento: number, largura:number) => {
    return (comprimento * largura)* 11.5;
  }

  const calcularTrilho = (largura:number) => {
    return Math.ceil(largura / 0.43)
  }

   const calcularArea = (comprimento: number, largura: number) => {

    const resultadoTrilho = calcularTrilho(largura)

    return (resultadoTrilho * 0.43) * comprimento;

  };

  return (
    <div>
      <CardCalculator
        titulo="Calculadora de Laje"

        label_comprimento="Digite comprimento (tamanho dos trilhos)"
        label_largura="Digite a largura"

        placeholder_comprimento="Comprimento"
        placeholder_largura="Largura"

        label_button="Calcular"

        result_resposta1="Área total a cobrar"

        calcularFuncao={calcularArea}
        descricao_resultado1=""

        icone2={
          <Image src="/download (1).svg" width={30} height={30} alt="Forro" />
            }
        calcularFuncao2={calcularLajota} 
        descricao_resultado2="Lajotas"
        
        icone3={
          <Image src="/download (2).svg" width={30} height={30} alt="Forro" />
            }
        calcularFuncao3={calcularTrilho}
        descricao_resultado3="Trilhos"
        
      />
    </div>
  );
}