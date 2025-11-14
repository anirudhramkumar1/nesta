const form = document.getElementById('mortgage-form');
const statusEl = document.getElementById('formStatus');
const resultsSection = document.getElementById('results');
const scenarioTwenty = document.getElementById('scenarioTwenty');
const summaryTitle = document.getElementById('summaryTitle');
const deltaMessage = document.getElementById('deltaMessage');
const actualPaymentEl = document.getElementById('actualPayment');
const actualLoanEl = document.getElementById('actualLoan');
const actualDownPctEl = document.getElementById('actualDownPct');
const twentyPaymentEl = document.getElementById('twentyPayment');
const twentyLoanEl = document.getElementById('twentyLoan');

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const percentFormatter = (value) => `${(value * 100).toFixed(1)}%`;

const calculatePayment = (principal, monthlyRate, termMonths) => {
  if (termMonths <= 0) return 0;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }
  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
};

const showStatus = (message, isError = true) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? 'var(--danger)' : 'var(--accent)';
};

const clearStatus = () => {
  statusEl.textContent = '';
};

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  clearStatus();

  const formData = new FormData(form);
  const homePrice = Number(formData.get('homePrice'));
  const downPayment = Number(formData.get('downPayment'));
  const interestRate = Number(formData.get('interestRate'));
  const termYears = Number(formData.get('termYears'));

  const errors = [];

  if (!Number.isFinite(homePrice) || homePrice <= 0) {
    errors.push('Enter a valid home price.');
  }
  if (!Number.isFinite(downPayment) || downPayment < 0) {
    errors.push('Enter a valid down payment (0 or greater).');
  }
  if (Number.isFinite(homePrice) && Number.isFinite(downPayment) && downPayment >= homePrice) {
    errors.push('Down payment must be less than the home price.');
  }
  if (!Number.isFinite(interestRate) || interestRate < 0) {
    errors.push('Enter a valid non-negative interest rate.');
  }
  if (!Number.isFinite(termYears) || termYears <= 0) {
    errors.push('Enter a loan term greater than 0.');
  }

  if (errors.length) {
    showStatus(errors.join(' '));
    resultsSection.hidden = true;
    return;
  }

  const loanAmount = homePrice - downPayment;
  const termMonths = Math.round(termYears * 12);
  const monthlyRate = interestRate === 0 ? 0 : (interestRate / 100) / 12;

  const actualPayment = calculatePayment(loanAmount, monthlyRate, termMonths);
  actualPaymentEl.textContent = currencyFormatter.format(actualPayment);
  actualLoanEl.textContent = currencyFormatter.format(loanAmount);
  const downPct = downPayment / homePrice;
  actualDownPctEl.textContent = percentFormatter(downPct);

  const needsTwentyPercent = downPct < 0.2 - 0.0001;

  let comparisonMessage = '';
  if (needsTwentyPercent) {
    const requiredDownPayment = homePrice * 0.2;
    const altLoanAmount = homePrice - requiredDownPayment;
    const altPayment = calculatePayment(altLoanAmount, monthlyRate, termMonths);

    scenarioTwenty.hidden = false;
    twentyPaymentEl.textContent = currencyFormatter.format(altPayment);
    twentyLoanEl.textContent = currencyFormatter.format(altLoanAmount);

    const delta = actualPayment - altPayment;
    const direction = delta > 0 ? 'more' : 'less';
    comparisonMessage = `This is ${currencyFormatter.format(Math.abs(delta))} ${direction} per month compared to a 20% down payment.`;
  } else {
    scenarioTwenty.hidden = true;
    comparisonMessage = 'You are already at or above a 20% down payment, so the payments stay the same.';
  }

  summaryTitle.textContent = `Estimated Monthly Payments (${termYears}-year term)`;
  deltaMessage.textContent = comparisonMessage;

  resultsSection.hidden = false;
  showStatus('Calculation complete.', false);
});
