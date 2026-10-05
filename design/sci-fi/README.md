# Sci-fi dashboard redesign mockups

Two design directions for the Dashboard screen, inspired by Stellaris-style HUDs (original design, no game assets).

- `variant-a-deep-space.dc.html` - navy/cyan, sidebar nav, thin-line panels with corner brackets, stats as a top resource bar. Fonts: Orbitron + Exo 2.
- `variant-b-command-deck.dc.html` - teal/amber, top tab nav, angular clipped-corner panels, week shown as a vertical list. Font: Chakra Petch.

## About the files

They are mockup source, not app code, and are not meant to open in a browser as-is.
They use a small template syntax (`{{ value }}`, `<sc-for>`, `<sc-if>`) and a `renderVals()` script block holding sample data.
Read them for the design values: colors, spacing, fonts, panel shapes, layout. Then port the look into the real components.

## Notes

- Workout chip labels are truncated sample text from the current UI; real names come from app data.
- Today's state (rest day, Sun Oct 4 2026) and stat numbers are sample data from a screenshot.
- Keep existing features: summary stats, week + month calendars, Plan link, active programs, "Get After It" button, sidebar/nav items.
