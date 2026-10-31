# The W-Trilogy deal check: is this deal worth winning?

A free one-page tool that checks a deal, bid, hire or project at three points, so the decision doesn't rest on excitement or pride:

| Tab | When | What it asks |
|---|---|---|
| **1 · WIFI** (Want It, Find It) | Before you chase it | Would you still want it with no name, no rival and no trophy? How much of what it *feels* worth is hype? |
| **2 · WIDI** (Will It, Do It) | While you're in it | Five warning signs of throwing good money after bad, plus a fresh-eyes re-score that ignores money already spent |
| **3 · WIWI** (the ROI of Ego) | To score it, or look back | The WIWI score below, and a post-mortem on what the finished deal actually delivered |

**▶ Try it live: https://shamoilp.github.io/wiwi-calculator/**

![The W-Trilogy deal check on the WIWI tab, showing a score of 1.01, "Thin margin"](docs/screenshot.png)

## The formula

```
          Value × Chance of success
WIWI = ───────────────────────────────────────
        Direct cost + Opportunity cost + Ego tax
```

| Input | What to enter |
|---|---|
| **Value** (V<sub>u</sub>) | What the win is really worth once the excitement fades. Use profit, not revenue |
| **Chance of success** (P<sub>s</sub>) | Your honest odds, not the version you'd pitch to an investor |
| **Direct cost** (C<sub>d</sub>) | Cash you'll spend, plus your hours × your hourly rate |
| **Opportunity cost** (C<sub>o</sub>) | What the same money and time would earn on your next-best option |
| **Ego tax** (C<sub>e</sub>) | The extra you'd pay just to avoid backing down |

## Reading the score

| Score | Verdict | Meaning |
|---|---|---|
| Below 1.0 | 🔴 Expensive regret | The realistic payoff doesn't cover the full cost |
| 1.0 to 1.5 | 🟡 Thin margin | It pays on paper, but a small estimating error flips it |
| 1.5 and above | 🟢 Worth pursuing | The payoff clearly beats the full cost |

The tool also shows the **chance of success you'd need to break even**, which is often the most useful number on the page.

## The other two checks

- **WIFI filter.** Three yes/no questions. Any "no" is a WIFI warning: part of the pull is the label, the rival or the bragging rights. Enter what it *feels* worth and what it will *actually* earn to see the hype gap, then carry the real number into the WIWI score with one click.
- **WIDI warning signs.** Five yes/no questions about sunk cost, sticking with resources because you have them, public commitment, renaming setbacks as "pivots", and losing the "why". "We've spent too much to stop" on its own means stop and decide again from zero. Three or more is a momentum trap.
- **Fresh-eyes re-score.** WIDI's "would I start this today?" test: value × chance ÷ (what's still to spend + what that could earn elsewhere). Money already spent is shown for comparison but left out, because it's gone either way.
- **Post-mortem.** For a finished deal: what it actually delivered ÷ (actual cost + what you gave up + what pride cost you). Below 1.0 is a Pyrrhic victory. It also compares the result with your up-front WIWI score.

## What else it does

- **Red-flag check.** Five yes/no questions that catch ego-driven decisions: public commitment, sunk costs, rivalry. Each "yes" suggests adding 10% of direct costs as ego tax.
- **Stop rule.** You write down "I walk away if…" before you start, while you're still calm.
- **Share link.** The numbers and every WIFI/WIDI answer are saved in the link, so you can send a scored deal to a partner or client.
- **Print / save PDF.** A one-page summary with the score, red flags, stop rule and a line for each W-Trilogy check you did.
- **Free score, simple unlock.** Anyone can see their score. To download the PDF or copy the share link, they leave a name and an email or WhatsApp number and tick a consent box. Each unlock lands as a row in a private Google Sheet. Setup: [`apps-script/README.md`](apps-script/README.md).
- **Private by default.** The numbers stay in the browser while you use the calculator. They are only sent if you unlock the report, and only after you agree. After unlocking, the numbers are kept in the page address so share links work, which means they also show up in your browser history.

## Run it locally

No build step and no dependencies. Serve the folder with any static server:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Tests (Node 20+):

```bash
npm install   # only needed for the page tests (jsdom)
npm test
```

There are 129 tests: the formula, validation and share links (`src/wiwi.js`), the WIFI, WIDI, fresh-eyes and post-mortem checks (`src/trilogy.js`), the contact form (`src/leads.js`), the page, stage tabs and unlock flow (`src/app.js`, `src/stages.js`), and the Google Sheet script (`apps-script/Code.gs`, run against fake Google services).

## Credit

The three checks come from D. Murali's W-Trilogy, featured in *Business Advisor* (Shrinikethan, Chennai), 25 October 2026:

1. [**"WIFI, WIDI, WIWI: A Guide to Conquering Things You'll Eventually Regret"**](https://www.linkedin.com/pulse/wifi-widi-wiwi-guide-conquering-things-youll-regret-part-d-murali--ydzmc/) (Part 1: WIFI)
2. [**"WIDI: The Art of the Vertical Pivot"**](https://www.linkedin.com/pulse/widi-art-vertical-pivot-part-2-w-trilogy-d-murali--rzyfc/) (Part 2)
3. [**"WIWI: The ROI of Ego and the Art of the Post-Mortem"**](https://www.linkedin.com/pulse/wiwi-roi-ego-art-post-mortem-part-3-w-trilogy-d-murali--njejc/) (Part 3), the source of the WIWI formula and the "ego tax"

The names are his "Corporate Latin", a nod to Caesar's *veni, vidi, vici*. The question wording, score bands, red-flag questions, ego-tax suggestion, break-even figure, hype gap and fresh-eyes re-score are this tool's own reading of the articles.

This is a thinking aid, not financial advice.

## About

Built by **Shamoil Plumber**, an accountant and tax advisor working with businesses in Saudi Arabia. See my [GitHub profile](https://github.com/shamoilp) or connect on [LinkedIn](https://www.linkedin.com/in/shamoilp/).

MIT licence.
