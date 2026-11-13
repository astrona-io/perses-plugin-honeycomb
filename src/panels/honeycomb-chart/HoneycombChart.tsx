import { PanelPlugin } from "@perses-dev/plugin-system";
import { HoneycombChartComponent } from "./HoneycombChartComponent";
import {
  HoneycombChartOptions,
  HoneycombChartProps,
  createInitialHoneycombChartOptions,
} from "./honeycomb-chart-types";
import { HoneycombChartSettingsEditor } from "./HoneycombChartSettingsEditor";

/** One hexagon (or square) per series, coloured by value or state and grouped by a label. */
export const HoneycombChart: PanelPlugin<
  HoneycombChartOptions,
  HoneycombChartProps
> = {
  PanelComponent: HoneycombChartComponent,
  panelOptionsEditorComponents: [
    { label: "Settings", content: HoneycombChartSettingsEditor },
  ],
  supportedQueryTypes: ["TimeSeriesQuery"],
  createInitialOptions: createInitialHoneycombChartOptions,
};
