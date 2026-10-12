/**
 * Sparkline — minimal 8-week volume trend (P4a dashboard).
 * react-native-svg; no chart library. Renders a smooth polyline with a
 * subtle area fill. All-zero data draws a flat baseline, never a broken
 * chart. Uses the success (teal) token — the accent green is reserved for
 * the complete-a-set action per the theme rules.
 */
import type { JSX } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../theme';

interface SparklineProps {
  /** One value per week, oldest first. */
  values: number[];
  width: number;
  height?: number;
}

/** Max render width — the chart shouldn't stretch across a tablet. */
const MAX_WIDTH = 560;

function buildPath(values: number[], width: number, height: number): { line: string; area: string } {
  const n = values.length;
  if (n === 0) return { line: '', area: '' };
  const max = Math.max(...values, 1); // avoid div-by-zero; all-zero → flat
  const pad = 4;
  const stepX = n === 1 ? 0 : (width - pad * 2) / (n - 1);
  const pts = values.map((v, i) => {
    const x = n === 1 ? width / 2 : pad + i * stepX;
    const y = height - pad - (v / max) * (height - pad * 2);
    return { x, y };
  });
  let line: string;
  if (n === 1) {
    // Single point: flat baseline across the width, not a 1px stub.
    const y = pts[0].y.toFixed(1);
    line = `M${pad.toFixed(1)},${y} L${(width - pad).toFixed(1)},${y}`;
  } else {
    line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const firstX = n === 1 ? pad : first.x;
  const lastX = n === 1 ? width - pad : last.x;
  const area = `${line} L${lastX.toFixed(1)},${height.toFixed(1)} L${firstX.toFixed(1)},${height.toFixed(1)} Z`;
  return { line, area };
}

export function Sparkline({ values, width, height = 64 }: SparklineProps): JSX.Element {
  const { theme } = useTheme();
  const w = Math.min(Math.max(160, width), MAX_WIDTH);
  const { line, area } = buildPath(values, w, height);
  if (values.length === 0) return <View style={{ width: w, height }} />;
  return (
    <View style={{ width: w, height }} accessible={true} accessibilityLabel="8-week volume trend">
      <Svg width={w} height={height}>
        <Path d={area} fill={theme.colors.success} opacity={0.15} />
        <Path
          d={line}
          fill="none"
          stroke={theme.colors.success}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}
