const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

window.dataLayer = window.dataLayer || [];
const track = (event, details = {}) => window.dataLayer.push({ event, ...details });

const header = $('.site-header');
const menuTrigger = $('.menu-trigger');
const navDialog = $('#mobile-menu');
const navClose = $('.nav-close');

function trapDialogFocus(dialog, event) {
  if (event.key !== 'Tab') return;

  const focusable = $$([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(','), dialog).filter(element => !element.hidden && element.getClientRects().length);

  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  const focusIsOutside = !dialog.contains(document.activeElement);

  if (event.shiftKey && (document.activeElement === first || focusIsOutside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || focusIsOutside)) {
    event.preventDefault();
    first.focus();
  }
}

addEventListener('scroll', () => {
  header.classList.toggle('is-scrolled', scrollY > 24);
}, { passive: true });

function openNavigation() {
  menuTrigger.setAttribute('aria-expanded', 'true');
  navDialog.showModal();
  navClose.focus();
}

function closeNavigation({ restoreFocus = true } = {}) {
  if (navDialog.open) navDialog.close();
  menuTrigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menuTrigger.focus();
}

menuTrigger.addEventListener('click', openNavigation);
navClose.addEventListener('click', () => closeNavigation());
navDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeNavigation();
});
$$('nav a', navDialog).forEach(link => {
  link.addEventListener('click', () => closeNavigation({ restoreFocus: false }));
});

const leadDialog = $('#lead-dialog');
const leadForm = $('#lead-form');
const leadTitle = $('#lead-title');
const leadClose = $('.lead-close');
const successClose = $('.close-success');
const serviceField = $('#service');
const dateField = $('#visit-date');
const successPanel = $('.form-success');
const summaryField = $('#lead-summary');
const formHeaderCopy = $('.lead-form__head > div');
const progress = $('.progress');
const stepLabel = $('#step-label');
let currentStep = 1;
let lastTrigger = null;

const stepTitles = [
  'Что вас интересует?',
  'Когда вам удобно?',
  'Как с вами связаться?'
];

const serviceNames = [...new Set(
  $$('[data-service]')
    .map(element => element.dataset.service?.trim())
    .filter(Boolean)
)];

serviceField.replaceChildren(
  new Option('Выберите направление', ''),
  ...serviceNames.map(name => new Option(name, name))
);

const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 10);
dateField.min = localToday;

function clearError(field, errorId) {
  field.removeAttribute('aria-invalid');
  $(`#${errorId}`).textContent = '';
}

function setError(field, errorId, message) {
  field.setAttribute('aria-invalid', 'true');
  $(`#${errorId}`).textContent = message;
}

function clearAllErrors() {
  clearError(serviceField, 'service-error');
  clearError(dateField, 'date-error');
  clearError($('#name'), 'name-error');
  clearError($('#phone'), 'phone-error');
  clearError($('#consent'), 'consent-error');
  $('#time-error').textContent = '';
}

function setStep(step) {
  currentStep = step;
  $$('.form-step', leadForm).forEach((panel, index) => {
    const active = index === step - 1;
    panel.hidden = !active;
    panel.classList.toggle('active', active);
  });
  $$('.progress span', leadForm).forEach((bar, index) => {
    bar.classList.toggle('active', index < step);
  });
  stepLabel.textContent = `Шаг ${step} из 3`;
  leadTitle.textContent = stepTitles[step - 1];
  const activePanel = $(`.form-step[data-step="${step}"]`, leadForm);
  const firstField = $('select, input', activePanel);
  requestAnimationFrame(() => firstField?.focus());
}

function resetLeadForm() {
  leadForm.reset();
  clearAllErrors();
  successPanel.hidden = true;
  formHeaderCopy.hidden = false;
  progress.hidden = false;
  leadTitle.hidden = false;
  summaryField.value = '';
  setStep(1);
}

function openLead(trigger) {
  lastTrigger = trigger;
  if (navDialog.open) closeNavigation({ restoreFocus: false });
  resetLeadForm();
  serviceField.value = trigger.dataset.service || '';
  leadDialog.showModal();
  requestAnimationFrame(() => serviceField.focus());
  track('lead_open', {
    service_id: trigger.dataset.service || 'not_selected',
    source_section: trigger.closest('section')?.id || 'global'
  });
}

function closeLead() {
  if (leadDialog.open) leadDialog.close();
}

$$('.js-lead').forEach(button => {
  button.addEventListener('click', () => openLead(button));
});

leadClose.addEventListener('click', closeLead);
successClose.addEventListener('click', closeLead);
leadDialog.addEventListener('cancel', event => {
  event.preventDefault();
  closeLead();
});
leadDialog.addEventListener('close', () => lastTrigger?.focus());

document.addEventListener('keydown', event => {
  const openDialog = leadDialog.open ? leadDialog : navDialog.open ? navDialog : null;
  if (openDialog) trapDialogFocus(openDialog, event);
}, true);

function validateStepOne() {
  clearError(serviceField, 'service-error');
  if (!serviceField.value) {
    setError(serviceField, 'service-error', 'Выберите услугу или тему вопроса.');
    serviceField.focus();
    return false;
  }
  return true;
}

function validateStepTwo() {
  clearError(dateField, 'date-error');
  $('#time-error').textContent = '';
  const selectedTime = $('input[name="time"]:checked', leadForm);
  if (!dateField.value) {
    setError(dateField, 'date-error', 'Выберите предпочтительную дату.');
    dateField.focus();
    return false;
  }
  if (dateField.value < localToday) {
    setError(dateField, 'date-error', 'Выберите сегодняшнюю или будущую дату.');
    dateField.focus();
    return false;
  }
  if (!selectedTime) {
    $('#time-error').textContent = 'Выберите удобное время суток.';
    $('input[name="time"]', leadForm).focus();
    return false;
  }
  return true;
}

function validateStepThree() {
  const name = $('#name');
  const phone = $('#phone');
  const consent = $('#consent');
  clearError(name, 'name-error');
  clearError(phone, 'phone-error');
  clearError(consent, 'consent-error');

  if (name.value.trim().length < 2) {
    setError(name, 'name-error', 'Введите имя — минимум два символа.');
    name.focus();
    return false;
  }
  if (phone.value.replace(/\D/g, '').length < 9) {
    setError(phone, 'phone-error', 'Введите корректный номер телефона.');
    phone.focus();
    return false;
  }
  if (!consent.checked) {
    setError(consent, 'consent-error', 'Подтвердите согласие, чтобы подготовить заявку.');
    consent.focus();
    return false;
  }
  return true;
}

$$('.next-step', leadForm).forEach(button => {
  button.addEventListener('click', () => {
    const valid = currentStep === 1 ? validateStepOne() : validateStepTwo();
    if (!valid) return;
    setStep(currentStep + 1);
    track('lead_step', { step: currentStep });
  });
});

$$('.back-step', leadForm).forEach(button => {
  button.addEventListener('click', () => setStep(currentStep - 1));
});

function formatDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(`${value}T12:00:00`));
}

leadForm.addEventListener('submit', event => {
  event.preventDefault();
  if (!validateStepThree()) return;

  const data = new FormData(leadForm);
  summaryField.value = [
    'Здравствуйте! Хочу оставить предварительную заявку.',
    `Услуга: ${data.get('service')}`,
    `Предпочтительная дата: ${formatDate(data.get('date'))}`,
    `Удобное время: ${data.get('time')}`,
    `Имя: ${data.get('name').trim()}`,
    `Телефон: ${data.get('phone').trim()}`
  ].join('\n');

  $$('.form-step', leadForm).forEach(panel => panel.hidden = true);
  formHeaderCopy.hidden = true;
  progress.hidden = true;
  leadTitle.hidden = true;
  successPanel.hidden = false;
  requestAnimationFrame(() => $('#success-title').focus());
  track('lead_draft_ready', { service_id: data.get('service') });
});

async function copySummary() {
  try {
    await navigator.clipboard.writeText(summaryField.value);
  } catch {
    summaryField.select();
    document.execCommand('copy');
  }
  showToast('Текст заявки скопирован');
}

$('#copy-lead').addEventListener('click', copySummary);
$('#share-lead').addEventListener('click', async () => {
  if (!navigator.share) {
    await copySummary();
    return;
  }
  try {
    await navigator.share({ title: 'Предварительная заявка', text: summaryField.value });
  } catch (error) {
    if (error.name !== 'AbortError') showToast('Не удалось открыть меню — текст можно скопировать');
  }
});

function showToast(message) {
  const toast = $('.toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.hidden = true, 2600);
}
