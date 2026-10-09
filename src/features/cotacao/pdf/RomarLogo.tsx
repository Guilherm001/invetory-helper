import { Svg, Polygon, Rect, Text } from '@react-pdf/renderer'

const RED = '#E4312F'
const GREEN = '#1E9E48'

export default function RomarLogo({ height = 52 }: { height?: number }) {
  const width = (height * 275) / 171

  return (
    <Svg width={width} height={height} viewBox="0 0 275 171">
      {/* casa: triângulo vermelho + telhado verde */}
      <Polygon points="68,8 112,86 26,86" fill={RED} />
      <Polygon points="80,8 232,8 264,86 120,86" fill={GREEN} />

      {/* nome */}
      <Text
        x={145}
        y={138}
        textAnchor="middle"
        fill={GREEN}
        style={{ fontFamily: 'Helvetica-Bold', fontSize: 60 }}
      >
        ROMAR
      </Text>

      {/* barras */}
      <Rect x={26} y={148} width={88} height={16} fill={RED} />
      <Rect x={124} y={148} width={140} height={16} fill={GREEN} />
    </Svg>
  )
}