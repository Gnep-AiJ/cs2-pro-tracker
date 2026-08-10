# UI Guide

## Product direction

The interface is a compact Chinese CS2 professional-scene product, not a generic SaaS dashboard, game store, or decorative landing page. Information hierarchy and fast scanning take priority over visual effects.

## Visual rules

- Use a flat dark neutral base with orange as the main accent.
- Green and red are reserved for results and live status. Do not add decorative accent colors without a semantic role.
- Prefer borders, spacing, and typography over shadows, glows, gradients, and nested cards.
- Avoid repeated rounded icon tiles, excessive pills, gradient text, glass surfaces, and hover-lift animations.
- Keep cards square or lightly rounded. Circular shapes are reserved for avatars and status dots.
- Keep source, update time, coverage, and unavailable states visible.
- Do not hide incomplete upstream coverage behind optimistic copy.

## Mobile rules

- Design from 360 px width first; enhance at larger breakpoints.
- Top navigation must remain readable without horizontal page scrolling.
- Tables must reflow or scroll inside their own bounded container.
- Primary actions need at least 44 px touch height where practical.
- QR codes must use the original asset without lossy optimization and remain large enough to scan.
- Avoid placing critical meaning only in hover states.

## Content rules

- Use direct Chinese labels. Remove promotional, vague, or self-congratulatory wording.
- Separate observation from interpretation.
- Identify machine-generated summaries explicitly; always preserve the original source link.
- Do not promise profit sharing. Any future contributor reward wording must state conditions and refer to a later published rule.

## Review checklist

1. Is the first screen clear without decorative explanation?
2. Does each card expose a real decision or data point?
3. Are color, icon, and motion semantically necessary?
4. Does the 360 px layout retain hierarchy and readable copy?
5. Are loading, partial, empty, and upstream-error states honest?
