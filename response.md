I heard your feedback that the badge style was "a bit small." You were right—for a main filter panel, we need something more substantial.

I have updated the design to a **Full-Width Accent Header** style.

### New Look:
Instead of a tiny badge, each section now starts with a full-width header block:
-   **Solid Background:** The entire header row has a soft background color (e.g., `bg-emerald-50`), filling the width of the card.
-   **Accent Border:** A thick colored line on the left (`border-l-4`) anchors the section.
-   **Larger Text:** Increased the font size (`text-sm`) and weight (`font-bold`) so it's clearly readable.

### Examples:
-   **BASIC INFO:** <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 8px; font-weight: bold; color: #064e3b; width: 100%;">BASIC INFO</div>
-   **CONTRACT:** <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 8px; font-weight: bold; color: #1e3a8a; width: 100%;">CONTRACT</div>

This approach is much more "architectural." It breaks the long list of filters into clear, comfortable chunks that are easy to navigate, without feeling cramped.