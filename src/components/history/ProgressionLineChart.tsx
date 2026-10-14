/**
 * Per-exercise strength progression — pure SVG line chart, themed.
 *
 * Monochrome line (`text`); dots in `muted`; dots that set a new all-time
 * best in `success` (the theme's confirmation color — semantically a PR).
 * Single point renders as a dot with no line.
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme';

export interface ProgressionDatum {
  /** Short x-axis label, e.g. "Oct 3". */
  label: string;
  value: number;
  /** True when this point is a new all-time best. */
  best: boolean;
}

const HEIGHT = 190;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;

export function ProgressionLineChart({
  data,
  unit,
}: {
  data: ProgressionDatum[];
  /** Axis unit label, e.g. "kg" or "reps". */
  unit: string;
}): JSX.Element {
  const { theme } = useTheme();
  // Measure the real container width (inside Card padding) instead of
  // guessing from the window — robust to layout changes.
  const [width, setWidth] = useState(0);
  const c = theme.colors;

  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // Pad the domain so a flat series doesn't collapse to a line at the edge.
  const span = Math.max(rawMax - rawMin, rawMax * 0.1, 1);
  const min = Math.max(0, rawMin - span * 0.15);
  const max = rawMax + span * 0.15;

  const x = (i: number) =>
    data.length === 1 ? PAD_LEFT + plotW / 2 : PAD_LEFT + (i / (data.length - 1)) * plotW;
  const y = (v: number) => PAD_TOP + plotH - ((v - min) / (max - min)) * plotH;

  const linePoints = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const fmtTick = (v: number) => (v >= 100 ? `${Math.round(v)}` : `${Math.round(v * 10) / 10}`);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Strength progression chart"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
      <Svg width={width} height={HEIGHT}>
        {[0, 0.5, 1].map((f) => {
          const gv = min + (max - min) * f;
          const gy = y(gv);
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
              <SvgText x={PAD_LEFT - 6} y={gy + 4} fontSize={11} fill={c.faint} textAnchor="end">
                {fmtTick(gv)}
              </SvgText>
            </G>
          );
        })}
        {data.length > 1 ? (
          <Polyline points={linePoints} fill="none" stroke={c.text} strokeWidth={2} />
        ) : null}
        {data.map((d, i) => (
          <G key={i}>
            <Circle
              cx={x(i)}
              cy={y(d.value)}
              r={d.best ? 5 : 3.5}
              fill={d.best ? c.success : c.muted}
            />
            {i % labelEvery === 0 ? (
              <SvgText
                x={x(i)}
                y={HEIGHT - 8}
                fontSize={11}
                fill={c.faint}
                textAnchor="middle"
              >
                {d.label}
              </SvgText>
            ) : null}
          </G>
        ))}
        <SvgText x={PAD_LEFT - 6} y={PAD_TOP - 4} fontSize={11} fill={c.faint} textAnchor="end">
          {unit}
        </SvgText>
      </Svg>
      ) : null}
    </View>
  );
}
