# UI Implementation Tasks (Figma Make -> frontend)

Source Figma Make:
- https://www.figma.com/make/RlxTkeDp7lExAGRl7ocRjg/Enable-Code-%7C-UI-UX-Dessign

## Progress Rules
- [x] Done
- [~] In progress
- [ ] Not started

## Global Setup
- [x] Create `frontend/src` app structure for page-by-page implementation
- [x] Add shared theme styles and reusable button/card helpers
- [x] Add router skeleton for all target pages

## Page Delivery Plan
1. `Home` (`/`)
2. `Login` (`/login`)
3. `Lessons` (`/lessons`)
4. `Workspace` (`/workspace`)
5. `Settings` (`/settings`)

## Per-Page Tasks

### 1) Home
- [x] Implement hero section, navigation, CTA
- [x] Implement feature cards section
- [x] Implement footer
- [x] Link CTA/buttons to next routes

### 2) Login
- [x] Implement dark auth layout
- [x] Implement email/password form UI
- [x] Implement alternative eye-scan CTA UI

### 3) Lessons
- [x] Implement left sidebar navigation
- [x] Implement lessons grid cards and progress bars
- [x] Implement lock state visuals

### 4) Workspace
- [x] Implement top bar and breadcrumb area
- [x] Implement split panel layout (objective + coding area)
- [x] Implement visual block library panel

### 5) Settings
- [x] Implement profile summary and stats cards
- [x] Implement eye-tracking controls (sliders/toggle UI)
- [x] Implement responsive two-column structure

## Notes
- Phase 1 focus: visual parity and navigation flow.
- Phase 2 can wire data/state/real actions after all pages are in place.
- Logo convention for all pages: use `/logo/TL_App_Logo.png` in light backgrounds and `/logo/TD_App_Logo.png` in dark backgrounds.
