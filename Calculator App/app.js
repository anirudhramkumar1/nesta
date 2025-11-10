const form = document.getElementById("calculator-form");
const resultsGrid = document.getElementById("resultsGrid");

const defaultResultsMarkup = resultsGrid?.innerHTML ?? "";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const decimalCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

if (!form || !resultsGrid) {
  throw new Error("Calculator form or results container is missing from the DOM.");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const { inputs, errors } = collectInputs();

  if (errors.length) {
    renderErrors(errors);
    return;
  }

  const { scenarios, carryingCosts, warnings } = calculateScenarios(inputs);
  renderResults({ scenarios, carryingCosts, warnings, termYears: inputs.termYears });
});

form.addEventListener("reset", () => {
  // Delay to ensure native reset has cleared field values
  setTimeout(() => {
    resultsGrid.innerHTML = defaultResultsMarkup;
  }, 0);
});

function collectInputs() {
  const errors = [];

  const getNumericValue = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      errors.push(`Missing input field: ${id}`);
      return null;
    }
    const raw = el.value.trim();
    if (raw === "") {
      return null;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors.push(`Value for ${el.previousElementSibling?.textContent ?? id} is not a valid number.`);
      return null;
    }
    return value;
  };

  const getTextValue = (id) => {
    const el = document.getElementById(id);
    if (!el) {
      errors.push(`Missing input field: ${id}`);
      return "";
    }
    return el.value.trim();
  };

  const holdingPeriodsValue = getTextValue("holdingPeriods");
  const holdingPeriods = holdingPeriodsValue
    ? holdingPeriodsValue
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((num) => Number.isFinite(num) && num > 0)
        .sort((a, b) => a - b)
    : [];

  const inputs = {
    homePrice: getNumericValue("homePrice"),
    downPaymentPct: getNumericValue("downPaymentPct"),
    traditionalRatePct: getNumericValue("traditionalRate"),
    heiRatePct: getNumericValue("heiRate"),
    termYears: getNumericValue("termYears"),
    heiUpfrontFeePct: getNumericValue("heiUpfrontFeePct"),
    heiEquityShareMultiplier: getNumericValue("heiEquityShareMultiplier"),
    homeAppreciationPct: getNumericValue("homeAppreciationPct"),
    propertyTaxPct: getNumericValue("propertyTaxPct"),
    insuranceAnnual: getNumericValue("insuranceAnnual"),
    maintenancePct: getNumericValue("maintenancePct"),
    hoaAnnual: getNumericValue("hoaAnnual"),
    sellingCostPct: getNumericValue("sellingCostPct"),
    discountRatePct: getNumericValue("discountRatePct"),
    modelStartDate: getTextValue("modelStartDate") || null,
    heiPlugInSharePct: getNumericValue("heiPlugInSharePct"),
    heiInvestorRatePct: getNumericValue("heiInvestorRatePct"),
    holdingPeriods,
  };

  validateInputs(inputs, errors);

  return { inputs, errors };
}

function validateInputs(inputs, errors) {
  if (!inputs.homePrice || inputs.homePrice <= 0) {
    errors.push("Home Price must be greater than zero.");
  }

  if (inputs.downPaymentPct == null) {
    errors.push("Down Payment % is required.");
  } else if (inputs.downPaymentPct < 0) {
    errors.push("Down Payment % cannot be negative.");
  }

  if (inputs.termYears == null || inputs.termYears <= 0) {
    errors.push("Term (years) must be greater than zero.");
  }

  if (inputs.traditionalRatePct == null || inputs.traditionalRatePct < 0) {
    errors.push("Traditional Rate cannot be negative.");
  }

  if (inputs.heiRatePct == null || inputs.heiRatePct < 0) {
    errors.push("HEI Rate cannot be negative.");
  }

  if (inputs.heiPlugInSharePct != null && inputs.heiPlugInSharePct < 0) {
    errors.push("HEI Plug-In Share cannot be negative.");
  }
}

function calculateScenarios(inputs) {
  const warnings = [];
  const price = inputs.homePrice;

  const borrowerDownPct = clamp(inputs.downPaymentPct ?? 0, 0, 100);
  if ((inputs.downPaymentPct ?? 0) !== borrowerDownPct) {
    warnings.push("Down Payment % was capped between 0% and 100% for calculations.");
  }

  const defaultHeiSharePct = Math.max(0, 20 - borrowerDownPct);
  let heiSharePct = inputs.heiPlugInSharePct ?? defaultHeiSharePct;
  heiSharePct = Math.max(0, heiSharePct);

  if (borrowerDownPct + heiSharePct > 100) {
    heiSharePct = Math.max(0, 100 - borrowerDownPct);
    warnings.push("HEI Plug-In Share was reduced so the total down payment does not exceed 100%.");
  }

  const borrowerDownAmount = price * (borrowerDownPct / 100);
  const heiContributionAmount = price * (heiSharePct / 100);

  const carryingCosts = calculateMonthlyCarryingCosts(inputs);

  const traditionalScenario = createScenario({
    id: "traditional",
    label: "Traditional Mortgage",
    price,
    loanAmount: Math.max(0, price - borrowerDownAmount),
    ratePct: inputs.traditionalRatePct,
    termYears: inputs.termYears,
    borrowerDownPct,
    borrowerDownAmount,
    heiContributionPct: 0,
    heiContributionAmount: 0,
    carryingCosts,
  });

  const totalDownPctHEI = clamp(borrowerDownPct + heiSharePct, 0, 100);
  const loanAmountHei = Math.max(0, price * (1 - totalDownPctHEI / 100));

  const heiScenario = createScenario({
    id: "hei",
    label: "With HEI Plug-In",
    price,
    loanAmount: loanAmountHei,
    ratePct: inputs.heiRatePct,
    termYears: inputs.termYears,
    borrowerDownPct,
    borrowerDownAmount,
    heiContributionPct: heiSharePct,
    heiContributionAmount,
    carryingCosts,
    heiUpfrontFeePct: inputs.heiUpfrontFeePct,
  });

  return {
    scenarios: [traditionalScenario, heiScenario],
    carryingCosts,
    warnings,
  };
}

function createScenario({
  id,
  label,
  price,
  loanAmount,
  ratePct,
  termYears,
  borrowerDownPct,
  borrowerDownAmount,
  heiContributionPct,
  heiContributionAmount,
  carryingCosts,
  heiUpfrontFeePct,
}) {
  const amortization = amortize({
    principal: loanAmount,
    annualRatePct: ratePct,
    termYears,
  });

  const monthlyAllIn = amortization.monthlyPayment + carryingCosts.total;

  const upfrontFeeAmount =
    heiUpfrontFeePct != null && heiUpfrontFeePct >= 0 ? price * (heiUpfrontFeePct / 100) : null;

  return {
    id,
    label,
    ratePct,
    loanAmount,
    monthlyPayment: amortization.monthlyPayment,
    totalInterest: amortization.totalInterest,
    borrowerDownPct,
    borrowerDownAmount,
    heiContributionPct,
    heiContributionAmount,
    termYears,
    monthlyAllIn,
    carryingCosts,
    upfrontFeeAmount,
  };
}

function amortize({ principal, annualRatePct, termYears }) {
  const sanitizedPrincipal = Math.max(0, Number(principal) || 0);
  const rate = Math.max(0, Number(annualRatePct) || 0);
  const months = Math.max(1, Math.round((Number(termYears) || 0) * 12));

  if (sanitizedPrincipal === 0) {
    return {
      monthlyPayment: 0,
      totalInterest: 0,
    };
  }

  const monthlyRate = rate / 100 / 12;

  if (monthlyRate === 0) {
    const payment = sanitizedPrincipal / months;
    return {
      monthlyPayment: payment,
      totalInterest: 0,
    };
  }

  const payment =
    sanitizedPrincipal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -months)));
  const totalPaid = payment * months;
  const totalInterest = Math.max(0, totalPaid - sanitizedPrincipal);

  return {
    monthlyPayment: payment,
    totalInterest,
  };
}

function calculateMonthlyCarryingCosts(inputs) {
  const price = inputs.homePrice ?? 0;
  const propertyTaxMonthly =
    inputs.propertyTaxPct != null
      ? (price * (inputs.propertyTaxPct / 100)) / 12
      : 0;
  const maintenanceMonthly =
    inputs.maintenancePct != null
      ? (price * (inputs.maintenancePct / 100)) / 12
      : 0;
  const insuranceMonthly =
    inputs.insuranceAnnual != null ? inputs.insuranceAnnual / 12 : 0;
  const hoaMonthly = inputs.hoaAnnual != null ? inputs.hoaAnnual / 12 : 0;

  const total =
    propertyTaxMonthly + maintenanceMonthly + insuranceMonthly + hoaMonthly;

  return {
    total,
    propertyTaxMonthly,
    maintenanceMonthly,
    insuranceMonthly,
    hoaMonthly,
  };
}

function renderErrors(errors) {
  resultsGrid.innerHTML = `
    <div class="grid-span">
      <div class="notice error">
        <strong>We need a bit more information:</strong>
        <ul>
          ${errors.map((error) => `<li>${error}</li>`).join("")}
        </ul>
      </div>
    </div>
  `;
}

function renderResults({ scenarios, carryingCosts, warnings, termYears }) {
  const warningMarkup = warnings.length
    ? `<div class="grid-span">
         <div class="notice warning">
           <strong>Heads up:</strong>
           <ul>
             ${warnings.map((warning) => `<li>${warning}</li>`).join("")}
           </ul>
         </div>
       </div>`
    : "";

  const carryingMarkup =
    carryingCosts.total > 0
      ? `
      <div class="grid-span">
        <div class="muted">
          Other monthly housing costs add up to ${decimalCurrencyFormatter.format(
            carryingCosts.total
          )}.
        </div>
      </div>
    `
      : "";

  const scenarioCards = scenarios
    .map((scenario) => createScenarioMarkup(scenario, termYears))
    .join("");

  resultsGrid.innerHTML = `
    ${warningMarkup}
    ${carryingMarkup}
    ${scenarioCards}
  `;
}

function createScenarioMarkup(scenario, termYears) {
  const termLabel = `${termYears} year${termYears === 1 ? "" : "s"} (${termYears * 12} months)`;

  const downPaymentLine = `${currencyFormatter.format(
    scenario.borrowerDownAmount
  )} (${percentFormatter.format(scenario.borrowerDownPct / 100)})`;

  const heiContributionLine =
    scenario.heiContributionAmount > 0
      ? `${currencyFormatter.format(scenario.heiContributionAmount)} (${percentFormatter.format(
          scenario.heiContributionPct / 100
        )})`
      : null;

  const upfrontFeeLine =
    scenario.upfrontFeeAmount != null
      ? `<div class="result-metric">
          <span>HEI Upfront Fee</span>
          <span>${currencyFormatter.format(scenario.upfrontFeeAmount)}</span>
        </div>`
      : "";

  const carryingLine =
    scenario.carryingCosts.total > 0
      ? `<div class="result-metric">
          <span>All-in Monthly Cost</span>
          <span>${decimalCurrencyFormatter.format(scenario.monthlyAllIn)}</span>
        </div>`
      : "";

  return `
    <article class="result-panel">
      <h3>${scenario.label}</h3>
      <div class="muted">Loan amortized over ${termLabel}</div>

      <div class="result-metric">
        <span>Loan Amount</span>
        <span>${currencyFormatter.format(scenario.loanAmount)}</span>
      </div>

      <div class="result-metric">
        <span>Mortgage Rate</span>
        <span>${percentFormatter.format((scenario.ratePct ?? 0) / 100)}</span>
      </div>

      <div class="result-metric">
        <span>Monthly Payment</span>
        <span>${decimalCurrencyFormatter.format(scenario.monthlyPayment)}</span>
      </div>

      <div class="result-metric">
        <span>Total Interest Paid</span>
        <span>${currencyFormatter.format(scenario.totalInterest)}</span>
      </div>

      ${carryingLine}

      <div class="result-metric">
        <span>Borrower Down Payment</span>
        <span>${downPaymentLine}</span>
      </div>

      ${
        heiContributionLine
          ? `<div class="result-metric">
              <span>HEI Contribution</span>
              <span>${heiContributionLine}</span>
            </div>`
          : ""
      }

      ${upfrontFeeLine}
    </article>
  `;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
