# Goalie Forge — canonical design package

Revision 0.9 • 6 September 2026 • Design specification, not an application release.

This package supersedes earlier design notes for future implementation. The published application remains unchanged. Normative decisions are in `SPECIFICATION.md`; `registry.mjs` is the traceable inventory; `DESIGN-ATLAS.html` is the generated screen specification viewer. `REVIEW.md` records the review and actual coverage, including unmet gates.

Status: REVIEW CANDIDATE. Do not label this package approved, visually validated, or production-ready until its explicit verification gates pass. Defined does not mean implemented or tested. No old completion claim is accepted as test evidence.

## Reading order

1. SPECIFICATION.md — scope, evidence, architecture, permission/state rules, content contracts and engineering decisions.
2. DESIGN-ATLAS.html — screen-by-screen layout, copy, controls and related flows. Open in a browser; no network or account required.
3. registry.mjs — stable screen, flow, component and state IDs; machine-readable source for the atlas.
4. REVIEW.md — adversarial findings, resolutions, coverage and blockers.

## Change control

Every future UX change must name the affected requirement, flow, screen, component and state IDs. Update this package first. Screens inherit global rules; a local exception must identify its user benefit and its affected scenarios. No broad CSS overrides, duplicate shells, or role-specific authorization through visual hiding.

Run `node docs/canonical-design/generate.mjs` to regenerate the atlas and verify all screen/flow references. It validates document structure, not product behavior or accessibility. Runtime code and the published site are deliberately untouched.
