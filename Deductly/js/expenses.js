/**
 * Step 2 of 3: expenses.
 *
 * Add, edit and remove work-related expenses. Each one is checked against the three tests:
 * you paid for it yourself, it relates to earning income, and you have a record.
 *
 * Expenses are saved on every change to localStorage under 'deductly:expenses'. The page
 * also watches the saved tax profile so its summary stays current if it changes in another tab.
 *
 * Every read and write is wrapped in try/catch: browsers can block or empty localStorage
 * (private windows, blocked site data), and the page must keep working when that happens.
 */

class Component extends DCLogic {
  // A fingerprint of the saved profile, used to notice when it changes.
  signature() {
    try {
      return window.localStorage.getItem('deductly:profile') || '';
    } catch (e) {
      return '';
    }
  }

  /**
   * Starts watching for profile changes: other tabs, returning to this tab, and a slow poll as a
   * backstop.
   */
  componentDidMount() {
    this.sig = this.signature();
    this.check = () => {
      const next = this.signature();
      if (next !== this.sig) {
        this.sig = next;
        this.forceUpdate();
      }
    };
    window.addEventListener('storage', this.check);
    window.addEventListener('focus', this.check);
    document.addEventListener('visibilitychange', this.check);
    this.timer = window.setInterval(this.check, 700);
  }

  // Stops watching when the page goes away.
  componentWillUnmount() {
    window.removeEventListener('storage', this.check);
    window.removeEventListener('focus', this.check);
    document.removeEventListener('visibilitychange', this.check);
    window.clearInterval(this.timer);
  }

  // Reads and parses a saved value. Returns null if missing, corrupt or blocked.
  readJSON(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Saves a value as JSON. Returns true on success.
  writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Checks that storage really works, so the page can warn if expenses will not be kept.
  canStore() {
    try {
      window.localStorage.setItem('deductly:probe', '1');
      window.localStorage.removeItem('deductly:probe');
      return true;
    } catch (e) {
      return false;
    }
  }

  // Builds everything the markup in expenses.html displays and the handlers it calls.
  renderVals() {
    // Where the expenses are saved.
    const KEY = 'deductly:expenses';

    // The ATO deduction categories Deductly supports. D6 and D7 are left out for now.
    const cats = [
      { id: 'd1', code: 'D1', name: 'Car expenses' },
      { id: 'd2', code: 'D2', name: 'Work travel' },
      { id: 'd3', code: 'D3', name: 'Clothing and laundry' },
      { id: 'd4', code: 'D4', name: 'Self-education' },
      { id: 'd5', code: 'D5', name: 'Other work-related' },
      { id: 'd8', code: 'D8', name: 'Gifts and donations' },
      { id: 'd9', code: 'D9', name: 'Managing tax affairs' },
    ];
    const catById = {};
    cats.forEach((c) => {
      catById[c.id] = c;
    });

    // A fresh form. "I have a record" starts ticked for new expenses.
    const defaultDraft = {
      cat: 'd5',
      desc: '',
      amount: '',
      date: '',
      pct: '100',
      paid: true,
      record: false,
    };

    // Sample expenses shown the first time, so a new visitor sees a filled-in page.
    const sample = {
      isSample: true,
      nextId: 8,
      draft: defaultDraft,
      items: [
        {
          id: 1,
          cat: 'd5',
          desc: 'Ergonomic office chair',
          amount: '380',
          date: '2025-09-12',
          pct: '100',
          paid: true,
          record: true,
        },
        {
          id: 2,
          cat: 'd4',
          desc: 'Project management short course',
          amount: '890',
          date: '2026-02-03',
          pct: '100',
          paid: true,
          record: false,
        },
        {
          id: 3,
          cat: 'd3',
          desc: 'Safety boots',
          amount: '210',
          date: '2025-11-20',
          pct: '100',
          paid: true,
          record: true,
        },
        {
          id: 4,
          cat: 'd8',
          desc: 'Red Cross donation',
          amount: '350',
          date: '2026-06-10',
          pct: '100',
          paid: true,
          record: true,
        },
        {
          id: 5,
          cat: 'd9',
          desc: 'Tax agent fee',
          amount: '240',
          date: '2025-08-14',
          pct: '100',
          paid: true,
          record: true,
        },
        {
          id: 6,
          cat: 'd5',
          desc: 'Mobile phone plan',
          amount: '960',
          date: '2026-04-01',
          pct: '40',
          paid: true,
          record: true,
        },
        {
          id: 7,
          cat: 'd2',
          desc: 'Conference parking',
          amount: '85',
          date: '2026-03-18',
          pct: '100',
          paid: false,
          record: true,
        },
      ],
    };

    // Empty list, used by "Clear sample expenses".
    const blank = { isSample: false, nextId: 1, draft: defaultDraft, items: [] };

    // The page state: loaded once from storage (or the sample), then kept in component state.
    let s = this.state && this.state.s;
    if (!s) {
      const stored = this.readJSON(KEY);
      if (stored && Array.isArray(stored.items)) {
        s = { ...blank, ...stored, draft: { ...defaultDraft, ...(stored.draft || {}) } };
      } else {
        s = sample;
        this.writeJSON(KEY, sample);
      }
    }

    // Saves the new state and re-renders.
    const commit = (next) => {
      this.writeJSON(KEY, next);
      this.setState({ s: next });
    };

    // Updates the add/edit form and saves it, so a half-typed expense survives a refresh.
    const setDraft = (patch) => commit({ ...s, draft: { ...s.draft, ...patch } });

    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Turns 2025-09-12 into 12 Sep 2025.
    const fmtDate = (d) => {
      const p = String(d || '').split('-');
      if (p.length !== 3) return '';
      return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
    };

    // Formats dollars, showing cents only when there are some.
    const money = (n) => {
      const r = Math.round(n * 100) / 100;
      const whole = Math.floor(r);
      const cents = Math.round((r - whole) * 100);
      const w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return '$' + w + (cents ? '.' + (cents < 10 ? '0' : '') + cents : '');
    };

    // Work-use percentage, kept between 0 and 100.
    const clampPct = (v) => Math.max(0, Math.min(100, parseInt(v, 10) || 0));

    // ---- draft form
    const d = s.draft;

    // If an expense is being edited, the form is filled from it.
    const editingItem = s.items.find((x) => x.id === s.editingId);
    const isEditing = !!editingItem;

    // Style for a category button, highlighted when chosen.
    const chipStyle = (sel) =>
      'flex:1 1 170px;min-width:0;box-sizing:border-box;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;cursor:pointer;padding:12px 14px;border-radius:12px;font-family:inherit;color:#11231C;background:' +
      (sel ? '#E3EFE8' : '#FFFFFF') +
      ';border:2px solid ' +
      (sel ? '#185034' : '#C5D0C8');
    const catOpts = cats.map((c) => ({
      code: c.code,
      name: c.name,
      pressed: d.cat === c.id,
      style: chipStyle(d.cat === c.id),
      pick: () => setDraft({ cat: c.id }),
    }));

    // Style for the two yes/no toggles.
    const toggleStyle = (on) =>
      'flex:1 1 280px;min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:14px;text-align:left;cursor:pointer;padding:14px 16px;border-radius:12px;font-family:inherit;color:#11231C;background:' +
      (on ? '#E3EFE8' : '#FFFFFF') +
      ';border:2px solid ' +
      (on ? '#185034' : '#C5D0C8');
    const boxStyle = (on) =>
      'flex:none;width:24px;height:24px;box-sizing:border-box;border-radius:7px;display:flex;align-items:center;justify-content:center;background:' +
      (on ? '#185034' : '#FFFFFF') +
      ';border:2px solid ' +
      (on ? '#185034' : '#B7C3BB');

    // The two tests the user answers: did they pay, and do they have a record.
    const toggles = [
      {
        label: 'I paid for it myself',
        hint: 'Nobody, including my employer, paid me back.',
        pressed: d.paid,
        style: toggleStyle(d.paid),
        boxStyle: boxStyle(d.paid),
        toggle: () => setDraft({ paid: !d.paid }),
      },
      {
        label: 'I have a record',
        hint: 'A receipt, invoice or logbook entry.',
        pressed: d.record,
        style: toggleStyle(d.record),
        boxStyle: boxStyle(d.record),
        toggle: () => setDraft({ record: !d.record }),
      },
    ];

    const amountNum = parseFloat(d.amount) || 0;
    const pctNum = d.pct === '' ? NaN : parseInt(d.pct, 10);
    const dateOk = !!d.date && d.date >= '2025-07-01' && d.date <= '2026-06-30';
    const dateError = !!d.date && !dateOk;

    /**
     * The Add button only works with a description, an amount, a date inside the 2025-26 year and
     * a valid work-use percentage.
     */
    const canAdd =
      d.desc.trim().length > 0 &&
      amountNum > 0 &&
      dateOk &&
      !isNaN(pctNum) &&
      pctNum >= 0 &&
      pctNum <= 100;

    // One-line preview of what this expense does to the plan.
    let previewText = isEditing
      ? 'Fill in the details to save your changes.'
      : 'Fill in the details to add this expense.';
    if (canAdd) {
      const claim = d.paid ? (amountNum * pctNum) / 100 : 0;
      previewText = d.paid
        ? (isEditing ? 'This expense will count for ' : 'This adds ') +
          money(claim) +
          (isEditing ? '' : ' to your plan') +
          (d.record ? '.' : ', once you have a record.')
        : 'This expense was paid back to you, so it adds nothing to your plan.';
    }
    const addStyle =
      'border:0;border-radius:12px;padding:14px 26px;font-family:inherit;font-weight:600;font-size:16px;cursor:' +
      (canAdd ? 'pointer' : 'not-allowed') +
      ';background:' +
      (canAdd ? '#185034' : '#DDE5DF') +
      ';color:' +
      (canAdd ? '#FFFFFF' : '#6B7B72');

    // ---- list and totals
    /**
     * Totals: ready to claim (has a record), waiting on a record, and not claimable (paid back to
     * you).
     */
    let ready = 0;
    let pending = 0;
    let blockedCount = 0;
    let blockedSum = 0;
    const byCatSum = {};

    // Newest first.
    const sorted = [...s.items].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id,
    );

    // One entry per expense, with its status badges and the edit/remove/record handlers.
    const rows = sorted.map((it) => {
      const amt = parseFloat(it.amount) || 0;
      const pct = clampPct(it.pct);
      const claim = it.paid ? (amt * pct) / 100 : 0;
      const isReady = it.paid && it.record;
      const isRecord = it.paid && !it.record;
      const isBlocked = !it.paid;
      if (isReady) ready += claim;
      if (isRecord) pending += claim;
      if (isBlocked) {
        blockedCount += 1;
        blockedSum += amt;
      }
      if (it.paid) byCatSum[it.cat] = (byCatSum[it.cat] || 0) + claim;
      const c = catById[it.cat] || { code: '', name: '' };
      let meta = fmtDate(it.date) + ' · ' + c.name;
      if (it.paid && pct < 100) meta += ' · ' + pct + '% work use, ' + money(claim) + ' claimable';
      return {
        code: c.code,
        desc: it.desc,
        meta: meta,
        amountText: money(amt),
        isReady: isReady,
        isRecord: isRecord,
        isBlocked: isBlocked,
        hasRecord: !!it.record,
        noRecord: !it.record,
        toggleRecord: () =>
          commit({
            ...s,
            isSample: false,
            items: s.items.map((x) => (x.id === it.id ? { ...x, record: !x.record } : x)),
          }),
        isEditing: s.editingId === it.id,
        edit: () => {
          commit({
            ...s,
            editingId: it.id,
            draft: {
              cat: it.cat,
              desc: it.desc,
              amount: String(it.amount),
              date: it.date,
              pct: String(it.pct),
              paid: !!it.paid,
              record: !!it.record,
            },
          });
          window.setTimeout(() => {
            try {
              document
                .getElementById('exp-form')
                .scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (e) {}
          }, 60);
        },
        remove: () =>
          commit({
            ...s,
            isSample: false,
            editingId: s.editingId === it.id ? null : s.editingId,
            draft: s.editingId === it.id ? { ...defaultDraft } : s.draft,
            items: s.items.filter((x) => x.id !== it.id),
          }),
      };
    });

    // Ready-plus-pending claimable amounts per category for the summary.
    const byCat = cats
      .filter((c) => (byCatSum[c.id] || 0) > 0)
      .map((c) => ({ code: c.code, name: c.name, amount: money(byCatSum[c.id]) }));

    // ---- profile snapshot saved by the previous page
    // A snapshot of the profile saved on the previous page.
    const prof = this.readJSON('deductly:profile');
    const sitLabels = {
      employee: 'Employee',
      sole: 'Sole trader',
      both: 'Employee and sole trader',
    };
    const resLabels = {
      resident: 'Resident all year',
      part: 'Resident part of the year',
      foreign: 'Foreign resident',
    };
    const hasProfile = !!(prof && prof.situation);

    const noItems = s.items.length === 0;
    const reviewStyle =
      'border:0;border-radius:12px;padding:16px 28px;font-family:inherit;font-weight:600;font-size:17px;cursor:' +
      (noItems ? 'not-allowed' : 'pointer') +
      ';background:' +
      (noItems ? '#DDE5DF' : '#185034') +
      ';color:' +
      (noItems ? '#6B7B72' : '#FFFFFF');

    // Values and handlers used by expenses.html.
    return {
      showSample: !!s.isSample,
      clearAll: () => commit(blank),
      storageOk: this.canStore(),
      storageBlocked: !this.canStore(),
      catOpts: catOpts,
      toggles: toggles,
      draftDesc: d.desc,
      draftAmount: d.amount,
      draftDate: d.date,
      draftPct: d.pct,
      onDesc: (e) => setDraft({ desc: String(e.target.value).slice(0, 80) }),
      onAmount: (e) => {
        let v = String(e.target.value).replace(/[^0-9.]/g, '');
        const i = v.indexOf('.');
        if (i >= 0)
          v =
            v.slice(0, i + 1) +
            v
              .slice(i + 1)
              .replace(/\./g, '')
              .slice(0, 2);
        setDraft({ amount: v });
      },
      onDate: (e) => setDraft({ date: String(e.target.value) }),
      onPct: (e) => {
        let v = String(e.target.value).replace(/[^0-9]/g, '');
        if (v !== '' && parseInt(v, 10) > 100) v = '100';
        setDraft({ pct: v });
      },
      dateError: dateError,
      previewText: previewText,
      cannotAdd: !canAdd,
      addStyle: addStyle,
      isEditing: isEditing,
      formEyebrow: isEditing ? 'Editing' : 'New expense',
      formTitle: isEditing ? 'Edit expense' : 'Add an expense',
      actionLabel: isEditing ? 'Save changes' : 'Add expense',
      cancelEdit: () => commit({ ...s, editingId: null, draft: { ...defaultDraft, cat: d.cat } }),
      add: () => {
        if (!canAdd) return;
        if (isEditing) {
          const updated = {
            ...editingItem,
            cat: d.cat,
            desc: d.desc.trim(),
            amount: d.amount,
            date: d.date,
            pct: d.pct,
            paid: d.paid,
            record: d.record,
          };
          commit({
            ...s,
            isSample: false,
            editingId: null,
            items: s.items.map((x) => (x.id === editingItem.id ? updated : x)),
            draft: { ...defaultDraft, cat: d.cat },
          });
          return;
        }
        const item = {
          id: s.nextId,
          cat: d.cat,
          desc: d.desc.trim(),
          amount: d.amount,
          date: d.date,
          pct: d.pct,
          paid: d.paid,
          record: d.record,
        };
        commit({
          ...s,
          isSample: false,
          nextId: s.nextId + 1,
          items: [...s.items, item],
          draft: { ...defaultDraft, cat: d.cat },
        });
      },
      rows: rows,
      noItems: noItems,
      hasItems: !noItems,
      countText: s.items.length + (s.items.length === 1 ? ' expense' : ' expenses'),
      reviewStyle: reviewStyle,
      readyTotal: money(ready),
      pendingTotal: money(pending),
      blockedText:
        blockedCount === 0
          ? 'None'
          : blockedCount + (blockedCount === 1 ? ' expense, ' : ' expenses, ') + money(blockedSum),
      byCat: byCat,
      noCats: byCat.length === 0,
      hasProfile: hasProfile,
      noProfile: !hasProfile,
      profSituation: hasProfile ? sitLabels[prof.situation] || '' : '',
      profResidency: hasProfile ? resLabels[prof.residency] || 'Not answered' : '',
    };
  }
}

DC.mount(Component);
