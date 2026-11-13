# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-13

### Added

- Drill down: clicking a group, or pressing Enter on it, shows only its cells, and a breadcrumb
  leads back. `drillDown` adds further grouping labels, one per click: with `groupBy: namespace`
  and `drillDown: [workload]`, a namespace opens into its workloads and a workload into its pods.
  The README has a query that adds the `workload` label.

- `currentOnly` (default on): only series with a sample at the end of the time range become cells,
  so a deleted pod no longer shows its last state for the rest of the range. Turn it off to reduce
  whole series that ended earlier.

### Changed

- Group titles are at least 128 px wide (was 96), so more of a long name shows.
- The tooltip lists every grouping label of the cell.

## [0.1.0] - 2026-11-13

### Added

- `HoneycombChart` panel: one hexagon (or square) per series, named by a label (`pod`, `node`) and
  grouped by another (`namespace`, `node`). Groups wrap like text, and the cell size fits the panel
  unless `cellSize` is set; past the smallest size the panel scrolls.
- Value cells: coloured by Perses thresholds (absolute or percent) and value mappings.
- State cells (`stateLabel`): a series stands for "in this state" while its value is non-zero, the
  kube-state-metrics convention. Common Kubernetes states get a colour by name (Running, Ready green;
  Pending, ContainerCreating amber; CrashLoopBackOff, Failed, NotReady red); mappings override it.
- Several series on one cell (pod phase and container waiting reason, say): the worst one wins.
- Worst-first sorting of cells and groups, an outline on cells in the worst band, a group title with
  its cell and problem counts, a legend with counts, and a tooltip with the series labels.
- Releases are built on GitHub: a tag `v<version>` publishes the plugin archive and its checksum on
  the GitHub release and the plugin image as `ghcr.io/astrona-io/perses-plugin-honeycomb:v<version>`
  (linux/amd64 and linux/arm64), with build provenance attestations.

[Unreleased]: https://github.com/astrona-io/perses-plugin-honeycomb/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/astrona-io/perses-plugin-honeycomb/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/astrona-io/perses-plugin-honeycomb/releases/tag/v0.1.0
