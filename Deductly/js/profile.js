/**
 * Step 1 of 3: tax profile.
 *
 * Collects the answers the estimate depends on: income, residency, relationship, dependants,
 * Medicare exemption days, hospital cover and study loan.
 *
 * Every change is saved straight away to localStorage under 'deductly:profile', so answers
 * survive navigating away or closing the tab. The review page reads the same key.
 *
 * Every read and write is wrapped in try/catch: browsers can block or empty localStorage
 * (private windows, blocked site data), and the page must keep working when that happens.
 */

class Component extends DCLogic {
  // Reads the saved profile. Returns null if nothing is saved or storage is blocked.
  readStore() {
    try {
      const raw = window.localStorage.getItem('deductly:profile');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Saves the profile. Returns true on success, false if storage is blocked.
  writeStore(value) {
    try {
      window.localStorage.setItem('deductly:profile', JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Checks that storage really works, so the page can warn if answers will not be kept.
  canStore() {
    try {
      window.localStorage.setItem('deductly:probe', '1');
      window.localStorage.removeItem('deductly:probe');
      return true;
    } catch (e) {
      return false;
    }
  }

  // Builds everything the markup in profile.html displays and the handlers it calls.
  renderVals() {
    // Sample answers shown the first time, so a new visitor sees a filled-in page.
    const sample = {
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

    // Empty answers, used by "Clear sample answers".
    const blank = {
      isSample: false,
      situation: '',
      residency: '',
      relationship: '',
      spouseIncome: '',
      children: 0,
      others: 0,
      salary: '',
      withheld: '',
      business: '',
      interest: '',
      dividends: '',
      other: '',
      fullDays: '',
      halfDays: '',
      cover: '',
      coverDays: '',
      loan: '',
    };

    // The form state: this render's answers, loaded once from storage (or the sample).
    let f = this.state && this.state.f;
    if (!f) {
      const stored = this.readStore();
      if (stored) {
        f = { ...blank, ...stored };
      } else {
        f = sample;
        this.writeStore(sample);
      }
    }

    // Turns an input string into a number. Digits and one decimal point only; anything else is 0.
    const num = (v) => parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10) || 0;

    // Formats dollars, showing cents only when there are some: $92,000 or $92,000.50.
    const fmt = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

    // Saves the new answers and re-renders.
    const commit = (next) => {
      this.writeStore(next);
      this.setState({ f: next });
    };

    // Saves a partial change. Any edit marks the answers as the user's own, not the sample.
    const put = (patch) => commit({ ...f, ...patch, isSample: false });

    // Input handler for whole numbers (day counts): keeps digits only.
    const digits = (key) => (e) => put({ [key]: String(e.target.value).replace(/[^0-9]/g, '') });

    // Style for a selectable answer card, highlighted when chosen.
    const optStyle = (sel) =>
      'flex:1 1 190px;min-width:0;box-sizing:border-box;display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;cursor:pointer;padding:14px 16px;border-radius:12px;font-family:inherit;color:#11231C;background:' +
      (sel ? '#E3EFE8' : '#FFFFFF') +
      ';border:2px solid ' +
      (sel ? '#185034' : '#C5D0C8');

    // Builds the list of choices for a question, marking the selected one.
    const group = (key, options) =>
      options.map((o) => {
        const sel = f[key] === o.id;
        return {
          label: o.label,
          desc: o.desc || '',
          hasDesc: !!o.desc,
          pressed: sel,
          style: optStyle(sel),
          pick: () => put({ [key]: o.id }),
        };
      });

    const situationOpts = group('situation', [
      { id: 'employee', label: 'Employee', desc: 'You get wages or a salary.' },
      { id: 'sole', label: 'Sole trader', desc: 'You run your own business.' },
      { id: 'both', label: 'Both', desc: 'Wages and your own business.' },
    ]);
    const residencyOpts = group('residency', [
      { id: 'resident', label: 'Resident all year', desc: 'Most people living in Australia.' },
      { id: 'part', label: 'Part of the year', desc: 'You moved to or left Australia.' },
      { id: 'foreign', label: 'Foreign resident', desc: 'Different rates, no tax-free threshold.' },
    ]);
    const relationshipOpts = group('relationship', [
      { id: 'single', label: 'Single' },
      { id: 'married', label: 'Married or de facto' },
      { id: 'separated', label: 'Separated' },
      { id: 'widowed', label: 'Widowed' },
    ]);
    const coverOpts = group('cover', [
      { id: 'all', label: 'All year' },
      { id: 'part', label: 'Part of the year' },
      { id: 'none', label: 'None' },
    ]);
    const loanOpts = group('loan', [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ]);

    // Which optional questions to show depends on earlier answers.
    const showBusiness = f.situation === 'sole' || f.situation === 'both';
    const showSpouse = f.relationship === 'married';
    const showCoverDays = f.cover === 'part';

    // The income inputs. Business income only appears for sole traders.
    const incomeFields = [
      {
        id: 'inc-salary',
        label: 'Salary and wages',
        hint: 'Gross amount, before tax.',
        value: f.salary,
        change: digits('salary'),
      },
      {
        id: 'inc-withheld',
        label: 'Tax withheld',
        hint: 'Listed as tax withheld on your income statement.',
        value: f.withheld,
        change: digits('withheld'),
      },
    ];
    if (showBusiness) {
      incomeFields.push({
        id: 'inc-business',
        label: 'Business income',
        hint: 'Before business expenses.',
        value: f.business,
        change: digits('business'),
      });
    }
    incomeFields.push(
      {
        id: 'inc-interest',
        label: 'Bank interest',
        hint: 'Interest from all accounts.',
        value: f.interest,
        change: digits('interest'),
      },
      {
        id: 'inc-dividends',
        label: 'Dividends',
        hint: 'Including franked amounts.',
        value: f.dividends,
        change: digits('dividends'),
      },
      {
        id: 'inc-other',
        label: 'Other income',
        hint: 'Such as rent or government payments.',
        value: f.other,
        change: digits('other'),
      },
    );

    // Medicare levy exemption days. Full plus half days cannot exceed 365.
    const dayFields = [
      {
        id: 'med-full',
        label: 'Full exemption days',
        hint: 'Days you were eligible for a full exemption.',
        value: f.fullDays,
        change: digits('fullDays'),
      },
      {
        id: 'med-half',
        label: 'Half exemption days',
        hint: 'Days you were eligible for a half exemption.',
        value: f.halfDays,
        change: digits('halfDays'),
      },
    ];
    const exemptionError = num(f.fullDays) + num(f.halfDays) > 365;

    // A +/- control for counts such as dependent children (0 to 9).
    const stepper = (key, label, hint, noun) => ({
      label: label,
      hint: hint,
      noun: noun,
      value: f[key],
      dec: () => put({ [key]: Math.max(0, f[key] - 1) }),
      inc: () => put({ [key]: Math.min(9, f[key] + 1) }),
    });
    const steppers = [
      stepper(
        'children',
        'Dependent children',
        'Children you support, including full-time students.',
        'dependent children',
      ),
      stepper(
        'others',
        'Other dependants',
        'Anyone else you financially support.',
        'other dependants',
      ),
    ];

    // Display names for the summary card.
    const incomeLabels = {
      employee: 'Employee',
      sole: 'Sole trader',
      both: 'Employee and sole trader',
    };
    const residencyLabels = {
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
    const loanLabels = { yes: 'Yes', no: 'No' };

    let coverText = '';
    if (f.cover === 'all') coverText = 'All year';
    if (f.cover === 'part') coverText = num(f.coverDays) + ' days';
    if (f.cover === 'none') coverText = 'None';

    let relText = relLabels[f.relationship] || '';
    if (f.relationship === 'married' && num(f.spouseIncome) > 0)
      relText = relText + ', spouse ' + fmt(num(f.spouseIncome));

    const depText =
      f.children + (f.children === 1 ? ' child' : ' children') + ', ' + f.others + ' other';
    const exText =
      num(f.fullDays) + num(f.halfDays) === 0
        ? 'None'
        : num(f.fullDays) + ' full, ' + num(f.halfDays) + ' half';

    const mk = (label, value) => ({
      label: label,
      value: value,
      answered: !!value,
      unanswered: !value,
    });
    const summary = [
      mk('Income source', incomeLabels[f.situation] || ''),
      mk('Residency', residencyLabels[f.residency] || ''),
      mk('Relationship', relText),
      mk('Dependants', depText),
      mk('Medicare exemption', exText),
      mk('Hospital cover', coverText),
      mk('Study loan', loanLabels[f.loan] || ''),
    ];

    let total = num(f.salary) + num(f.interest) + num(f.dividends) + num(f.other);
    if (showBusiness) total += num(f.business);

    // Progress: the three required answers are income source, residency and relationship.
    const reqDone = (f.situation ? 1 : 0) + (f.residency ? 1 : 0) + (f.relationship ? 1 : 0);
    const notReady = reqDone < 3 || exemptionError;
    const pct = Math.round((reqDone / 3) * 100);
    const barStyle = 'height:6px;border-radius:3px;background:#F2C230;width:' + pct + '%';
    const continueStyle =
      'width:100%;box-sizing:border-box;border:0;border-radius:12px;padding:16px 24px;font-weight:600;font-size:17px;font-family:inherit;cursor:' +
      (notReady ? 'not-allowed' : 'pointer') +
      ';background:' +
      (notReady ? 'rgba(234,241,236,0.16)' : '#F3F5F1') +
      ';color:' +
      (notReady ? '#A9BDB2' : '#11231C');

    // Values and handlers used by profile.html.
    return {
      showSample: !!f.isSample,
      clearAll: () => commit(blank),
      storageOk: this.canStore(),
      storageBlocked: !this.canStore(),
      isReady: !notReady,
      situationOpts: situationOpts,
      residencyOpts: residencyOpts,
      relationshipOpts: relationshipOpts,
      coverOpts: coverOpts,
      loanOpts: loanOpts,
      incomeFields: incomeFields,
      dayFields: dayFields,
      exemptionError: exemptionError,
      steppers: steppers,
      showSpouse: showSpouse,
      spouseIncome: f.spouseIncome,
      onSpouseIncome: digits('spouseIncome'),
      showCoverDays: showCoverDays,
      coverDays: f.coverDays,
      onCoverDays: (e) => {
        const v = String(e.target.value).replace(/[^0-9]/g, '');
        put({ coverDays: v === '' ? '' : String(Math.min(365, parseInt(v, 10))) });
      },
      summary: summary,
      totalIncome: fmt(total),
      withheldText: fmt(num(f.withheld)),
      reqText: reqDone + ' of 3',
      barStyle: barStyle,
      notReady: notReady,
      continueStyle: continueStyle,
    };
  }
}

DC.mount(Component);
