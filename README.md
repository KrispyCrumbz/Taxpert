# Deductly

<p align="center">
  <img src="Deductly/assets/logo-primary.svg" alt="Deductly logo" width="220">
</p>

**A simpler way to prepare for tax time.**

Deductly is a browser-based Australian tax return helper designed to help users organise their expenses, review potential deductions and estimate their tax outcome before lodging a return.
Built with HTML, CSS and vanilla JavaScript, the project uses a lightweight client-side architecture without a backend, build step or installation requirements.

<p align="left">
  <a href="https://krispycrumbz.github.io/Taxpert/Deductly">
    <img src="https://img.shields.io/badge/Live%20Demo-Try%20Deductly-185034?style=flat-square" alt="Live demo">
  </a>
  <img src="https://img.shields.io/badge/HTML5-Markup-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-Styling-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
</p>

---

## Overview

Tax time involves more than entering a salary and waiting for a refund estimate. Deductly approaches the process as a guided workflow, allowing users to enter their tax details, record expenses and review an estimate in one place.

The interface is split into three steps:

1. **Profile** — enter the information needed for the estimate.
2. **Expenses** — record expenses and organise potential deductions.
3. **Review** — examine the estimated tax outcome and export the results as a CSV file.

The aim is to make the process easier to follow without overwhelming users with tax terminology.

## Features

| Feature | Description |
| --- | --- |
| Guided workflow | A three-step process for entering details, recording expenses and reviewing results. |
| Tax estimation | Estimates tax outcomes using Australian resident income tax rates and relevant adjustments for 2025–26. |
| Expense tracking | Record expenses to help organise potential deductions. |
| CSV export | Export review data for use in a spreadsheet or further analysis. |
| Local persistence | Saves answers in the browser using `localStorage`, so they remain available between visits on the same browser. |
| Responsive interface | A straightforward interface designed around the Deductly visual identity. |
| No backend required | Runs as a static website without a server, account system or build process. |

## How it works

Deductly is organised around small, page-specific JavaScript components rather than a large framework.

Each page contains its own markup and delegates its behaviour to a corresponding script in `js/`. The scripts provide the values used by the templates and handle user interactions.

A small template runtime connects the two, while `morphdom` updates the existing DOM when state changes. This helps preserve the current interface during re-renders, including focus while typing.

The result is a lightweight implementation that can be inspected and run without setting up a development server or installing application dependencies.

## Tech stack

- **HTML5** — page structure and templates.
- **CSS3** — layout, styling and responsive presentation.
- **Vanilla JavaScript** — application state, interactions and tax calculations.
- **`localStorage`** — browser-side persistence.
- **morphdom** — efficient DOM updates between renders.
- **Prettier** — consistent source formatting.

No frontend framework or bundler is required.

## Project structure

```text
deductly/
├── index.html          # Home page
├── profile.html        # Step 1: tax profile
├── expenses.html       # Step 2: expenses
├── review.html         # Step 3: results and CSV export
├── brand.html          # Brand reference
├── js/
│   ├── dc-lite.js      # Lightweight template runtime
│   ├── morphdom.min.js # DOM updates
│   ├── profile.js      # Profile page logic
│   ├── expenses.js     # Expense page logic
│   └── review.js       # Tax calculations and review logic
├── .prettierrc.json    # Formatting configuration
└── README.md
```

## Running locally

There is no build process or package installation required to run the site.

1. Clone the repository.
2. Open `index.html` in a browser.
3. Work through the profile, expenses and review pages.

```bash
git clone <repository-url>
cd deductly
```

Replace `<repository-url>` with the repository's clone URL.

For source formatting, install Node.js and npm, then run:

```bash
npm install
npm run format
```

The formatting commands are only needed when editing the source; they are not required to use the website.

## Tax calculation notes

The estimation logic lives in `js/review.js`. It accounts for the applicable 2025–26 resident income tax rates and incorporates relevant adjustments, including the Medicare levy, Medicare levy surcharge, low income tax offset and study loan repayments.

These calculations are intended to provide an estimate for planning purposes. Actual tax outcomes depend on individual circumstances, eligibility rules and the information supplied by the user.

**Deductly is not an official ATO service, does not lodge tax returns and does not provide tax advice.** Users should verify their circumstances and figures against current Australian Taxation Office guidance or consult a registered tax professional.

## Privacy

Deductly is designed to keep user-entered information in the visitor's own browser using `localStorage`. The application does not send those answers to a Deductly backend.

Local browser storage is not the same as encrypted or permanent storage. Clearing browser data or using a different browser or device may remove or separate saved information.

## Design

The visual identity uses a muted green palette with warm neutral backgrounds and a yellow accent.

| Colour | Hex |
| --- | --- |
| Deductly Green | `#185034` |
| Deep Green | `#10392C` |
| Sage | `#738574` |
| Ink | `#11231C` |
| Paper | `#F3F5F1` |
| Wattle | `#F2C230` |

Typography uses Bricolage Grotesque, Hanken Grotesk and IBM Plex Mono, sourced from Google Fonts.

## Development notes

The source is formatted with Prettier using the repository's `.prettierrc.json` configuration. Each page's behaviour is kept in its own script, making it easier to locate and change the relevant logic.

When modifying the tax estimator, `js/review.js` is the main file to inspect. Changes to tax thresholds, offsets or repayment rules should be checked against the relevant financial year's official guidance.

## Future improvements

- Add receipt attachments and more detailed expense categorisation.
- Improve deduction guidance and validation for different expense types.
- Expand automated tests for tax calculations and edge cases.
- Improve accessibility and keyboard navigation.
- Add clearer breakdowns explaining how each estimate is calculated.

## Disclaimer

Deductly is an independent personal project for educational and planning purposes. It is not affiliated with or endorsed by the Australian Taxation Office. Tax estimates may be incomplete or inaccurate and should not be relied on as a substitute for professional advice.

---

*Built as a practical exploration of frontend development, browser-side state management and Australian tax estimation.*