const form = document.getElementById("mortgage-form");
const errorMessage = document.getElementById("form-error");
const resultsSection = document.getElementById("results");
const analysis = document.getElementById("analysis");
const resultTemplate = document.getElementById("result-template");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearResults();

  const homePrice = parseCurrencyValue(form.homePrice.value);
  const downPayment = parseCurrencyValue(form.downPayment.value);
  const termYears = parseInt(form.termYears.value, 10);
  const monthlyPaymentInput = parseCurrencyValue(form.monthlyPayment.value);

  const validationError = validateInputs({
    homePrice,
    downPayment,
    termYears,
    monthlyPayment: monthlyPaymentInput,
  });

  if (validationError) {
    showError(validationError);
    return;
  }

  const loanAmount = homePrice - downPayment;
  const totalMonths = termYears * 12;

  const estimatedRate = solveMonthlyRate({
    principal: loanAmount,
    payment: monthlyPaymentInput,
    months: totalMonths,
  });

  if (Number.isNaN(estimatedRate)) {
    showError(
      "Unable to estimate the interest rate from the provided monthly payment. Please double-check your inputs."
    );
    return;
  }

  hideError();

  const dataSets = [];

  const actualPayment = calculateMonthlyPayment({
    principal: loanAmount,
    monthlyRate: estimatedRate,
    months: totalMonths,
  });

  dataSets.push({
    label: "Your Current Scenario",
    loanAmount,
    downPayment,
    monthlyPayment: actualPayment,
    annualRate: toAnnualPercent(estimatedRate),
  });

  const requiredDownPayment = homePrice * 0.2;

  if (downPayment < requiredDownPayment) {
    const twentyLoanAmount = Math.max(homePrice - requiredDownPayment, 0);
    const twentyPayment = calculateMonthlyPayment({
      principal: twentyLoanAmount,
      monthlyRate: estimatedRate,
      months: totalMonths,
    });

    dataSets.push({
      label: "With 20% Down",
      loanAmount: twentyLoanAmount,
      downPayment: requiredDownPayment,
      monthlyPayment: twentyPayment,
      annualRate: toAnnualPercent(estimatedRate),
    });
  }

  renderResults({
    dataSets,
    monthlyPaymentInput,
  });
});

function parseCurrencyValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function validateInputs({ homePrice, downPayment, termYears, monthlyPayment }) {
  if (!Number.isFinite(homePrice) || homePrice <= 0) {
    return "Home price must be greater than zero.";
  }
  if (!Number.isFinite(downPayment) || downPayment < 0) {
    return "Down payment cannot be negative.";
  }
  if (downPayment > homePrice) {
    return "Down payment cannot exceed the home price.";
  }
  if (!Number.isFinite(termYears) || termYears <= 0) {
    return "Term must be at least one year.";
  }
  if (!Number.isFinite(monthlyPayment) || monthlyPayment <= 0) {
    return "Monthly payment must be greater than zero.";
  }
  const principal = homePrice - downPayment;
  if (principal <= 0) {
    return "Down payment covers the full home price—no mortgage to calculate.";
  }
  const minimumPayment = principal / (termYears * 12);
  if (monthlyPayment < minimumPayment) {
    return "Monthly payment is too low to amortize the loan with the selected term.";
  }
  return "";
}

function solveMonthlyRate({ principal, payment, months }) {
  if (payment <= 0 || principal <= 0 || months <= 0) {
    return NaN;
  }

  const paymentAtRate = (rate) =>
    calculateMonthlyPayment({
      principal,
      monthlyRate: rate,
      months,
    });

  let low = 0;
  let high = 0.05; // start with 5% monthly (~60% APR)
  let iterations = 0;
  const maxIterations = 60;

  while (paymentAtRate(high) < payment && iterations < 20) {
    low = high;
    high *= 2;
    iterations += 1;
    if (high > 5) {
      // 500% monthly interest is unrealistic; abort
      return NaN;
    }
  }

  for (let i = 0; i < maxIterations; i += 1) {
    const mid = (low + high) / 2;
    const guess = paymentAtRate(mid);
    if (Math.abs(guess - payment) < 0.01) {
      return mid;
    }
    if (guess > payment) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return (low + high) / 2;
}

function calculateMonthlyPayment({ principal, monthlyRate, months }) {
  if (principal <= 0) {
    return 0;
  }
  if (monthlyRate === 0) {
    return principal / months;
  }
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function toAnnualPercent(monthlyRate) {
  if (monthlyRate <= 0) {
    return 0;
  }
  return (Math.pow(1 + monthlyRate, 12) - 1) * 100;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function renderResults({ dataSets, monthlyPaymentInput }) {
  resultsSection.hidden = false;

  const fragment = document.createDocumentFragment();

  dataSets.forEach((data) => {
    const card = resultTemplate.content.cloneNode(true);
    card.querySelector("h3").textContent = data.label;
    card.querySelector(".loan-amount").textContent = formatCurrency(data.loanAmount);
    card.querySelector(".monthly-payment").innerHTML = `<strong>${formatCurrency(
      data.monthlyPayment
    )}</strong>`;
    card.querySelector(".interest-rate").textContent = formatPercent(data.annualRate);
    card.querySelector(".down-payment").textContent = formatCurrency(data.downPayment);
    fragment.appendChild(card);
  });

  analysis.appendChild(fragment);

  if (dataSets.length === 2) {
    const [current, twenty] = dataSets;
    const savings = current.monthlyPayment - twenty.monthlyPayment;
    const summary = document.createElement("p");
    summary.className = "summary";

    if (savings > 0) {
      summary.innerHTML = `With 20% down you could save approximately <span class="highlight">${formatCurrency(
        savings
      )}</span> per month on principal and interest.`;
    } else if (savings < 0) {
      summary.innerHTML = `With 20% down your monthly payment would increase by about <span class="highlight">${formatCurrency(
        Math.abs(savings)
      )}</span>.`;
    } else {
      summary.textContent = "Both scenarios result in the same monthly payment.";
    }

    analysis.appendChild(summary);
  } else {
    const note = document.createElement("p");
    note.className = "summary";
    note.textContent = "Your down payment already meets the 20% threshold.";
    analysis.appendChild(note);
  }
}

function clearResults() {
  resultsSection.hidden = true;
  analysis.innerHTML = "";
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  resultsSection.hidden = true;
}

function hideError() {
  errorMessage.hidden = true;
}
