# Packman

A simple, fast, and flexible packing checklist for your next trip. Packman helps you plan and track everything you need to bring, with smart grouping, nested lists, and a clean mobile-friendly UI. You can import your own list, mark items as packed or not needed, and reset back to the default template at any time. All progress is saved in your browser — no account or backend required.

## Quick start

Prerequisites
- Node.js 18+ (or 20+ recommended)
- npm 9+

Install and run (development)
- npm install
- npm run dev
- Open the URL printed in the terminal (typically http://localhost:5173)

Build for production
- npm run build
- npm run preview (serves the build locally so you can test)

## What this app does
Packman provides a packing list experience similar to Google Keep, tailored for trips. It supports nested groups, fast marking, and clear status-based views to help you finish packing with confidence.

Core concepts
- Item: A row in the list. It can be a leaf item (e.g., “Headphones”) or a group that contains other items (e.g., “Electronics”).
- Item state: One of the following
  - null → To pack (default)
  - "packed"
  - "not-needed"
- Structure + state: The structure of the list (items and nesting) is stored separately from each item’s state. Only the state map is mutated during normal use.

## Features
- Three item states with clear sections
  - To pack (default), Packed, Not needed
  - Packed and Not needed items appear crossed out in their respective lists
- Nested groups (multiple levels)
  - Any item can be a group and may contain other groups/items
  - Actions on a group apply to all its descendants (pack, not needed, restore)
- Independent group visibility
  - A group can appear in multiple sections: default if it’s unmarked, and under Packed/Not needed if it or any of its children has that state
- Restore behavior that keeps context correct
  - Restoring a single item ensures all of its ancestors are also restored to default so the item reappears in To pack in the right place
  - Restoring a group is available only when the group itself is marked and there are no default descendants in that group
- Import your own list (with confirmation)
  - Upload a plain text file with 2‑space indentation to define nesting
  - Import replaces your current list after you confirm in a modal dialog
- Reset to default template (with confirmation)
  - Restores the original, nested default list shipped with the app
- Persistent state in the browser
  - Your items structure and item states are saved to localStorage, surviving page reloads
- Animated interactions
  - Distinct animations for marking items as Packed (slide-right/green) vs Not needed (tilt-left/red)
- Responsive design
  - Prioritizes comfortable list width; switches to 2 and 3 columns on very wide screens
  - On very small screens, action buttons become icon-only for compactness
- Clear counters and empty state
  - Each section shows a live badge with the number of entries it is displaying (both groups and items)
  - When To pack is empty, a colorful, animated luggage illustration is shown with a success message
- Accessible, keyboard-friendly UI
  - Buttons have aria-labels, focus styles, and reduced-motion friendly animations
- Dark mode friendly
  - Improved contrast for list borders and button variants in dark mode

## Import file format
Provide a plain text (.txt) file with 2-space indentation to express nesting. Every non-empty line becomes an item.

Example
Clothes
  Tops
    T-shirts
  Bottoms
    Pants/Shorts
Electronics
  Work
    Laptop & charger
  Leisure
    Headphones
Food
  Snacks

Notes
- Lines with no leading spaces are top-level items (often used as groups)
- Each level down adds two leading spaces
- You can mix groups and leaves at any depth

## Persistence details
The app persists to localStorage under these keys
- packman.items.v3 — the current list structure (items and nesting)
- packman.state.v1 — the current item state map

You can clear these keys via your browser devtools to fully reset, or just use the Reset button in the app.

## Project structure (high level)
- src/App.tsx — top-level UI that composes sections and header actions
- src/state/usePackman.ts — all state handling, derived data, and the ItemActions API
- src/components/
  - ListSection.tsx — reusable section component for To pack / Packed / Not needed
  - ImportButton.tsx — upload + confirm flow for importing lists
  - ResetButton.tsx — confirmation flow for restoring the default list
  - ConfirmModal.tsx — accessible, reusable confirmation dialog
- src/lib/imports.ts — parser for the text format and access to the default list text
- src/default-list.txt — default nested list shipped with the app
- src/assets/ — SVG icons and the luggage illustration

## Scripts
- npm run dev — start the dev server (HMR)
- npm run build — create an optimized production build
- npm run preview — preview the production build locally
- npm run lint — run ESLint (if configured in your environment)

## License
This project is for demonstration/educational purposes. You can adapt it for your own use.
