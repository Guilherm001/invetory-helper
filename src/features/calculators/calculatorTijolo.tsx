import CardCalculator from "./card";

export default function CalculatorTijolo() {

  const calcularArea = (
    comprimento: number,
    altura: number
  ) => {
    return comprimento * altura;
  };

  const blocos = [
    {
      label: "Cerâmico 09 x 19 x 19",
      value: 25,
    },
    {
      label: "Cerâmico 11,5 x 14 x 24",
      value: 27,
    },
    {
      label: "Cerâmico 14 x 19 x 29",
      value: 17,
    },
    {
      label: "Cimento 09 x 19 x 29",
      value: 17,
    },
    {
      label: "Cimento 14 x 19 x 29",
      value: 17,
    },
    {
      label: "Cimento 19 x 19 x 29",
      value: 17,
    },
  ];

  const calcularBlocos = (
    comprimento: number,
    altura: number,
    blocosPorM2: number = 0
  ) => {
    const area = comprimento * altura;

    return Math.ceil(area * blocosPorM2);
  };

  return (
    <CardCalculator
      titulo="Calculadora de Blocos"

      label_comprimento="Comprimento da parede"
      label_largura="Altura da parede"
      label_button="Calcular"

      selectLabel="Tipo de bloco"
      selectOptions={blocos}

      calcularFuncao={calcularArea}
      calcularFuncao2={calcularBlocos}

      result_resposta1="Área total"
      descricao_resultado1="m²"

      result_resposta2="Quantidade necessária"
      descricao_resultado2="Blocos"
    />
  );
}