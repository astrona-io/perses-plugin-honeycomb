import { TimeSeriesData } from "@perses-dev/spec";
import {
  CalculationType,
  OptionsEditorProps,
  PanelProps,
} from "@perses-dev/plugin-system";
import {
  FormatOptions,
  ThresholdOptions,
  ValueMapping,
} from "@perses-dev/components";

export type QueryData = TimeSeriesData;

export type HoneycombChartProps = PanelProps<HoneycombChartOptions, QueryData>;
export type HoneycombChartEditorProps =
  OptionsEditorProps<HoneycombChartOptions>;

export type CellShape = "hexagon" | "square";
/** `severity`: worst first, then by name. */
export type SortOrder = "severity" | "name" | "value";

export interface HoneycombChartOptions {
  /** How each series is reduced to one value. */
  calculation: CalculationType;
  /** Series label that names a cell (`pod`, `node`). The series name when unset or missing. */
  nameLabel?: string;
  /**
   * Series label that groups cells (`namespace`, `node`). One group when unset. Clicking a group
   * shows only its cells; a breadcrumb leads back.
   */
  groupBy?: string;
  /**
   * Further grouping labels, one per click into a group (`[workload]`: namespace, then its workloads,
   * then one workload's pods). Needs `groupBy`.
   */
  drillDown?: string[];
  /**
   * Series label that holds a state (`phase`, `reason`, `condition`). When set, a series stands for
   * "this cell is in that state" and counts only while its value is non-zero, the kube-state-metrics
   * convention. When unset, the cell shows the series value.
   */
  stateLabel?: string;
  format?: FormatOptions;
  /** Colour by value. Mappings win over thresholds. */
  thresholds?: ThresholdOptions;
  /** Value or state to text and colour. */
  mappings?: ValueMapping[];
  /**
   * Only series with a sample at the end of the time range, so a pod that is gone does not keep
   * its last state. Default true. Turn off to reduce whole series over the range (mean, max).
   */
  currentOnly?: boolean;
  /** Default `hexagon`. */
  shape?: CellShape;
  /** Default `severity`. Applies to cells and to groups. */
  sort?: SortOrder;
  /** Fixed cell radius in px. Fits the panel when unset. */
  cellSize?: number;
  /** Value or state inside cells large enough to hold it. Default true. */
  showValues?: boolean;
  /** Colours with their cell counts under the grid. Default true. */
  showLegend?: boolean;
}

export const DEFAULT_SHAPE: CellShape = "hexagon";
export const DEFAULT_SORT: SortOrder = "severity";

export function createInitialHoneycombChartOptions(): HoneycombChartOptions {
  return {
    calculation: "last",
    format: { unit: "decimal" },
    currentOnly: true,
    shape: DEFAULT_SHAPE,
    sort: DEFAULT_SORT,
    showValues: true,
    showLegend: true,
  };
}
