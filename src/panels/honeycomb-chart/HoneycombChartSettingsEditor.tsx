import { ReactElement } from "react";
import { MenuItem, Switch, TextField } from "@mui/material";
import {
  FormatControls,
  FormatOptions,
  OptionsEditorColumn,
  OptionsEditorControl,
  OptionsEditorGrid,
  OptionsEditorGroup,
  ThresholdsEditor,
  ValueMappingsEditor,
} from "@perses-dev/components";
import { CalculationSelector } from "@perses-dev/plugin-system";
import {
  CellShape,
  DEFAULT_GROUP_LAYOUT,
  DEFAULT_SHAPE,
  GroupLayout,
  DEFAULT_SORT,
  HoneycombChartEditorProps,
  HoneycombChartOptions,
  SortOrder,
} from "./honeycomb-chart-types";

const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };

export function HoneycombChartSettingsEditor(
  props: HoneycombChartEditorProps,
): ReactElement {
  const { onChange, value } = props;
  const set = (patch: Partial<HoneycombChartOptions>): void =>
    onChange({ ...value, ...patch });

  const labelField = (
    key: "nameLabel" | "groupBy" | "stateLabel",
    label: string,
    placeholder: string,
    description: string,
  ): ReactElement => (
    <OptionsEditorControl
      label={label}
      description={description}
      control={
        <TextField
          size="small"
          placeholder={placeholder}
          value={value[key] ?? ""}
          onChange={(e) => set({ [key]: e.target.value || undefined })}
        />
      }
    />
  );

  return (
    <OptionsEditorGrid>
      <OptionsEditorColumn>
        <OptionsEditorGroup title="Cells">
          <CalculationSelector
            value={value.calculation ?? "last"}
            onChange={(calculation) => set({ calculation })}
          />
          {labelField(
            "nameLabel",
            "Name label",
            "pod",
            "Label that names each cell. The series name when empty",
          )}
          {labelField(
            "groupBy",
            "Group by label",
            "namespace",
            "Label that groups cells. Click a group to see only its cells. One group when empty",
          )}
          <OptionsEditorControl
            label="Drill down labels"
            description="Comma-separated labels, one per click into a group (workload). Needs a group by label"
            control={
              <TextField
                size="small"
                placeholder="workload"
                defaultValue={(value.drillDown ?? []).join(", ")}
                onBlur={(e) => {
                  const labels = e.target.value
                    .split(",")
                    .map((l) => l.trim())
                    .filter(Boolean);
                  set({ drillDown: labels.length ? labels : undefined });
                }}
              />
            }
          />
          {labelField(
            "stateLabel",
            "State label",
            "phase",
            "Label holding a state (phase, reason). A series then counts only while its value is non-zero; the worst state wins",
          )}
          <OptionsEditorControl
            label="Current only"
            description="Hide series that ended before the end of the time range, such as deleted pods"
            control={
              <Switch
                checked={value.currentOnly ?? true}
                onChange={(_, currentOnly) => set({ currentOnly })}
              />
            }
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Format">
          <FormatControls
            value={value.format ?? DEFAULT_FORMAT}
            onChange={(format) => set({ format })}
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Display">
          <OptionsEditorControl
            label="Shape"
            control={
              <TextField
                select
                size="small"
                value={value.shape ?? DEFAULT_SHAPE}
                onChange={(e) => set({ shape: e.target.value as CellShape })}
              >
                <MenuItem value="hexagon">Hexagon</MenuItem>
                <MenuItem value="square">Square</MenuItem>
              </TextField>
            }
          />
          <OptionsEditorControl
            label="Group layout"
            control={
              <TextField
                select
                size="small"
                value={value.groupLayout ?? DEFAULT_GROUP_LAYOUT}
                onChange={(e) =>
                  set({ groupLayout: e.target.value as GroupLayout })
                }
              >
                <MenuItem value="compact">Compact blocks</MenuItem>
                <MenuItem value="row">Full-width rows</MenuItem>
              </TextField>
            }
          />
          <OptionsEditorControl
            label="Sort"
            description="Cells within a group, and the groups"
            control={
              <TextField
                select
                size="small"
                value={value.sort ?? DEFAULT_SORT}
                onChange={(e) => set({ sort: e.target.value as SortOrder })}
              >
                <MenuItem value="severity">Worst first</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="value">Value, highest first</MenuItem>
              </TextField>
            }
          />
          <OptionsEditorControl
            label="Cell size"
            description="Radius in px. Fits the panel when empty"
            control={
              <TextField
                size="small"
                type="number"
                value={value.cellSize ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  set({
                    cellSize:
                      e.target.value.trim() !== "" &&
                      Number.isFinite(n) &&
                      n > 0
                        ? n
                        : undefined,
                  });
                }}
              />
            }
          />
          <OptionsEditorControl
            label="Show values"
            description="Inside cells large enough to hold them"
            control={
              <Switch
                checked={value.showValues ?? true}
                onChange={(_, showValues) => set({ showValues })}
              />
            }
          />
          <OptionsEditorControl
            label="Show legend"
            control={
              <Switch
                checked={value.showLegend ?? true}
                onChange={(_, showLegend) => set({ showLegend })}
              />
            }
          />
        </OptionsEditorGroup>
      </OptionsEditorColumn>
      <OptionsEditorColumn>
        <ThresholdsEditor
          thresholds={value.thresholds}
          onChange={(thresholds) => set({ thresholds })}
        />
        <OptionsEditorGroup title="Value mappings">
          <ValueMappingsEditor
            mappings={value.mappings ?? []}
            onChange={(mappings) =>
              set({ mappings: mappings.length ? mappings : undefined })
            }
          />
        </OptionsEditorGroup>
      </OptionsEditorColumn>
    </OptionsEditorGrid>
  );
}
