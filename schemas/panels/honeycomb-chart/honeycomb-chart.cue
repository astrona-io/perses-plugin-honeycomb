package model

import (
	"github.com/perses/shared/cue/common"
)

kind: "HoneycombChart"
spec: close({
	// How each series is reduced to one value (last, mean, max, ...).
	calculation: common.#calculation
	// Label that names a cell (pod, node). The series name when unset.
	nameLabel?: string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
	// Label that groups cells (namespace, node). One group when unset.
	groupBy?: string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
	// Further grouping labels, one per click into a group (workload). Needs groupBy.
	drillDown?: [...string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"]
	// Label holding a state (phase, reason). A series then counts only while its value is non-zero.
	stateLabel?: string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"
	currentOnly?: bool
	format?:     common.#format
	thresholds?: common.#thresholds
	mappings?: [...common.#mappings]
	shape?: "hexagon" | "square"
	// compact: each group a block a little wider than tall. row: groups run the full width.
	groupLayout?: "compact" | "row"
	// Cells within a group, and the groups. severity: worst first.
	sort?: "severity" | "name" | "value"
	// Fixed cell radius in px. Fits the panel when unset.
	cellSize?:   number & >0
	showValues?: bool
	showLegend?: bool
})
