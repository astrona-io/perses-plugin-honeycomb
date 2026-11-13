import {
  KeyboardEvent,
  MouseEvent,
  ReactElement,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Box, Breadcrumbs, Link, Typography, useTheme } from "@mui/material";
import { formatValue, useChartsTheme } from "@perses-dev/components";
import {
  DEFAULT_SHAPE,
  DEFAULT_SORT,
  HoneycombChartProps,
} from "./honeycomb-chart-types";
import { Cell, ColourSet, buildCells, groupCells } from "./data";
import { HEADER_HEIGHT, cellCentre, fitLayout, hexPoints } from "./layout";

const DEFAULT_FORMAT = { unit: "decimal" as const };
const LEGEND_HEIGHT = 22;
const BREADCRUMB_HEIGHT = 24;
/** Cells smaller than this radius carry no text. */
const TEXT_MIN_RADIUS = 16;
const TOOLTIP_WIDTH = 280;

interface Hover {
  cell: Cell;
  x: number;
  y: number;
}

/**
 * Text that fits `width` px at `fontSize`, cut with an ellipsis. Empty when fewer than
 * `minChars` would show, since a stub like "Ru…" says nothing the colour does not.
 */
function fitText(
  text: string,
  width: number,
  fontSize: number,
  minChars = 2,
): string {
  const max = Math.floor(width / (fontSize * 0.6));
  if (text.length <= max) return text;
  return max - 1 < minChars ? "" : `${text.slice(0, max - 1)}…`;
}

export function HoneycombChartComponent(
  props: HoneycombChartProps,
): ReactElement | null {
  const { queryResults, spec, contentDimensions } = props;
  const muiTheme = useTheme();
  const chartsTheme = useChartsTheme();
  const [hover, setHover] = useState<Hover | undefined>();
  const [hoverGroup, setHoverGroup] = useState<string | undefined>();
  /** One value per level drilled into, outermost first. */
  const [path, setPath] = useState<string[]>([]);

  const shape = spec.shape ?? DEFAULT_SHAPE;
  const showValues = spec.showValues ?? true;
  const showLegend = spec.showLegend ?? true;
  const format = spec.format ?? DEFAULT_FORMAT;

  const colours: ColourSet = useMemo(
    () => ({
      ok: muiTheme.palette.success.main,
      warning: muiTheme.palette.warning.main,
      error: muiTheme.palette.error.main,
      other: [
        muiTheme.palette.info.main,
        muiTheme.palette.secondary.main,
        muiTheme.palette.primary.main,
        muiTheme.palette.grey[500],
      ],
      thresholdDefault: chartsTheme.thresholds.defaultColor,
      thresholdPalette: chartsTheme.thresholds.palette,
    }),
    [muiTheme, chartsTheme],
  );

  const levels = useMemo(
    () =>
      spec.groupBy
        ? [spec.groupBy, ...(spec.drillDown ?? []).filter(Boolean)]
        : [],
    [spec.groupBy, spec.drillDown],
  );
  const levelsKey = levels.join("\u0000");
  // A path into other grouping labels means nothing: start again at the top.
  useEffect(() => setPath([]), [levelsKey]);

  const { cells: all } = useMemo(
    () =>
      buildCells(queryResults, {
        calculation: spec.calculation ?? "last",
        nameLabel: spec.nameLabel || undefined,
        levels,
        stateLabel: spec.stateLabel || undefined,
        currentOnly: spec.currentOnly ?? true,
        format,
        thresholds: spec.thresholds,
        mappings: spec.mappings,
        colours,
      }),
    [queryResults, spec, levels, format, colours],
  );
  const sort = spec.sort ?? DEFAULT_SORT;
  const groups = useMemo(() => groupCells(all, path, sort), [all, path, sort]);
  const cells = groups.reduce((n, g) => n + g.cells.length, 0);

  const legend = useMemo(() => {
    const entries = new Map<
      string,
      { color: string; label: string; count: number; rank: number }
    >();
    for (const g of groups)
      for (const c of g.cells) {
        const key = `${c.color}\u0000${c.legend}`;
        const e = entries.get(key);
        if (e) e.count += 1;
        else
          entries.set(key, {
            color: c.color,
            label: c.legend,
            count: 1,
            rank: c.rank,
          });
      }
    return [...entries.values()].sort(
      (a, b) => b.rank - a.rank || b.count - a.count,
    );
  }, [groups]);

  const width = contentDimensions?.width ?? 0;
  const height = contentDimensions?.height ?? 0;
  // Groups exist until the last level is drilled into; clicking one goes a level deeper.
  const headers = path.length < levels.length;
  const drillable = headers;
  const gridHeight = Math.max(
    0,
    height -
      (showLegend && cells > 0 ? LEGEND_HEIGHT : 0) -
      (path.length > 0 ? BREADCRUMB_HEIGHT : 0),
  );
  const layout = useMemo(
    () =>
      fitLayout(
        groups.map((g) => g.cells.length),
        Math.max(1, width - 2),
        gridHeight,
        shape,
        headers,
        spec.cellSize,
      ),
    [groups, width, gridHeight, shape, headers, spec.cellSize],
  );

  if (contentDimensions === undefined) return null;

  const byKey = new Map<string, Cell>();
  for (const g of groups) for (const c of g.cells) byKey.set(c.key, c);

  const groupOf = (e: MouseEvent<SVGSVGElement>): string | undefined =>
    (e.target as Element)
      .closest?.("[data-group]")
      ?.getAttribute("data-group") ?? undefined;

  const onClick = (e: MouseEvent<SVGSVGElement>): void => {
    const name = drillable ? groupOf(e) : undefined;
    if (name === undefined) return;
    setPath([...path, name]);
    setHover(undefined);
    setHoverGroup(undefined);
  };

  const onMove = (e: MouseEvent<SVGSVGElement>): void => {
    const group = drillable ? groupOf(e) : undefined;
    if (group !== hoverGroup) setHoverGroup(group);
    const key = (e.target as SVGElement).getAttribute?.("data-key");
    const cell = key ? byKey.get(key) : undefined;
    if (!cell) {
      if (hover) setHover(undefined);
      return;
    }
    const box = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    setHover({ cell, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  const r = layout.radius;
  const g = layout.geometry;
  const fontSize = Math.max(9, Math.min(13, r * 0.45));
  const textInside = showValues && r >= TEXT_MIN_RADIUS;
  const header = headers ? HEADER_HEIGHT : 0;
  const outline = muiTheme.palette.text.primary;

  const contrast = (color: string): string => {
    try {
      return muiTheme.palette.getContrastText(color);
    } catch {
      return muiTheme.palette.text.primary;
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        width,
        height,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {path.length > 0 ? (
        <Breadcrumbs
          maxItems={4}
          sx={{
            height: BREADCRUMB_HEIGHT,
            display: "flex",
            alignItems: "center",
            px: 0.5,
            fontSize: 13,
            "& ol": { flexWrap: "nowrap" },
          }}
        >
          {["All", ...path].map((crumb, i) =>
            i === path.length ? (
              <Typography key={i} variant="body2" noWrap sx={{ fontSize: 13 }}>
                {crumb}
              </Typography>
            ) : (
              <Link
                key={i}
                component="button"
                underline="hover"
                color="inherit"
                sx={{ fontSize: 13 }}
                onClick={() => setPath(path.slice(0, i))}
              >
                {crumb}
              </Link>
            ),
          )}
        </Breadcrumbs>
      ) : null}
      {cells === 0 ? (
        <Typography
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
          }}
        >
          No data
        </Typography>
      ) : (
        <Box
          sx={{
            position: "relative",
            height: gridHeight,
            overflowY: layout.height > gridHeight ? "auto" : "hidden",
            overflowX: "hidden",
          }}
          onMouseLeave={() => {
            setHover(undefined);
            setHoverGroup(undefined);
          }}
        >
          <svg
            width={width - 2}
            height={layout.height}
            role="img"
            aria-label={`${cells} cells in ${groups.length} groups`}
            onMouseMove={onMove}
            onClick={onClick}
            style={{
              display: "block",
              fontFamily: muiTheme.typography.fontFamily,
            }}
          >
            {groups.map((group, gi) => {
              const box = layout.boxes[gi];
              if (!box) return null;
              return (
                <g
                  key={group.name}
                  transform={`translate(${box.x},${box.y})`}
                  data-group={drillable ? group.name : undefined}
                  style={{ cursor: drillable ? "pointer" : "default" }}
                  {...(drillable
                    ? {
                        role: "button",
                        tabIndex: 0,
                        "aria-label": `Open ${group.name}`,
                        onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
                          if (e.key !== "Enter" && e.key !== " ") return;
                          e.preventDefault();
                          setPath([...path, group.name]);
                        },
                      }
                    : {})}
                >
                  {drillable ? (
                    <rect
                      x={-3}
                      y={-2}
                      width={box.width + 6}
                      height={box.height + 4}
                      rx={4}
                      fill={
                        hoverGroup === group.name
                          ? muiTheme.palette.action.hover
                          : "transparent"
                      }
                    />
                  ) : null}
                  {headers ? (
                    <text
                      x={0}
                      y={12}
                      fontSize={11}
                      fill={muiTheme.palette.text.secondary}
                    >
                      <title>{group.name}</title>
                      {fitText(
                        `${group.name} · ${group.cells.length}${group.problems ? ` · ${group.problems}!` : ""}`,
                        box.width,
                        11,
                      )}
                    </text>
                  ) : null}
                  {group.cells.map((cell, i) => {
                    const [cx, cy] = cellCentre(i, box.cols, g, header);
                    const stroke = cell.problem ? outline : "none";
                    const isHover = hover?.cell.key === cell.key;
                    const common = {
                      "data-key": cell.key,
                      fill: cell.color,
                      stroke: isHover ? outline : stroke,
                      strokeWidth: isHover ? 2 : 1.5,
                    };
                    return (
                      <g key={cell.key}>
                        {shape === "square" ? (
                          <rect
                            {...common}
                            x={cx - g.cellWidth / 2}
                            y={cy - g.cellHeight / 2}
                            width={g.cellWidth}
                            height={g.cellHeight}
                            rx={Math.min(3, r * 0.15)}
                          />
                        ) : (
                          <polygon {...common} points={hexPoints(cx, cy, r)} />
                        )}
                        {textInside ? (
                          <text
                            x={cx}
                            y={cy}
                            fontSize={fontSize}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={contrast(cell.color)}
                            pointerEvents="none"
                          >
                            {fitText(
                              cell.text,
                              g.cellWidth * 0.85,
                              fontSize,
                              5,
                            )}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </Box>
      )}
      {showLegend && cells > 0 ? (
        <Box
          sx={{
            height: LEGEND_HEIGHT,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            overflowX: "auto",
            overflowY: "hidden",
            whiteSpace: "nowrap",
            px: 0.5,
          }}
        >
          {legend.map((e) => (
            <Box
              key={`${e.color}${e.label}`}
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "2px",
                  bgcolor: e.color,
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {e.label} ({e.count})
              </Typography>
            </Box>
          ))}
        </Box>
      ) : null}
      {hover ? (
        <Box
          sx={{
            position: "absolute",
            left: Math.max(
              4,
              Math.min(hover.x + 12, width - TOOLTIP_WIDTH - 4),
            ),
            // Below the pointer, or above it near the bottom of the panel.
            ...(hover.y > height * 0.55
              ? { bottom: height - hover.y + 10 }
              : { top: hover.y + 14 }),
            maxWidth: TOOLTIP_WIDTH,
            p: 1,
            borderRadius: 1,
            bgcolor: "background.paper",
            boxShadow: 4,
            border: 1,
            borderColor: "divider",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {hover.cell.name}
          </Typography>
          {levels.map((label, i) => (
            <Typography
              key={label}
              variant="caption"
              color="text.secondary"
              noWrap
              component="div"
            >
              {label}: {hover.cell.path[i]}
            </Typography>
          ))}
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.75, my: 0.5 }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "2px",
                bgcolor: hover.cell.color,
              }}
            />
            <Typography variant="body2">
              {hover.cell.text}
              {/* A state series is 1 while in its state: show only other values. */}
              {(
                hover.cell.state !== undefined
                  ? hover.cell.value !== 1
                  : hover.cell.text !== formatValue(hover.cell.value, format)
              )
                ? ` (${formatValue(hover.cell.value, format)})`
                : ""}
            </Typography>
          </Box>
          {Object.entries(hover.cell.labels)
            .filter(([k]) => k !== "__name__")
            .slice(0, 12)
            .map(([k, v]) => (
              <Typography
                key={k}
                variant="caption"
                color="text.secondary"
                noWrap
                component="div"
                sx={{ fontFamily: "monospace" }}
              >
                {k}={v}
              </Typography>
            ))}
          {drillable ? (
            <Typography
              variant="caption"
              color="text.secondary"
              component="div"
              sx={{ mt: 0.5, fontStyle: "italic" }}
            >
              Click to open {hover.cell.path[path.length]}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
