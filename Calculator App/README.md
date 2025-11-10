# Mortgage & HEI Scenario Calculator

This lightweight web app helps you explore traditional mortgage payments alongside an HEI (Home Equity Investment) plug-in structure. Plug in your assumptions and instantly compare monthly payments and total interest paid under each scenario.

## Getting Started

No build step is required. Open `index.html` in your browser, or serve the directory with a simple static server:

```bash
cd "Calculator App"
python3 -m http.server 5173
```

Then visit `http://localhost:5173` in your browser.

## Inputs

The form captures the financing and operating assumptions you outlined:

- Purchase price, down payment %, mortgage rates, and loan term.
- HEI terms (plug-in share, upfront fee, investor rate, equity share multiplier).
- Operating assumptions including taxes, insurance, maintenance, HOA, selling costs, appreciation, and NPV discount rate.
- Holding periods and model start date for future scenario layering.

Percentages should be entered as whole numbers (`20` → 20%).

## Outputs

For both the traditional and HEI scenarios the calculator displays:

- Loan amount
- Mortgage rate
- Monthly mortgage payment
- Total interest paid over the full term
- Borrower down payment (amount + percent)
- HEI contribution (when relevant)
- Optional HEI upfront fee
- All-in monthly cost (mortgage + carrying costs) when taxes/insurance/etc. are provided

Warnings surface automatically when inputs need to be capped (e.g., total down payment exceeding 100%).

## Next Ideas

- Expand the output section with cashflow projections over user-specified holding periods.
- Model HEI equity sharing at exit using the appreciation and multiplier inputs.
- Export amortization schedules or NPV summaries.

Contributions and refinements welcome! Open the page, tweak assumptions, and review the comparison instantly.
