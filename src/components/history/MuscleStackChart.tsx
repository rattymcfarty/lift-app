/**
 * Muscle-group volume over time — stacked bars, pure SVG, themed.
 *
 * Each week is one stacked bar; segments are the top muscle groups by total
 * volume (rest folded into "Other"). Segments use opacity steps of the
 * theme's muted color so the chart stays monochrome per the accent
 * discipline (accent is reserved for the complete-a-set action). A legend maps shade → muscle group.
 */
import { useState, type JSX } from 'react';
import { Text, View } from 'react-native';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { MuscleGroup } from '../../stats/balance';

export interface MuscleStackWeek {
  label: string;
  /** group → volume kg, sorted desc by caller. */
  segments: { group: MuscleGroup | 'other'; volumeKg: number }[];
}

const HEIGHT = 200;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const MAX_GROUPS = 5;

function groupLabel(g: MuscleGroup | 'other'): string {
  return g === 'other' ? 'Other' : g.charAt(0).toUpperCase() + g.slice(1);
}

export function MuscleStackChart({ weeks }: { weeks: MuscleStackWeek[] }): JSX.Element {
  const { theme } = useTheme();
  const t = theme.typography;
  const [width, setWidth] = useState(0);
  const c = theme.colors;

  // Top groups across all weeks determine the legend order.
  // 'other' never takes a top slot (it would duplicate when folding).
  const totals = new Map<MuscleGroup | 'other', number>();
  for (const w of weeks) {
    for (const s of w.segments) totals.set(s.group, (totals.get(s.group) ?? 0) + s.volumeKg);
  }
  const topGroups = [...totals.entries()]
    .filter(([g]) => g !== 'other')
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GROUPS)
    .map(([g]) => g);
  const hasOther = [...totals.keys()].some((g) => g === 'other' || !topGroups.includes(g));
  const legendGroups: (MuscleGroup | 'other')[] = hasOther ? [...topGroups, 'other'] : topGroups;

  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 10);
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxWeek = Math.max(...weeks.map((w) => w.segments.reduce((a, s) => a + s.volumeKg, 0)), 1);
  const slotW = plotW / Math.max(weeks.length, 1);
  const barW = Math.min(slotW * 0.62, 28);

  // Opacity steps: darkest = top group.
  const shade = (i: number): number => 0.95 - i * 0.14;

  return (
    <View>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible={true}
        accessibilityLabel={`Weekly volume by muscle group, ${weeks.length} weeks. Top groups: ${legendGroups.map(groupLabel).join(', ')}.`}
      >
        {width > 0 ? (
          <Svg width={width} height={HEIGHT}>
            <G>
              {weeks.map((w, wi) => {
                const x = PAD_LEFT + wi * slotW + (slotW - barW) / 2;
                let y = PAD_TOP + plotH;
                // Fold non-top groups into "other".
                const segs: { group: MuscleGroup | 'other'; volumeKg: number }[] = [];
                let otherVol = 0;
                for (const s of w.segments) {
                  if (topGroups.includes(s.group)) segs.push(s);
                  else otherVol += s.volumeKg;
                }
                if (otherVol > 0) segs.push({ group: 'other', volumeKg: otherVol });
                // Order segments to match legend order (darkest on bottom).
                segs.sort(
                  (a, b) => legendGroups.indexOf(a.group) - legendGroups.indexOf(b.group),
                );
                return (
                  <G key={wi}>
                    {segs.map((s, si) => {
                      const h = (s.volumeKg / maxWeek) * plotH;
                      y -= h;
                      const li = legendGroups.indexOf(s.group);
                      return (
                        <Rect
                          key={si}
                          x={x}
                          y={y}
                          width={barW}
                          height={Math.max(h, 0)}
                          fill={c.muted}
                          opacity={shade(li)}
                        />
                      );
                    })}
                    {wi % 3 === 0 ? (
                      <SvgText
                        x={x + barW / 2}
                        y={HEIGHT - 8}
                        fontSize={10}
                        fill={c.faint}
                        textAnchor="middle"
                      >
                        {w.label}
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}
            </G>
          </Svg>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 }}>
        {legendGroups.map((g, i) => (
          <View key={g} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: c.muted,
                opacity: shade(i),
              }}
            />
            <Text style={{ color: c.muted, fontSize: t.size.caption }}>{groupLabel(g)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
