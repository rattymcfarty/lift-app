/**
 * Weekly volume bar chart — pure SVG, themed, monochrome.
 *
 * Accent discipline: bars use `muted`; the accent color is reserved for the
 * log-set action and never appears in charts.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme';

export interface VolumeBarDatum {
  /** Short x-axis label, e.g. "Oct 5". */
  label: string;
  value: number;
}

const HEIGHT = 170;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const PAD_LEFT = 40;
const PAD_RIGHT = 8;
const BAR_GAP_RATIO = 0.3;

export function VolumeBarChart({ data }: { data: VolumeBarDatum[] }): JSX.Element {
  const { theme } = useTheme();
  // Measure the real container width (inside Card padding) instead of
  // guessing from the window — robust to layout changes.
  const [width, setWidth] = useState(0);
  const c = theme.colors;

  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = Math.max(1, ...data.map((d) => d.value));

  const slotW = data.length > 0 ? plotW / data.length : plotW;
  const barW = Math.max(4, slotW * (1 - BAR_GAP_RATIO));
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  // X labels: show at most ~6 to avoid crowding.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Weekly training volume chart"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
      <Svg width={width} height={HEIGHT}>
        {/* gridlines at 0 / 50% / 100% */}
        {[0, 0.5, 1].map((f) => {
          const gy = PAD_TOP + plotH * (1 - f);
          const val = Math.round(max * f);
          return (
            <G key={f}>
              <Line
                x1={PAD_LEFT}
                x2={width - PAD_RIGHT}
                y1={gy}
                y2={gy}
                stroke={c.border}
                strokeWidth={1}
              />
              <SvgText
                x={PAD_LEFT - 6}
                y={gy + 4}
                fontSize={11}
                fill={c.faint}
                textAnchor="end"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`}
              </SvgText>
            </G>
          );
        })}
        {data.map((d, i) => {
          const bx = PAD_LEFT + i * slotW + (slotW - barW) / 2;
          const bh = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * plotH);
          return (
            <G key={i}>
              <Rect
                x={bx}
                y={PAD_TOP + plotH - bh}
                width={barW}
                height={bh}
                rx={2}
                fill={d.value > 0 ? c.muted : 'transparent'}
                opacity={d.value > 0 ? 0.85 : 0}
              />
              {i % labelEvery === 0 ? (
                <SvgText
                  x={bx + barW / 2}
                  y={HEIGHT - 8}
                  fontSize={11}
                  fill={c.faint}
                  textAnchor="middle"
                >
                  {d.label}
                </SvgText>
              ) : null}
            </G>
          );
        })}
      </Svg>
      ) : null}
    </View>
  );
}
