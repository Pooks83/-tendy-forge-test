# Goalie Forge onboarding-shell repair

## Problem

The published application renders player navigation before a usable player profile or coach relationship exists. Those controls change internal tab state, but no destination renders because the active-app condition is false. This creates five visible dead controls: Home, Train, Progress, Profile, and the profile avatar.

The same shared shell also caused the wordmark to inherit the logo-mark selector, producing overlapping text in production. Parent and coach onboarding consequently appear inside a broken player-training interface, and signed-in adults with no profile have no visible way to sign out.

## Product decision

Separate the application into two mutually exclusive states:

1. **Access and onboarding shell** — shown while loading, signed out, or signed in without an accessible profile.
2. **Training shell** — shown only when a saved player profile, shared coach profile, or explicit sample preview is active.

The API, persistence model, training curriculum, and role authorization rules remain unchanged.

## Access and onboarding shell

- Use a compact Saints-branded header with a logo mark and wordmark that have separate class names.
- Do not render Home, Train, Progress, Profile, or the profile avatar.
- Loading state: show a clear progress message without flashing interactive setup controls.
- Signed-out state: make **Adult sign-in** the primary action and **Explore a sample session** secondary.
- Signed-in empty state: ask whether the adult is a parent/guardian or coach.
- Parent/guardian path: show one focused profile-creation form with a visible route back to the role choice.
- Coach path: explain that a parent must grant profile access and the Site owner must grant Site access. Provide Back and Sign out actions so the screen is not a dead end.
- Every signed-in empty-account state must expose Sign out.

## Training shell

- Render the existing Home, Train, Progress, and Profile navigation only after `enabled` is true.
- Preserve sample-preview behavior and clearly label it as unsaved.
- Preserve player, parent-owner, and coach permissions.
- Keep the current URL-state adapter for tabs and drill dialogs.
- The brand control returns to Home without reloading the application.

## Header implementation

- Use explicit `.tf-brand-mark` and `.tf-brand-copy` elements.
- Remove structural styling based on `.tf-brand > span` so changing element types cannot restyle the wordmark.
- Keep safe-area padding and the compact mobile header.
- Maintain a minimum 44-pixel touch target for interactive header controls.

## Responsive behavior

- At phone widths, onboarding uses one column with 16-pixel side padding and full-width primary actions.
- The onboarding shell must not reserve space for bottom navigation.
- At larger widths, center the onboarding card with a readable maximum width; do not show an empty navigation rail.
- No horizontal overflow is permitted at 320, 375, 390, or 430 pixels.

## Accessibility

- Use one `main` landmark and a labeled onboarding region.
- Preserve visible keyboard focus.
- Loading and error copy use appropriate status or alert semantics.
- Do not expose inactive navigation to keyboard or assistive-technology users.
- Role-choice and form actions use explicit button labels.

## Regression tests

- Server-rendered loading/onboarding output contains no main navigation or profile-avatar control.
- The access shell includes a correctly separated brand mark and wordmark.
- Signed-in empty-account UI includes parent, coach, and sign-out paths.
- The training shell still contains exactly four primary destinations once enabled.
- Existing API, persistence, role-permission, training, evaluation, deep-link, and responsive tests remain green.

## Live acceptance criteria

- Fresh load has no broken or overlapping header content.
- Before profile setup, every visible control produces a visible result.
- Parent setup can be entered and exited.
- Coach empty state can be entered and exited and includes Sign out.
- An existing profile still lands on a clear Home screen with one primary training action.
- The corrected published version is visually inspected after deployment before completion is reported.

## Non-goals

- No curriculum redesign.
- No authentication-provider replacement.
- No organization-directory or invitation system.
- No new global role model.
- No visual redesign of the completed player-training screens beyond changes required to keep the repaired header consistent.
