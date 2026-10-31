---
name: Zeno
description: One ruled index card at a time; Zeno talks you through the day's first tiny step.
colors:
  ink: "#1a1a1a"
  margin-red: "#d9473b"
  rule-blue: "#9db8da"
  card-stock: "#ffffff"
  desk: "#f4f3ef"
  ink-2: "#5c5c58"
  track: "#d6d3cb"
  dark-ink: "#f1f0eb"
  dark-margin-red: "#e0574c"
  dark-rule-blue: "#3d4e63"
  dark-card-stock: "#232321"
  dark-desk: "#151514"
  dark-ink-2: "#a8a7a1"
  dark-track: "#3a3a37"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: "64px"
  headline:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "40px"
  title:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "32px"
  body:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: "24px"
  label:
    fontFamily: "Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "24px"
  timer:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "56px"
    fontWeight: 500
    fontFeature: "tnum"
  numeral:
    fontFamily: "Atkinson Hyperlegible Mono, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 400
rounded:
  card: "4px"
  stamp: "8px"
  desk: "8px"
  sheet: "16px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
  xl: "48px"
  2xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "56px"
  button-secondary-hover:
    backgroundColor: "{colors.desk}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 32px"
    height: "56px"
  button-small:
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "52px"
  dock-knob:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "56px"
  talk-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card-stock}"
    rounded: "{rounded.pill}"
    size: "64px"
  index-card:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    typography: "{typography.display}"
    rounded: "{rounded.card}"
    padding: "56px 64px 40px 104px"
  mini-card:
    backgroundColor: "{colors.card-stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 24px 16px 40px"
  done-stamp:
    textColor: "{colors.margin-red}"
    rounded: "{rounded.stamp}"
    padding: "0 16px"
  sheet:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.ink}"
    width: "440px"
  desk-view:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.desk}"
    width: "1120px"
---

# Design System: Zeno

## Overview

**Creative North Star: "The Index Card on the Desk"**

Every step of the day is one ruled index card lying on a warm desk, with the next cards' edges peeking out underneath. Words sit on the card's pale blue rules exactly as handwriting would; one red margin line runs down the left. The whole interface is black and white first: near-black ink, white card stock, a warm off-white desk, and a single red reserved for the margin, the stamp, the pen and the voice.

Density is deliberately low. One thing per screen, body text never under 18px, controls never under 52px tall, so older and low-vision people can use it at a laptop. Nothing looks like an AI chat: no bubbles, no avatars, no panels of side content. The one moving signature is the On Air dot ring: sixty small dots around the Talk button that light in margin red with whoever is speaking.

Dark theme is the same desk at night: a near-black desk, charcoal card stock, muted slate rules, and the same red, a little brighter. Light and dark follow the system.

**Key Characteristics:**
- One 760px ruled card per step; text sits on the rules, not between them.
- Black and white first; red only where paper would carry red.
- One family (Atkinson Hyperlegible Next) with its Mono for every time, count and minute.
- Pill buttons: black filled for the yes, outlined for the alternatives, grey-outlined for the quiet way out.
- Soft real paper shadow; no hard offsets, no glass.
- The dot ring is the only voice indicator.

## Colors

A paper-and-ink palette: two warm neutrals, near-black ink, one blue for ruling and one red for marking.

### Primary
- **Ink** (`ink`): text, filled pills, the Talk button, the Z mark, the current step bar and the 3px focus ring. In dark it inverts to Warm Chalk (`dark-ink`).

### Secondary
- **Margin Red** (`margin-red`; `dark-margin-red` at night): the card's 2px margin line, the DONE stamp, the caret and listening pen, a written-on line under focus, lit dots in the voice ring, the now/next dot on the desk timeline, and the in-progress step bar on the desk view's plan strip. Never a button fill, never body text.

### Tertiary
- **Rule Blue** (`rule-blue`; `dark-rule-blue` at night): the 1px horizontal rules on cards and the underline of the caption input. Structural only; never text.

### Neutral
- **Card Stock** (`card-stock`; `dark-card-stock`): every card, strip, mini card and the edges of waiting cards.
- **Desk** (`desk`; `dark-desk`): the page ground, sheets and the desk view; also the hover fill of outlined pills.
- **Pencil Grey** (`ink-2`; `dark-ink-2`): secondary text, placeholders, minutes, inactive step names.
- **Track** (`track`; `dark-track`): unlit dots, upcoming step bars, quiet pill outlines, sheet edges, and in dark the 1px rim that lifts the desk view.

### Named Rules
**The Red Pen Rule.** Red appears only where a teacher's pen or a margin would put it: the margin line, the stamp, the caret, the lit dots, the timeline mark, the in-progress step bar on the desk view. If it is a button or a heading, it is ink.

**The Two Themes, One Red Rule.** Dark mode swaps the paper and the ink but keeps the red role identical; never introduce a dark-only accent.

## Typography

**Display Font:** Atkinson Hyperlegible Next (with system-ui)
**Label/Mono Font:** Atkinson Hyperlegible Mono (with ui-monospace)

**Character:** A hyperlegible humanist sans that reads as calm handwriting on a card at large sizes, with its Mono sibling for anything that counts.

### Hierarchy
- **Display** (500, 44px on 64px rules): Zeno's line on the index card. Steps down to 36/56 and 30/48 for longer lines (card size m and s), to 40/56 on short laptop screens and 30/40 on phones.
- **Hand** (400, 30px, on the display's rules): the person's words and smaller writing sitting on the same rules.
- **Headline** (700, 28px/40px): sheet and desk view titles (Today, Memory).
- **Title** (700, 20px/32px): mini card headings, roadmap strip, caption line.
- **Body** (400, 18px/24px): everything else. 18px is the floor.
- **Label** (700, 20px/24px; 18px on small pills and phones): pill text. Dock labels are 500 at body size; Talk is 700.
- **Timer** (Mono 500, 56px, tabular numerals; 40px on phones): the focus countdown, written on the card's rules.
- **Numeral** (Mono 400, 24px, Pencil Grey): minutes at the right end of a step's first line, on the same rule. Times, dates' clock and done counts are Mono at body size.

### Named Rules
**The On-the-Rule Rule.** Any text placed on a card sits on a blue rule: line-height equals the rule spacing, and smaller writing inherits the parent's strut so its baseline lands on the same line.

**The Mono Counts Rule.** Every clock time, minute count and done count is set in the Mono; words never are.

## Layout

A single centered column. The top bar spans up to 1224px (Z mark and Zeno left; date, Mono time and Sound right). Below it the four-step progress row (Brief, Pick one thing, First step, Focus) uses 4px bars aligned to the card's 760px width, current step bold over an ink bar. The card sits centered at 760px max; answer pills wrap centered beneath it; the dock (Talk in its ring, then Type, Today, Memory) closes the column.

Spacing follows an 8px grid (8, 16, 24, 32, 48, 64). The card pads 56px top, 64px right and 104px left so words clear the red margin at 64px.

Responsive behavior: below 640px the card tightens (margin at 40px, left pad 56px, display 30/40), pills stack at 52px, only the current step name shows, and the done count moves to the top bar. A `short` variant (width at least 640px, height 820px or less) shrinks the card to three rows and the dock to 96px so the dock stays on the first screen of a laptop. Above 1000px tall the card shows five rows. Below 1120px wide the done pile beside the card hides.

## Elevation & Depth

Depth is real paper: soft, layered, ambient shadows on card stock over the desk, never hard offsets. Cards waiting underneath are drawn as offset edges with a lighter shadow; finished cards land on a small rotated pile at the desk's side.

### Shadow Vocabulary
- **Paper** (`0 0 0 1px rgb(26 26 26 / 0.06), 0 1px 2px rgb(26 26 26 / 0.08), 0 12px 24px -12px rgb(26 26 26 / 0.18), 0 32px 56px -28px rgb(26 26 26 / 0.22)`): the top index card and the desk view.
- **Edge** (`0 0 0 1px rgb(26 26 26 / 0.07), 0 4px 8px -4px rgb(26 26 26 / 0.16)`): waiting card edges, roadmap strips, the pile and mini cards.
- **Sheet** (`-1px 0 0 track, 0 -1px 0 track, -24px 0 48px -24px rgb(0 0 0 / 0.3)`): side sheets over a scrim.
- Dark theme uses the same structure with black shadows and a 6% white hairline.

### Named Rules
**The Real Paper Rule.** A surface either is card stock (Paper or Edge shadow) or is the desk (no shadow). Nothing floats in between.

## Shapes

Cards are nearly square-cornered (4px), like cut card stock. Interactive controls are full pills (999px) or circles: pills, the 56px dock knobs, the 64px Talk button. The DONE stamp is a 4px double red border at 8px radius, rotated -8deg. The desk view has 8px corners; phone sheets round their top corners at 16px. The Z mark is an ink rounded square. The red margin line is 2px; rules are 1px.

## Components

### Buttons
- **Shape:** full pill (999px), 2px border, 56px tall (52px small and on phones).
- **Primary:** Ink fill, Card Stock text, 20px bold label. Hover mixes 18% card into the ink.
- **Secondary:** Card Stock fill, 2px Ink outline, Ink text. Hover fills with Desk.
- **Quiet:** transparent, Track outline, Ink text (only the border is quieter); for "Something else", "Not now" style exits.
- **Press:** scales to 0.96 instantly, springs back over 0.12s (cubic-bezier(0.16, 1, 0.3, 1)). Hover only on real pointers.
- **Disabled:** 50% opacity, no press.
- **Focus:** 3px Ink outline at 4px offset, system-wide.

### Index Card (signature)
- **Corner Style:** 4px.
- **Background:** Card Stock with Paper shadow, blue rules every line, a 2px red margin line at 64px, two or three Edge cards peeking below.
- **Content:** Zeno's line in Display, the person's reply in Hand on the next rule, minutes in Mono at the right end of the first line, the timer on the rules during Focus.
- **Motion:** a new card rises 24px from 97% scale in 0.22s; Zeno's words appear word by word (blur 4px to sharp, 280ms apart); finished cards get the DONE stamp (scales from 1.8 in 0.2s) then fly to the pile in 0.3s.

### Inputs / Fields
- **Style:** no box. Typing happens on the card's next rule, transparent background, red caret.
- **Focus:** the line being written on turns red (2px) instead of drawing an outline. In the caption variant under a step card, a 2px Rule Blue underline turns red.
- **Listening:** a blinking 3px red pen sits after the words.

### Roadmap Strip
Steps after the current one fan out under the card as Card Stock strips with Edge shadow, each inset 16px further per depth, title at 20/32 and minutes in Mono.

### Dock (Navigation)
- **Style:** a row of labeled circular controls at the foot of the column, sticky to the bottom of the viewport on the Desk ground so long content scrolls under it: Talk centered in the dot ring, then Type, Today, Memory as 56px outlined knobs with a 24px stroke icon. Labels always visible under each.
- **States:** hover fills a knob with Desk; press scales to 0.96.

### Voice Ring (signature)
Sixty 1.9px dots on a 54px radius around the 64px ink Talk button, unlit in Track. Listening sweeps a lit arc (a sixth minimum, growing with level); thinking runs a short fading comet; speaking grows symmetrically from twelve o'clock with the voice level. Reduced motion shows one still arc per state. Mic blocked turns Talk to an outline with a slash.

### Sheets and Desk View
- **Sheets** (Memory, setup lists): 440px right-side panels on Desk with a scrim, sliding in over 0.24s; bottom sheets with 16px top corners on phones. Content is mini cards: small ruled cards (20/32, margin at 24px, Edge shadow).
- **Desk View** (Today): up to 1120px over the scrim, starting at the card's top edge, 8px corners, Paper shadow, Track rim in dark. Plan strip on top (4px step bars: done in Ink with struck text, in progress in Margin Red and bold, upcoming in Track), then calendar and inbox mini cards side by side (stacked below 1024px). The red margin doubles as the day's timeline, with a filled red dot for now and a hollow one for next.

### Progress
Four labeled 4px bars (Ink done or current, Track upcoming) for the guided flow; setup uses 12px dots in the same two colors.

## Do's and Don'ts

### Do:
- **Do** put every line of card text on a rule; size changes keep the rule spacing (64, 56, 48, 40, 32px).
- **Do** keep one primary Ink pill per screen, with outlined and quiet pills as the alternatives.
- **Do** set times, minutes and counts in Atkinson Hyperlegible Mono with tabular numerals.
- **Do** keep body text at 18px or larger and controls at 52px or taller.
- **Do** honor reduced motion: no rise, word pacing, stamp or ring animation; the leaving card simply fades.
- **Do** build new surfaces (calendar, inbox, AI) as cards on this desk using the mini card and the Edge shadow.

### Don't:
- **Don't** use chat bubbles, avatars or a message thread; Zeno's words are written on a card.
- **Don't** use red for buttons, headings or body text.
- **Don't** add a second accent color or gradient; the palette is paper, ink, one blue rule and one red.
- **Don't** use hard offset shadows or glass blur; depth is soft paper shadow only.
- **Don't** add a second voice indicator (waveforms, pulsing orbs); the dot ring is the only one.
- **Don't** draw boxes around text inputs on a card; focus shows as the written line turning red.
