class Component extends DCLogic {
  renderVals() {
    const defaults = { wfh: true, edu: false, clothing: true, gifts: true, tax: true };
    const on = (this.state && this.state.on) || defaults;
    const data = [
      { id: 'wfh', code: 'D5', name: 'Working from home', note: 'Hours log up to date', status: 'ready', amount: 1260 },
      { id: 'edu', code: 'D4', name: 'Self-education', note: 'Course invoice missing', status: 'receipt', amount: 890 },
      { id: 'clothing', code: 'D3', name: 'Work clothing and laundry', note: 'Receipts attached', status: 'ready', amount: 210 },
      { id: 'gifts', code: 'D8', name: 'Gifts and donations', note: 'Three donation receipts', status: 'ready', amount: 350 },
      { id: 'tax', code: 'D9', name: 'Managing tax affairs', note: 'Confirm which year you paid the fee', status: 'check', amount: 240 }
    ];
    const fmt = (n) => '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    let total = 0;
    let count = 0;
    const rows = data.map((d) => {
      const isOn = !!on[d.id];
      if (isOn) { total += d.amount; count += 1; }
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
        toggle: () => this.setState({ on: { ...on, [d.id]: !isOn } })
      };
    });
    return { rows: rows, total: fmt(total), countText: count + ' of ' + data.length + ' items included' };
  }
}

DC.mount(Component);
