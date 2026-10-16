/**
 * Step 3 of 3: review.
 *
 * Reads the saved tax profile and expenses (it never writes to them), then shows:
 *   - what is ready to claim and what still needs a record,
 *   - a checklist of anything left to sort out,
 *   - the amounts to enter at each deduction label,
 *   - an estimated tax saving and an estimated refund or amount to pay,
 *   - key lodgement dates.
 *
 * If nothing is saved yet it shows sample answers. The page re-renders when either saved value
 * changes, so going back to edit income or expenses is reflected here.
 *
 * ESTIMATES ONLY. Figures follow the 2025-26 resident tax rates. They leave out other offsets
 * and reportable income, so the ATO's assessment will differ.
 *
 * Every read and write is wrapped in try/catch: browsers can block or empty localStorage
 * (private windows, blocked site data), and the page must keep working when that happens.
 */

class Component extends DCLogic {
  // A fingerprint of both saved values, used to notice when either changes.
  signature() {
    try {
      return (
        (window.localStorage.getItem('deductly:profile') || '') +
        '|' +
        (window.localStorage.getItem('deductly:expenses') || '')
      );
    } catch (e) {
      return '';
    }
  }

  // Starts watching for changes: other tabs, returning to this tab, and a slow poll as a backstop.
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

  // Builds everything the markup in review.html displays. Runs again on every change.
  renderVals() {
    // Turns a saved string into a number. Digits and one decimal point only; anything else is 0.
    const num = (v) => parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0;

    // Formats dollars, showing cents only when there are some.
    const money = (n) => {
      const r = Math.round(n * 100) / 100;
      const whole = Math.floor(r);
      const cents = Math.round((r - whole) * 100);
      const w = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return '$' + w + (cents ? '.' + (cents < 10 ? '0' : '') + cents : '');
    };

    // plural(2, "expense", "expenses") gives "2 expenses".
    const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

    // ---- sample data, used until the real pages have saved anything
    const sampleProfile = {
      isSample: true,
      situation: 'employee',
      residency: 'resident',
      relationship: 'married',
      spouseIncome: '62000',
      children: 2,
      others: 0,
      salary: '92000',
      withheld: '20300',
      business: '',
      interest: '140',
      dividends: '',
      other: '',
      fullDays: '',
      halfDays: '',
      cover: 'all',
      coverDays: '',
      loan: 'no',
    };
    const sampleExpenses = {
      isSample: true,
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

    // Load the saved answers. The sample is used if either is missing.
    const profStored = this.readJSON('deductly:profile');
    const expStored = this.readJSON('deductly:expenses');
    const hasExp = !!(expStored && Array.isArray(expStored.items));
    const p = profStored || sampleProfile;
    const ex = hasExp ? expStored : sampleExpenses;

    // Show the "sample answers" banner unless both pages hold the user's own data.
    const usingSample = !profStored || !!p.isSample || !hasExp || !!ex.isSample;

    // ---- expenses
    // Deduction categories, in the order shown.
    const cats = [
      { id: 'd1', code: 'D1', name: 'Car expenses' },
      { id: 'd2', code: 'D2', name: 'Work travel' },
      { id: 'd3', code: 'D3', name: 'Clothing and laundry' },
      { id: 'd4', code: 'D4', name: 'Self-education' },
      { id: 'd5', code: 'D5', name: 'Other work-related' },
      { id: 'd8', code: 'D8', name: 'Gifts and donations' },
      { id: 'd9', code: 'D9', name: 'Managing tax affairs' },
    ];

    /**
     * Totals. An expense is ready to claim only if you paid for it AND have a record; without a
     * record it waits.
     */
    let ready = 0,
      pending = 0;
    let pendingCount = 0,
      blockedCount = 0,
      blockedSum = 0,
      mixedCount = 0,
      counted = 0;
    const readyBy = {},
      pendingBy = {},
      countBy = {};
    ex.items.forEach((it) => {
      const amt = parseFloat(it.amount) || 0;
      const pct = Math.max(0, Math.min(100, parseInt(it.pct, 10) || 0));
      const claim = it.paid ? (amt * pct) / 100 : 0;
      if (!it.paid) {
        blockedCount += 1;
        blockedSum += amt;
        return;
      }
      counted += 1;
      countBy[it.cat] = (countBy[it.cat] || 0) + 1;
      if (pct < 100) mixedCount += 1;
      if (it.record) {
        ready += claim;
        readyBy[it.cat] = (readyBy[it.cat] || 0) + claim;
      } else {
        pending += claim;
        pendingCount += 1;
        pendingBy[it.cat] = (pendingBy[it.cat] || 0) + claim;
      }
    });

    // One line per category that has expenses, for the "Amounts for lodgement" table.
    const rows = cats
      .filter((c) => (countBy[c.id] || 0) > 0)
      .map((c) => ({
        code: c.code,
        name: c.name,
        count: String(countBy[c.id]),
        ready: money(readyBy[c.id] || 0),
        pending: (pendingBy[c.id] || 0) > 0 ? money(pendingBy[c.id]) : '—',
      }));

    // ---- profile
    // Display names for the profile.
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
    const relLabels = {
      single: 'Single',
      married: 'Married or de facto',
      separated: 'Separated',
      widowed: 'Widowed',
    };
    const coverLabels = { all: 'All year', none: 'None' };

    // Business income only counts for sole traders.
    const showBusiness = p.situation === 'sole' || p.situation === 'both';

    // Total income: wages, interest, dividends, other and (for sole traders) business income.
    const income =
      num(p.salary) +
      num(p.interest) +
      num(p.dividends) +
      num(p.other) +
      (showBusiness ? num(p.business) : 0);

    let relText = relLabels[p.relationship] || 'Not answered';
    if (p.relationship === 'married' && num(p.spouseIncome) > 0)
      relText += ', spouse ' + money(num(p.spouseIncome));
    const children = parseInt(p.children, 10) || 0;
    const others = parseInt(p.others, 10) || 0;
    const exemptDays = num(p.fullDays) + num(p.halfDays);
    let coverText = coverLabels[p.cover] || 'Not answered';
    if (p.cover === 'part') coverText = num(p.coverDays) + ' days';

    // The "Your details" list.
    const profileRows = [
      { label: 'Income source', value: sitLabels[p.situation] || 'Not answered' },
      { label: 'Residency', value: resLabels[p.residency] || 'Not answered' },
      { label: 'Relationship', value: relText },
      {
        label: 'Dependants',
        value: plural(children, 'child', 'children') + ', ' + others + ' other',
      },
      {
        label: 'Medicare levy exemption',
        value:
          exemptDays === 0
            ? 'None'
            : num(p.fullDays) + ' full days, ' + num(p.halfDays) + ' half days',
      },
      { label: 'Private hospital cover', value: coverText },
      {
        label: 'Study or training loan',
        value: p.loan === 'yes' ? 'Yes' : p.loan === 'no' ? 'No' : 'Not answered',
      },
      { label: 'Estimated income', value: money(income) },
      { label: 'Tax withheld', value: money(num(p.withheld)) },
    ];

    // ---- checklist
    /**
     * Build the checklist: anything unanswered, missing records, reimbursed expenses and part-
     * work-use claims.
     */
    const missing = [];
    if (!p.situation) missing.push('income source');
    if (!p.residency) missing.push('residency');
    if (!p.relationship) missing.push('relationship status');
    const checks = [];
    if (missing.length > 0) {
      checks.push({
        kind: 'action',
        title: 'Finish your tax profile',
        detail: 'Still to answer: ' + missing.join(', ') + '.',
        link: 'Edit tax profile',
        href: 'profile.html',
      });
    }
    if (ex.items.length === 0) {
      checks.push({
        kind: 'action',
        title: 'Add your expenses',
        detail: 'Nothing is in your plan yet.',
        link: 'Go to expenses',
        href: 'expenses.html',
      });
    }
    if (pendingCount > 0) {
      checks.push({
        kind: 'action',
        title: plural(pendingCount, 'expense needs', 'expenses need') + ' a record',
        detail:
          money(pending) +
          ' becomes claimable once you have the receipt, invoice or logbook entry. You need a record to claim it.',
        link: 'Go to expenses',
        href: 'expenses.html',
      });
    }
    if (blockedCount > 0) {
      checks.push({
        kind: 'note',
        title: plural(blockedCount, 'expense was', 'expenses were') + ' paid back to you',
        detail:
          money(blockedSum) +
          " is left out, because you can only claim what you paid and weren't reimbursed for.",
      });
    }
    if (mixedCount > 0) {
      checks.push({
        kind: 'note',
        title: plural(mixedCount, 'expense is', 'expenses are') + ' claimed at part work use',
        detail: 'Keep a note of how you worked out the work share of each one.',
      });
    }
    if (checks.length === 0) {
      checks.push({
        kind: 'ok',
        title: 'Everything is ready',
        detail: 'Your profile is complete and every claim has a record.',
      });
    }
    const checkRows = checks.map((c) => ({
      title: c.title,
      detail: c.detail,
      isAction: c.kind === 'action',
      isNote: c.kind === 'note',
      isOk: c.kind === 'ok',
      hasLink: !!c.link,
      link: c.link || '',
      href: c.href || '#top',
    }));

    // ---- estimate (resident for the whole year only)
    /**
     * Resident income tax for 2025-26, before the Medicare levy.
     * Brackets: nil to $18,200; 16% to $45,000; 30% to $135,000; 37% to $190,000; 45% above.
     */
    const tax = (ti) => {
      let t = 0;
      if (ti > 18200) t += (Math.min(ti, 45000) - 18200) * 0.16;
      if (ti > 45000) t += (Math.min(ti, 135000) - 45000) * 0.3;
      if (ti > 135000) t += (Math.min(ti, 190000) - 135000) * 0.37;
      if (ti > 190000) t += (ti - 190000) * 0.45;
      return t;
    };
    // Medicare levy (2%) with the low-income reduction and exemption days, plus the surcharge tiers
    // Medicare levy and surcharge depend on family circumstances.
    const married = p.relationship === 'married';
    const spouseIncome = married ? num(p.spouseIncome) : 0;
    const isFamily = married || children > 0;

    // Share of the year the levy applies after full and half exemption days.
    const exemptFactor = Math.max(0, (365 - num(p.fullDays) - num(p.halfDays) / 2) / 365);

    // Days without private hospital cover, which is what the surcharge is charged on.
    const noCoverDays =
      p.cover === 'none' ? 365 : p.cover === 'part' ? Math.max(0, 365 - num(p.coverDays)) : 0;

    /**
     * Medicare levy (2%) and Medicare levy surcharge for a taxable income.
     * The levy is reduced for low incomes. The family-income reduction is an approximation.
     * The surcharge tiers start at $101,000 (single) or $202,000 (family, plus $1,500 per extra
     * child).
     */
    const medicare = (ti) => {
      let levy = 0.02 * ti;
      if (isFamily) {
        const lower = 47238 + 4338 * children;
        const upper = 59047 + 5423 * children;
        const famInc = ti + spouseIncome;
        if (famInc <= lower) levy = 0;
        else if (famInc < upper) levy = Math.min(levy, 0.1 * (famInc - lower) * (ti / famInc));
      } else if (ti <= 28011) {
        levy = 0;
      } else if (ti < 35013) {
        levy = Math.min(levy, 0.1 * (ti - 28011));
      }
      levy = levy * exemptFactor;
      let mls = 0;
      if (noCoverDays > 0) {
        const extra = 1500 * Math.max(0, children - 1);
        const inc = isFamily ? ti + spouseIncome : ti;
        const t1 = isFamily ? 202000 + extra : 101000;
        const t2 = isFamily ? 236000 + extra : 118000;
        const t3 = isFamily ? 316000 + extra : 158000;
        let rate = 0;
        if (inc > t3) rate = 0.015;
        else if (inc > t2) rate = 0.0125;
        else if (inc > t1) rate = 0.01;
        mls = (rate * ti * noCoverDays) / 365;
      }
      return { levy: levy, mls: mls };
    };
    // Low income tax offset and study loan repayment (2025–26)
    // Low income tax offset: $700, reducing from $37,500 and gone by $66,667.
    const lito = (ti) => {
      if (ti <= 37500) return 700;
      if (ti <= 45000) return 700 - 0.05 * (ti - 37500);
      if (ti <= 66667) return Math.max(0, 325 - 0.015 * (ti - 45000));
      return 0;
    };

    // Study and training loan repayment, using the 2025-26 repayment income thresholds.
    const hasLoan = p.loan === 'yes';
    const help = (ti) => {
      if (!hasLoan || ti <= 67000) return 0;
      if (ti <= 125000) return 0.15 * (ti - 67000);
      if (ti <= 179285) return 8700 + 0.17 * (ti - 125000);
      return 0.1 * ti;
    };

    // Income tax after the low income tax offset (the offset cannot take tax below nil).
    const netTax = (ti) => {
      const t = tax(ti);
      return t - Math.min(lito(ti), t);
    };

    // How much each component falls when `ded` dollars of deductions are taken off income.
    const parts = (ded) => {
      const after = Math.max(0, income - ded);
      const b = medicare(income);
      const a = medicare(after);
      return {
        tax: netTax(income) - netTax(after),
        levy: b.levy - a.levy,
        mls: b.mls - a.mls,
        help: help(income) - help(after),
        mlsBefore: b.mls,
      };
    };

    // The saving estimate needs a resident, some income and at least one ready deduction.
    const estimateOn = p.residency === 'resident' && income > 0 && ready > 0;

    // Saving from deductions that are ready now, and the extra once every record is in.
    const nowParts = parts(ready);
    const allParts = parts(ready + pending);
    const savingNow = nowParts.tax + nowParts.levy + nowParts.mls + nowParts.help;
    const savingAll = allParts.tax + allParts.levy + allParts.mls + allParts.help;
    const more = Math.max(0, savingAll - savingNow);

    // Lines for the "Estimated tax saving" card.
    const breakdown = [
      { label: 'Income tax', amount: money(nowParts.tax) },
      { label: 'Medicare levy', amount: money(nowParts.levy) },
    ];
    if (nowParts.mlsBefore > 0)
      breakdown.push({ label: 'Medicare levy surcharge', amount: money(nowParts.mls) });
    if (hasLoan && help(income) > 0)
      breakdown.push({ label: 'Study loan repayment', amount: money(nowParts.help) });

    // Caveats shown under the saving estimate.
    let footnote =
      'An estimate using the 2025–26 resident income tax rates, the 2% Medicare levy, the Medicare levy surcharge tiers and the low income tax offset. It leaves out other offsets and your exact reportable income. Low-income levy reductions are approximate.';
    if (hasLoan)
      footnote +=
        ' Study loan repayments use the 2025–26 rates and are not capped at your loan balance.';
    if (exemptDays > 0)
      footnote +=
        ' Your Medicare exemption days reduce the levy. The surcharge is worked out before any exemption.';
    if (showBusiness) footnote += ' Business income is counted before business expenses.';

    // Estimated result: tax withheld minus what you owe on taxable income after your ready deductions
    /**
     * Estimated result: tax withheld minus the tax and levies owed on taxable income
     * after your ready deductions. Positive is a refund, negative is an amount to pay.
     */
    const refundOn = p.residency === 'resident' && income > 0;
    const taxableAfter = Math.max(0, income - ready);
    const grossTax = tax(taxableAfter);
    const offset = Math.min(lito(taxableAfter), grossTax);
    const medAfter = medicare(taxableAfter);
    const loanAfter = help(taxableAfter);
    const payable = grossTax - offset + medAfter.levy + medAfter.mls + loanAfter;
    const withheldAmt = num(p.withheld);
    const result = withheldAmt - payable;
    const isRefund = result >= 0;
    const rrow = (label, amount, weight) => ({
      label: label,
      amount: amount,
      style: 'font-weight:' + weight,
    });
    const refundRows = [
      rrow('Taxable income', money(taxableAfter), '600'),
      rrow('Income tax', money(grossTax), '600'),
    ];
    if (offset >= 1) refundRows.push(rrow('Low income tax offset', '−' + money(offset), '600'));
    refundRows.push(rrow('Medicare levy', money(medAfter.levy), '600'));
    if (medAfter.mls >= 1)
      refundRows.push(rrow('Medicare levy surcharge', money(medAfter.mls), '600'));
    if (loanAfter >= 1) refundRows.push(rrow('Study loan repayment', money(loanAfter), '600'));
    refundRows.push(rrow('Total tax and levies', money(payable), '700'));
    refundRows.push(rrow('Tax already withheld', money(withheldAmt), '600'));
    let refundFoot =
      'Only deductions with a record are counted. This is an estimate. The ATO works out your actual result when you lodge.';
    if (showBusiness)
      refundFoot +=
        ' Business income is counted before business expenses, and any PAYG instalments you paid are not included.';
    let refundOffNote = 'Add your income in your tax profile to see an estimated result.';
    if (p.residency === 'part' || p.residency === 'foreign')
      refundOffNote =
        'The estimate covers people who were Australian residents for the whole year. Your residency changes the rates, so Deductly leaves it out.';
    else if (!p.residency)
      refundOffNote =
        'Answer the residency question in your tax profile to see an estimated result.';
    let estimateNote = 'Add your income and some expenses with records to see an estimate.';
    if (p.residency === 'part' || p.residency === 'foreign')
      estimateNote =
        'The estimate covers people who were Australian residents for the whole year. Your residency changes the rates, so Deductly leaves it out.';
    else if (!p.residency)
      estimateNote = 'Answer the residency question in your tax profile to see an estimate.';
    else if (income === 0) estimateNote = 'Add your income in your tax profile to see an estimate.';
    else if (ready === 0)
      estimateNote = 'Add an expense with a record and the estimate appears here.';

    // ---- dates
    const now = new Date();
    const days = Math.round(
      (Date.UTC(2026, 9, 31) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
        86400000,
    );

    // Days until the self-lodge date, 31 October 2026.
    let dueText = 'The self-lodge date has passed';
    if (days > 1) dueText = days + ' days left to lodge yourself';
    else if (days === 1) dueText = '1 day left to lodge yourself';
    else if (days === 0) dueText = 'Today is the last day to lodge yourself';

    // ---- copy summary
    // The plain-text summary behind the "Copy summary" button.
    const lines = ['Deductly summary, 2025–26 income year', '', 'Ready to claim: ' + money(ready)];
    cats.forEach((c) => {
      if ((countBy[c.id] || 0) > 0)
        lines.push(
          c.code +
            ' ' +
            c.name +
            ': ' +
            money(readyBy[c.id] || 0) +
            ((pendingBy[c.id] || 0) > 0
              ? ' (plus ' + money(pendingBy[c.id]) + ' needing a record)'
              : ''),
        );
    });
    lines.push(
      '',
      'Waiting on a record: ' + money(pending),
      'Estimated income: ' + money(income),
      'Tax withheld: ' + money(num(p.withheld)),
    );
    if (refundOn)
      lines.push(
        'Estimated ' + (isRefund ? 'refund' : 'amount to pay') + ': ' + money(Math.abs(result)),
      );
    const text = lines.join('\n');

    // Copy button feedback state.
    const copied = this.state && this.state.copied;
    const done = (ok) => this.setState({ copied: ok ? 'yes' : 'no' });

    return {
      usingSample: usingSample,
      checks: checkRows,
      rows: rows,
      noRows: rows.length === 0,
      totalCount: String(counted),
      readyTotal: money(ready),
      pendingTotal: pending > 0 ? money(pending) : '—',
      profileRows: profileRows,
      estimateOn: estimateOn,
      estimateOff: !estimateOn,
      estimateNote: estimateNote,
      savingText: money(savingNow),
      incomeText: money(income),
      afterText: money(Math.max(0, income - ready)),
      refundOn: refundOn,
      refundOff: !refundOn,
      refundOffNote: refundOffNote,
      refundRows: refundRows,
      refundFoot: refundFoot,
      resultLabel: isRefund ? 'Estimated refund' : 'Estimated amount to pay',
      resultText: money(Math.abs(result)),
      isRefund: isRefund,
      notRefund: !isRefund,
      breakdown: breakdown,
      footnote: footnote,
      hasMore: more >= 1,
      moreText: money(more),
      dueText: dueText,
      copyOk: copied === 'yes',
      copyFail: copied === 'no',

      // Copies the plain-text summary to the clipboard.
      copy: () => {
        try {
          window.navigator.clipboard.writeText(text).then(
            () => done(true),
            () => done(false),
          );
        } catch (e) {
          done(false);
        }
      },
    };
  }
}

DC.mount(Component);
