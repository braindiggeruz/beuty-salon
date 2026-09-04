const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

window.dataLayer = window.dataLayer || [];
const track = (event, details = {}) => window.dataLayer.push({ event, ...details });

const header = $('.site-header');
const menuTrigger = $('.menu-trigger');
const navDialog = $('#mobile-menu');
const navClose = $('.nav-close');
const mobileAction = $('.mobile-action');
const hero = $('.hero');
const heroLeadAction = $('.hero .js-lead');
const footer = $('.footer');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

/*
 * Motion is an enhancement, never a loading dependency. Interactive controls
 * stay visible; only editorial copy and imagery receive a one-time reveal.
 */
function setupScrollMotion() {
  if (motionPreference.matches || !('IntersectionObserver' in window)) return;

  const targets = new Set();
  const linkedReveals = new Map();
  const copyGroups = [
    $$('.service-entry__intro > .eyebrow, .service-entry__intro > h2, .service-entry__intro > p:last-child'),
    $$('.all-services__head .eyebrow, .all-services__head h2, .all-services__head > p'),
    $$('.approach__statement > .eyebrow, .approach__statement > h2, .approach__lead'),
    $$('.visit__content > .eyebrow, .visit__content > h2'),
    $$('.faq__title > .eyebrow, .faq__title > h2'),
    $$('.contact__copy > .eyebrow, .contact__copy > h2, .contact__address')
  ];

  copyGroups.forEach(group => group.forEach((element, index) => {
    element.classList.add('reveal-copy');
    element.style.setProperty('--reveal-delay', `${index * 55}ms`);
    targets.add(element);
  }));

  $$('.feature-service__image, .visit__image, .contact__art').forEach(element => {
    element.classList.add('reveal-mask');
    const watchTarget = element.closest('.feature-service, .visit, .contact') || element;
    const linked = linkedReveals.get(watchTarget) || [];
    linked.push(element);
    linkedReveals.set(watchTarget, linked);
    targets.add(watchTarget);
  });

  $$('.question-cards, .visit__content ol').forEach(group => {
    group.classList.add('reveal-stagger');
    [...group.children].forEach((element, index) => {
      element.style.setProperty('--reveal-order', index);
    });
    targets.add(group);
  });

  document.documentElement.classList.add('motion-ready');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      linkedReveals.get(entry.target)?.forEach(element => element.classList.add('is-visible'));
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  targets.forEach(element => observer.observe(element));

  motionPreference.addEventListener?.('change', event => {
    if (!event.matches) return;
    observer.disconnect();
    targets.forEach(element => element.classList.add('is-visible'));
    linkedReveals.forEach(elements => elements.forEach(element => element.classList.add('is-visible')));
    document.documentElement.classList.remove('motion-ready');
  }, { once: true });
}

setupScrollMotion();

/*
 * The fixed mobile CTA is intentionally contextual rather than permanently
 * visible. The hero owns the primary action on the first screen; the fixed
 * action takes over only after that screen has been passed, then yields to
 * dialogs and the footer so it never competes with or covers their controls.
 */
function setupMobileAction() {
  if (!mobileAction || !hero || !heroLeadAction) return;

  const mobileViewport = matchMedia('(max-width: 680px)');
  const state = {
    heroPassed: false,
    heroActionVisible: true,
    footerVisible: false
  };

  const anyDialogOpen = () => $$('dialog[open]').length > 0;

  function renderMobileAction() {
    const eligible = mobileViewport.matches
      && state.heroPassed
      && !state.heroActionVisible;
    const suppressed = anyDialogOpen() || state.footerVisible;

    const unavailable = !eligible || suppressed;
    mobileAction.classList.toggle('is-visible', eligible);
    mobileAction.classList.toggle('is-suppressed', suppressed);
    mobileAction.toggleAttribute('inert', unavailable);
    mobileAction.setAttribute('aria-hidden', String(unavailable));
  }

  function elementIsVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0
      && rect.top < innerHeight
      && rect.right > 0
      && rect.left < innerWidth;
  }

  function measureMobileAction() {
    const heroRect = hero.getBoundingClientRect();
    state.heroPassed = heroRect.bottom <= 0;
    state.heroActionVisible = elementIsVisible(heroLeadAction);
    state.footerVisible = elementIsVisible(footer);
    renderMobileAction();
  }

  let measureFrame = 0;
  const scheduleMeasure = () => {
    if (measureFrame) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      measureMobileAction();
    });
  };

  if ('IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      state.heroPassed = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
      renderMobileAction();
    });
    heroObserver.observe(hero);

    const heroActionObserver = new IntersectionObserver(([entry]) => {
      state.heroActionVisible = entry.isIntersecting;
      renderMobileAction();
    }, { threshold: 0.01 });
    heroActionObserver.observe(heroLeadAction);

    if (footer) {
      const footerObserver = new IntersectionObserver(([entry]) => {
        state.footerVisible = entry.isIntersecting;
        renderMobileAction();
      });
      footerObserver.observe(footer);
    }
  } else {
    addEventListener('scroll', scheduleMeasure, { passive: true });
  }

  addEventListener('resize', scheduleMeasure, { passive: true });
  addEventListener('load', scheduleMeasure, { once: true });
  addEventListener('pageshow', scheduleMeasure);
  mobileViewport.addEventListener?.('change', scheduleMeasure);

  // `showModal()` changes the `open` attribute but has no universal "open"
  // event, so observing that attribute keeps this working for all dialogs,
  // including any added later.
  const dialogObserver = new MutationObserver(renderMobileAction);
  dialogObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['open'],
    subtree: true
  });

  measureMobileAction();
}

setupMobileAction();

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
  if (leadDialog.open && !motionPreference.matches) {
    activePanel.animate(
      [
        { opacity: 0, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 250,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)'
      }
    );
  }
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
  lastTrigger = navDialog.contains(trigger) ? menuTrigger : trigger;
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
leadDialog.addEventListener('close', () => {
  const triggerToRestore = lastTrigger;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => triggerToRestore?.focus());
  });
});

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
  leadDialog.scrollTop = 0;
  requestAnimationFrame(() => $('#success-title').focus({ preventScroll: true }));
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
