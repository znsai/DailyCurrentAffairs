/** Shared progressive-enhancement date and month pickers. Without JS the
 * native inputs remain usable; Archive's published-day table stays intact. */
(function () {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  function isoDate(year, month, day) {
    return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (year < 1 || month < 1 || month > 12 || day < 1) return null;
    const date = new Date(0);
    date.setUTCHours(12, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }
  function addDays(value, amount) {
    const date = parseDate(value);
    if (!date) return null;
    date.setUTCDate(date.getUTCDate() + amount);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  function addMonths(year, month, amount) {
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1 + amount, 1);
    return [date.getUTCFullYear(), date.getUTCMonth() + 1];
  }
  function kolkataToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const part = (type) => parts.find((item) => item.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function monthCells(year, month) {
    const first = isoDate(year, month, 1);
    const leading = (parseDate(first).getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => addDays(first, index - leading));
  }
  function parseMonth(value) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '') || value.startsWith('0000-')) return null;
    const [year, month] = value.split('-').map(Number);
    return { year, month };
  }
  function isoMonth(year, month) {
    return `${String(year).padStart(4, '0')}-${pad(month)}`;
  }

  let active = null;
  const instances = new WeakMap();
  function bounds(input) {
    return { min: parseDate(input.min) ? input.min : '0001-01-01',
      max: input.dataset.calendarMaxToday === 'true' ? kolkataToday()
        : parseDate(input.max) ? input.max : '9999-12-31' };
  }
  function allowed(input, value) {
    const { min, max } = bounds(input);
    return !!parseDate(value) && value >= min && value <= max;
  }
  function monthBounds(input) {
    return { min: parseMonth(input.min) ? input.min : '0001-01',
      max: input.dataset.calendarMaxToday === 'true' ? kolkataToday().slice(0, 7)
        : parseMonth(input.max) ? input.max : '9999-12' };
  }
  function allowedMonth(input, value) {
    const { min, max } = monthBounds(input);
    return !!parseMonth(value) && value >= min && value <= max;
  }
  function label(value) {
    const date = parseDate(value);
    return new Intl.DateTimeFormat('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(date);
  }
  function positionPopup(instance) {
    const rect = instance.input.getBoundingClientRect();
    const popup = instance.popup;
    const width = Math.min(350, window.innerWidth - 16);
    popup.style.width = `${width}px`;
    popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    popup.style.maxHeight = `${Math.max(180, window.innerHeight - 16)}px`;
    const height = popup.offsetHeight;
    const below = window.innerHeight - rect.bottom;
    const desired = below >= height + 8 || below >= rect.top ? rect.bottom + 6 : rect.top - height - 6;
    popup.style.top = `${Math.max(8, Math.min(desired, window.innerHeight - height - 8))}px`;
  }
  function close(restoreFocus = false) {
    if (!active) return;
    const instance = active;
    active = null;
    instance.popup.remove();
    instance.input.setAttribute('aria-expanded', 'false');
    if (restoreFocus && instance.input.isConnected) instance.input.focus();
  }

  function paintMonth(instance, focusValue) {
    const { input, popup, year } = instance;
    const { min, max } = monthBounds(input);
    popup.replaceChildren();
    const header = document.createElement('div');
    header.className = 'calendar-heading';
    const nav = (text, name, delta) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'calendar-nav'; button.textContent = text;
      button.setAttribute('aria-label', name);
      const targetYear = year + delta;
      button.disabled = targetYear < 1 || targetYear > 9999
        || isoMonth(targetYear, 1) > max || isoMonth(targetYear, 12) < min;
      button.addEventListener('click', () => { instance.year = targetYear; paintMonth(instance, true); });
      return button;
    };
    const title = document.createElement('strong'); title.textContent = String(year);
    header.append(nav('‹', 'Previous year', -1), title, nav('›', 'Next year', 1));
    popup.append(header);
    const grid = document.createElement('div');
    grid.className = 'calendar-month-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', `Choose a month in ${year}`);
    const today = kolkataToday().slice(0, 7);
    const selected = allowedMonth(input, focusValue) && focusValue.startsWith(`${year}-`) ? focusValue
      : allowedMonth(input, input.value) && input.value.startsWith(`${year}-`) ? input.value
        : allowedMonth(input, today) && today.startsWith(`${year}-`) ? today : null;
    let focusButton = null;
    for (let month = 1; month <= 12; month += 1) {
      const value = isoMonth(year, month);
      const name = new Intl.DateTimeFormat('en-IN', { month: 'long', timeZone: 'UTC' })
        .format(parseDate(`${value}-01`));
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'calendar-month';
      button.textContent = name.slice(0, 3); button.dataset.month = value;
      button.setAttribute('aria-label', `${name} ${year}`);
      button.tabIndex = -1;
      button.disabled = !allowedMonth(input, value);
      if (value === today) { button.classList.add('is-today'); button.setAttribute('aria-current', 'date'); }
      if (value === input.value) { button.classList.add('is-selected'); button.setAttribute('aria-pressed', 'true'); }
      if (!button.disabled && (value === selected || (!focusButton && !selected))) focusButton = button;
      button.addEventListener('click', () => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close(true);
      });
      grid.append(button);
    }
    if (focusButton) focusButton.tabIndex = 0;
    popup.append(grid);
    positionPopup(instance);
    if (focusValue === true || typeof focusValue === 'string') focusButton?.focus();
    return focusButton;
  }

  function paint(instance, focusDate) {
    const { input, popup, year, month } = instance;
    const [prevYear, prevMonth] = addMonths(year, month, -1);
    const [nextYear, nextMonth] = addMonths(year, month, 1);
    const min = bounds(input).min, max = bounds(input).max;
    const earliestInMonth = (y, m) => isoDate(y, m, 1);
    const latestInMonth = (y, m) => {
      const [ny, nm] = addMonths(y, m, 1);
      return addDays(isoDate(ny, nm, 1), -1);
    };
    const canShow = (y, m) => earliestInMonth(y, m) <= max && latestInMonth(y, m) >= min;
    const heading = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(parseDate(isoDate(year, month, 1)));
    popup.replaceChildren();
    const header = document.createElement('div');
    header.className = 'calendar-heading';
    const nav = (text, title, delta) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'calendar-nav'; button.textContent = text;
      button.setAttribute('aria-label', title);
      const [targetYear, targetMonth] = addMonths(year, month, delta);
      button.disabled = targetYear < 1 || targetYear > 9999 || !canShow(targetYear, targetMonth);
      button.addEventListener('click', () => {
        [instance.year, instance.month] = [targetYear, targetMonth];
        paint(instance, true);
      });
      return button;
    };
    header.append(nav('«', 'Previous year', -12), nav('‹', 'Previous month', -1));
    const title = document.createElement('strong'); title.textContent = heading;
    header.append(title, nav('›', 'Next month', 1), nav('»', 'Next year', 12));
    popup.append(header);
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', heading);
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((day) => {
      const cell = document.createElement('span'); cell.className = 'calendar-weekday';
      cell.textContent = day; grid.append(cell);
    });
    const today = kolkataToday();
    const rangeName = input.dataset.calendarRange;
    const start = rangeName && document.querySelector(`[data-calendar-range="${rangeName}"][data-calendar-edge="start"]`)?.value;
    const end = rangeName && document.querySelector(`[data-calendar-range="${rangeName}"][data-calendar-edge="end"]`)?.value;
    const inVisibleMonth = (value) => value?.slice(0, 7) === `${String(year).padStart(4, '0')}-${pad(month)}`;
    const preferred = allowed(input, focusDate) && inVisibleMonth(focusDate) ? focusDate
      : allowed(input, input.value) && inVisibleMonth(input.value) ? input.value
        : allowed(input, today) && inVisibleMonth(today) ? today : null;
    let focusButton = null;
    monthCells(year, month).forEach((dateString) => {
      const date = parseDate(dateString);
      if (!date) { grid.append(document.createElement('span')); return; }
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'calendar-day';
      button.textContent = String(date.getUTCDate());
      button.dataset.date = dateString;
      button.setAttribute('aria-label', label(dateString));
      button.tabIndex = -1;
      button.disabled = !allowed(input, dateString);
      if (date.getUTCMonth() + 1 !== month) button.classList.add('is-outside');
      if (dateString === today) { button.classList.add('is-today'); button.setAttribute('aria-current', 'date'); }
      if (dateString === input.value) { button.classList.add('is-selected'); button.setAttribute('aria-pressed', 'true'); }
      if (dateString === start) button.classList.add('is-range-start');
      if (dateString === end) button.classList.add('is-range-end');
      if (start && end && start < dateString && dateString < end) button.classList.add('is-in-range');
      if (!button.disabled && (dateString === preferred || (!focusButton && !preferred))) focusButton = button;
      button.addEventListener('click', () => {
        input.value = dateString;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        close(true);
      });
      grid.append(button);
    });
    if (focusButton) focusButton.tabIndex = 0;
    popup.append(grid);
    positionPopup(instance);
    if (focusDate === true || typeof focusDate === 'string') focusButton?.focus();
    return focusButton;
  }

  function open(instance) {
    if (active === instance) return;
    close();
    active = instance;
    if (instance.kind === 'month') {
      const { min, max } = monthBounds(instance.input);
      const desired = allowedMonth(instance.input, instance.input.value)
        ? instance.input.value : kolkataToday().slice(0, 7);
      const initial = parseMonth(desired < min ? min : desired > max ? max : desired);
      instance.year = initial.year;
    } else {
      const { min, max } = bounds(instance.input);
      const desired = allowed(instance.input, instance.input.value) ? instance.input.value : kolkataToday();
      const initial = parseDate(desired < min ? min : desired > max ? max : desired) || new Date();
      instance.year = initial.getUTCFullYear();
      instance.month = initial.getUTCMonth() + 1;
    }
    document.body.append(instance.popup);
    instance.input.setAttribute('aria-expanded', 'true');
    const target = instance.kind === 'month' ? paintMonth(instance) : paint(instance);
    target?.focus();
  }

  function enhance(root = document) {
    root.querySelectorAll('input[type="date"][data-calendar], input[type="month"][data-month-picker]').forEach((input) => {
      if (instances.has(input)) return;
      const kind = input.type;
      const wrapper = document.createElement('div');
      wrapper.className = 'calendar-field';
      input.before(wrapper);
      wrapper.append(input);
      // ISO values, id, name, min/max and existing form validation contracts
      // are unchanged; only the visual interaction is progressively enhanced.
      input.type = 'text';
      input.readOnly = true;
      input.inputMode = 'none';
      input.placeholder = kind === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
      input.setAttribute('aria-haspopup', 'dialog');
      input.setAttribute('aria-expanded', 'false');
      if (kind === 'month' || input.hasAttribute('data-calendar-optional')) {
        const clear = document.createElement('button');
        clear.type = 'button'; clear.className = 'calendar-clear'; clear.textContent = '×';
        clear.setAttribute('aria-label', `Clear ${input.labels?.[0]?.textContent?.trim() || 'date'}`);
        clear.addEventListener('click', () => {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          close();
          input.focus();
        });
        wrapper.append(clear);
      }
      const trigger = document.createElement('button');
      trigger.type = 'button'; trigger.className = 'calendar-trigger';
      trigger.setAttribute('aria-label', `Open ${kind === 'month' ? 'month picker' : 'calendar'} for ${input.labels?.[0]?.textContent?.trim() || input.id}`);
      trigger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>';
      wrapper.append(trigger);
      const popup = document.createElement('div');
      popup.className = 'calendar-popup';
      popup.setAttribute('role', 'dialog');
      popup.setAttribute('aria-label', `Choose ${input.labels?.[0]?.textContent?.trim() || 'date'}`);
      const instance = { input, wrapper, trigger, popup, kind, year: 0, month: 0 };
      instances.set(input, instance);
      input.addEventListener('click', () => open(instance));
      input.addEventListener('keydown', (event) => {
        if (['Enter', ' ', 'ArrowDown'].includes(event.key)) { event.preventDefault(); open(instance); }
      });
      trigger.addEventListener('click', () => open(instance));
      popup.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
        if (event.key === 'Tab') return; // ordinary tab order remains available
        if (kind === 'month') {
          const monthButton = event.target.closest('.calendar-month');
          if (!monthButton) return;
          const current = parseMonth(monthButton.dataset.month);
          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4,
            PageUp: -12, PageDown: 12 }[event.key];
          const [targetYear, targetMonth] = step === undefined ? [current.year, current.month]
            : addMonths(current.year, current.month, step);
          const next = event.key === 'Home' ? isoMonth(current.year, 1)
            : event.key === 'End' ? isoMonth(current.year, 12)
              : step === undefined ? null : isoMonth(targetYear, targetMonth);
          if (!next) return;
          event.preventDefault();
          if (!allowedMonth(input, next)) return;
          if (parseMonth(next).year !== instance.year) {
            instance.year = parseMonth(next).year;
            paintMonth(instance, next);
          } else {
            popup.querySelector('.calendar-month[tabindex="0"]')?.setAttribute('tabindex', '-1');
            const target = Array.from(popup.querySelectorAll('.calendar-month')).find((cell) => cell.dataset.month === next);
            if (target) { target.tabIndex = 0; target.focus(); }
          }
          return;
        }
        const dateButton = event.target.closest('.calendar-day');
        if (!dateButton) return;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7,
          PageUp: -31, PageDown: 31 }[event.key];
        let next = step === undefined ? null : addDays(dateButton.dataset.date, step);
        if (event.key === 'Home' || event.key === 'End') {
          const weekday = (parseDate(dateButton.dataset.date).getUTCDay() + 6) % 7;
          next = addDays(dateButton.dataset.date, event.key === 'Home' ? -weekday : 6 - weekday);
        }
        if (!next) return;
        event.preventDefault();
        if (!allowed(input, next)) return;
        const parsed = parseDate(next);
        if (parsed.getUTCFullYear() !== instance.year || parsed.getUTCMonth() + 1 !== instance.month) {
          instance.year = parsed.getUTCFullYear(); instance.month = parsed.getUTCMonth() + 1;
          paint(instance, next);
        } else {
          popup.querySelector('.calendar-day[tabindex="0"]')?.setAttribute('tabindex', '-1');
          const target = Array.from(popup.querySelectorAll('.calendar-day')).find((cell) => cell.dataset.date === next);
          if (target) { target.tabIndex = 0; target.focus(); }
        }
      });
    });
  }

  document.addEventListener('pointerdown', (event) => {
    if (active && !active.popup.contains(event.target) && !active.wrapper.contains(event.target)) close();
  });
  document.addEventListener('focusin', (event) => {
    if (active && !active.popup.contains(event.target) && !active.wrapper.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (active && event.key === 'Escape') { event.preventDefault(); close(true); }
  });
  window.addEventListener('resize', () => { if (active) positionPopup(active); });
  window.addEventListener('scroll', () => { if (active) positionPopup(active); }, true);
  window.TCACalendar = { enhance, parseDate, parseMonth, addDays, monthCells, kolkataToday };
})();
