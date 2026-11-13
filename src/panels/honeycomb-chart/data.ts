import {
  applyValueMapping,
  formatValue,
  FormatOptions,
  ThresholdOptions,
  ValueMapping,
} from "@perses-dev/components";
import {
  getCalculation,
  CalculationType,
  PanelData,
} from "@perses-dev/plugin-system";
import { TimeSeriesData } from "@perses-dev/spec";
import { SortOrder } from "./honeycomb-chart-types";

/** Severity of a state, from its name. Worst wins when several series share a cell. */
export enum Severity {
  Ok = 0,
  Other = 1,
  Warning = 2,
  Error = 3,
}

// Checked in this order, so "NotReady" is an error before "Ready" can match.
const ERROR_STATES =
  /crashloop|backoff|err|fail|oomkill|evict|unhealthy|notready|not_ready|false|dead|down|lost|reject|unschedulable/i;
const WARNING_STATES =
  /pending|creat|progress|reconcil|waiting|init|degrad|warn|terminat|unknown|suspend|stall|pressure/i;
const OK_STATES =
  /running|ready|true|succeed|complete|available|healthy|^up$|^ok$|active|bound/i;

export function stateSeverity(state: string): Severity {
  if (ERROR_STATES.test(state)) return Severity.Error;
  if (WARNING_STATES.test(state)) return Severity.Warning;
  if (OK_STATES.test(state)) return Severity.Ok;
  return Severity.Other;
}

export interface Cell {
  /** Unique within the panel: its path and name. */
  key: string;
  name: string;
  /** Value of each grouping label (`groupBy`, then `drillDown`), outermost first. */
  path: string[];
  /** Reduced series value. For a state cell, the value of the series that set its state. */
  value: number;
  /** State from the state label; undefined for a value cell. */
  state?: string;
  /** Text shown in the cell, tooltip and legend: the mapped value, the state or the formatted value. */
  text: string;
  color: string;
  /** Larger is worse: the severity of a state, or the threshold step a value reached. */
  rank: number;
  /** Worst colour band: an error state, or a value in the highest threshold step. */
  problem: boolean;
  /** Legend entry: colour plus what it stands for. */
  legend: string;
  labels: Record<string, string>;
}

export interface Group {
  name: string;
  cells: Cell[];
  /** Highest rank among the cells. */
  rank: number;
  problems: number;
}

export interface ColourSet {
  ok: string;
  warning: string;
  error: string;
  other: string[];
  /** Below the first threshold step, or when there are no thresholds. */
  thresholdDefault: string;
  /** Step colours by index when a step has none. */
  thresholdPalette: string[];
}

export interface BuildOptions {
  calculation: CalculationType;
  nameLabel?: string;
  /** Grouping labels, outermost first: `groupBy`, then `drillDown`. */
  levels: string[];
  stateLabel?: string;
  currentOnly: boolean;
  format: FormatOptions;
  thresholds?: ThresholdOptions;
  mappings?: ValueMapping[];
  colours: ColourSet;
}

export interface BuildResult {
  cells: Cell[];
  /** Series dropped because they had no value in the time range. */
  empty: number;
  /** Series dropped by `currentOnly`: they ended before the end of the time range. */
  ended: number;
}

/**
 * The time of the newest sample in any series, and how far before it a series may end and still
 * count as current: one and a half query steps, so a missing last point does not drop it.
 */
function currentWindow(
  queryResults: Array<PanelData<TimeSeriesData>>,
): { latest: number; slack: number } | undefined {
  let latest = -Infinity;
  let step = 0;
  for (const result of queryResults) {
    step = Math.max(step, result.data.stepMs ?? 0);
    for (const series of result.data.series) {
      const last = series.values[series.values.length - 1];
      if (last && last[0] > latest) latest = last[0];
    }
  }
  return Number.isFinite(latest) ? { latest, slack: step * 1.5 } : undefined;
}

/** Placeholder for a missing or empty label, so such series stay visible. */
export const NONE = "(none)";

function hashColour(s: string, palette: string[]): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length] ?? "#888";
}

function stateColour(severity: Severity, state: string, c: ColourSet): string {
  switch (severity) {
    case Severity.Ok:
      return c.ok;
    case Severity.Warning:
      return c.warning;
    case Severity.Error:
      return c.error;
    default:
      return hashColour(state, c.other);
  }
}

interface ThresholdStep {
  index: number;
  color: string;
  label: string;
  last: boolean;
}

function thresholdStep(
  value: number,
  thresholds: ThresholdOptions | undefined,
  format: FormatOptions,
  c: ColourSet,
): ThresholdStep {
  const steps = [...(thresholds?.steps ?? [])].sort(
    (a, b) => a.value - b.value,
  );
  const percent = thresholds?.mode === "percent";
  const scaled = percent ? (value / (thresholds?.max ?? 100)) * 100 : value;
  const fmt = (v: number): string =>
    percent ? `${v}%` : formatValue(v, format);
  let found: ThresholdStep = {
    index: 0,
    color: thresholds?.defaultColor ?? c.thresholdDefault,
    label: steps[0] ? `< ${fmt(steps[0].value)}` : "Value",
    last: false,
  };
  steps.forEach((step, i) => {
    if (scaled >= step.value) {
      found = {
        index: i + 1,
        color:
          step.color ??
          c.thresholdPalette[i % Math.max(1, c.thresholdPalette.length)] ??
          c.thresholdDefault,
        label: step.name ?? `≥ ${fmt(step.value)}`,
        last: i === steps.length - 1,
      };
    }
  });
  return found;
}

function makeCell(
  labels: Record<string, string>,
  seriesName: string,
  value: number,
  opts: BuildOptions,
): Cell {
  const name =
    (opts.nameLabel ? labels[opts.nameLabel]?.trim() : undefined) ||
    seriesName ||
    NONE;
  const path = opts.levels.map((l) => labels[l]?.trim() || NONE);
  const base = {
    key: [...path, name].join("\u0000"),
    name,
    path,
    value,
    labels,
  };

  if (opts.stateLabel) {
    const state = labels[opts.stateLabel]?.trim() || NONE;
    const mapped = applyValueMapping(state, opts.mappings);
    const text = String(mapped.value);
    const severity = Math.max(stateSeverity(state), stateSeverity(text));
    const color = mapped.color ?? stateColour(severity, text, opts.colours);
    return {
      ...base,
      state,
      text,
      color,
      rank: severity,
      problem: severity === Severity.Error,
      legend: text,
    };
  }

  const step = thresholdStep(value, opts.thresholds, opts.format, opts.colours);
  const mapped = applyValueMapping(value, opts.mappings);
  if (mapped.color !== undefined || mapped.value !== value) {
    const text =
      typeof mapped.value === "number"
        ? formatValue(mapped.value, opts.format)
        : mapped.value;
    const severity = stateSeverity(text);
    return {
      ...base,
      text,
      color: mapped.color ?? step.color,
      // A mapped text names its severity when it can; otherwise the threshold step decides.
      rank: severity === Severity.Other ? step.index : severity,
      problem: severity === Severity.Error || step.last,
      legend: text,
    };
  }
  return {
    ...base,
    text: formatValue(value, opts.format),
    color: step.color,
    rank: step.index,
    problem: step.last,
    legend: step.label,
  };
}

/** Worse first; the higher value breaks a tie. */
function worse(a: Cell, b: Cell): boolean {
  return a.rank !== b.rank ? a.rank > b.rank : a.value > b.value;
}

const byName = new Intl.Collator(undefined, { numeric: true }).compare;

function compareCells(sort: SortOrder): (a: Cell, b: Cell) => number {
  switch (sort) {
    case "name":
      return (a, b) => byName(a.name, b.name);
    case "value":
      return (a, b) => b.value - a.value || byName(a.name, b.name);
    default:
      return (a, b) =>
        b.rank - a.rank || b.value - a.value || byName(a.name, b.name);
  }
}

/**
 * Reduces every series to a cell, keyed by its path and name. When several series land on one cell
 * (pod phase and container waiting reason, say), the worse one wins.
 */
export function buildCells(
  queryResults: Array<PanelData<TimeSeriesData>>,
  opts: BuildOptions,
): BuildResult {
  const cells = new Map<string, Cell>();
  let empty = 0;
  let ended = 0;
  const window = opts.currentOnly ? currentWindow(queryResults) : undefined;
  for (const result of queryResults) {
    for (const series of result.data.series) {
      if (window) {
        const last = series.values[series.values.length - 1];
        if (!last || last[0] < window.latest - window.slack) {
          ended += 1;
          continue;
        }
      }
      const value = getCalculation(series.values, opts.calculation);
      if (value === undefined || value === null || Number.isNaN(value)) {
        empty += 1;
        continue;
      }
      // A state series says "in this state" while it is non-zero.
      if (opts.stateLabel && value === 0) continue;
      const cell = makeCell(
        series.labels ?? {},
        series.formattedName ?? series.name,
        value,
        opts,
      );
      const seen = cells.get(cell.key);
      if (!seen || worse(cell, seen)) cells.set(cell.key, cell);
    }
  }

  return { cells: [...cells.values()], empty, ended };
}

/**
 * The cells under `path` (one value per level already drilled into), grouped by the next level.
 * Past the last level they form one group named "".
 */
export function groupCells(
  cells: Cell[],
  path: string[],
  sort: SortOrder,
): Group[] {
  const depth = path.length;
  const groups = new Map<string, Group>();
  for (const cell of cells) {
    if (path.some((v, i) => cell.path[i] !== v)) continue;
    const name = cell.path[depth] ?? "";
    let g = groups.get(name);
    if (!g) {
      g = { name, cells: [], rank: 0, problems: 0 };
      groups.set(name, g);
    }
    g.cells.push(cell);
    g.rank = Math.max(g.rank, cell.rank);
    if (cell.problem) g.problems += 1;
  }
  const cmp = compareCells(sort);
  const list = [...groups.values()];
  for (const g of list) g.cells.sort(cmp);
  list.sort((a, b) =>
    sort === "severity"
      ? b.problems - a.problems || b.rank - a.rank || byName(a.name, b.name)
      : byName(a.name, b.name),
  );
  return list;
}
