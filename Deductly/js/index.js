/**
 * Home page logic: the planner preview.
 *
 * Visitors can switch sample expenses on and off and watch the running total change.
 * Nothing here is saved or sent anywhere; it only demonstrates how Deductly works.
 */

class Component extends DCLogic {
  // Builds everything the markup in index.html displays.
  renderVals() {
    // Which sample rows start switched on.
    const defaults = { wfh: true, edu: false, clothing: true, gifts: true, tax: true };

    // Current on/off state. Falls back to the defaults before the first click.
    const on = (this.state && this.state.on) || defaults;

    // Sample deductions shown in the preview. status: ready, receipt (missing record) or check.
    const data = [
      {
        id: 'wfh',
        code: 'D5',
        name: 'Working from home',
        note: 'Hours log up to date',
        status: 'ready',
        amount: 1260,
      },
      {
        id: 'edu',
        code: 'D4',
        name: 'Self-education',
        note: 'Course invoice missing',
        status: 'receipt',
        amount: 890,
      },
      {
        id: 'clothing',
        code: 'D3',
        name: 'Work clothing and laundry',
        note: 'Receipts attached',
        status: 'ready',
        amount: 210,
      },
      {
        id: 'gifts',
        code: 'D8',
        name: 'Gifts and donations',
        note: 'Three donation receipts',
        status: 'ready',
        amount: 350,
      },
      {
        id: 'tax',
        code: 'D9',
        name: 'Managing tax affairs',
        note: 'Confirm which year you paid the fee',
        status: 'check',
        amount: 240,
      },
    ];

    // Formats whole dollars with thousands separators, for example 1260 becomes $1,260.
    const fmt = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let total = 0;
    let count = 0;

    // One entry per sample deduction, with the flags the template uses to style it.
    const rows = data.map((d) => {
      const isOn = !!on[d.id];
      if (isOn) {
        total += d.amount;
        count += 1;
      }
      return {
        code: d.code,
        name: d.name,
        note: d.note,
        amount: fmt(d.amount),
        on: isOn,
        off: !isOn,
        pressed: isOn,
        isReady: d.status === 'ready',
        isReceipt: d.status === 'receipt',
        isCheck: d.status === 'check',

        // Flip this row on or off and re-render.
        toggle: () => this.setState({ on: { ...on, [d.id]: !isOn } }),
      };
    });

    // Values available to index.html as {{ rows }}, {{ total }} and {{ countText }}.
    return {
      rows: rows,
      total: fmt(total),
      countText: count + ' of ' + data.length + ' items included',
    };
  }
}

DC.mount(Component);
