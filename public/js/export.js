// ===== EXPORT MODULE =====
// PDF via Canvas (sem lib externa) + CSV nativo
const Export = {
  format: 'pdf',
  selectedMonths: [],
  availableMonths: [],

  async openPanel() {
    this.selectedMonths = [];
    this.format = 'pdf';
    this._syncFormatUI();
    document.getElementById('export-overlay').classList.add('open');

    // Carrega meses disponíveis
    const grid = document.getElementById('export-months-grid');
    grid.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
    try {
      const months = await API.getAvailableMonths();
      this.availableMonths = months;
      this._renderMonthGrid(months);
    } catch (err) {
      grid.innerHTML = '<p class="text-muted text-sm">Erro ao carregar meses.</p>';
    }
  },

  close() {
    document.getElementById('export-overlay').classList.remove('open');
  },

  _renderMonthGrid(months) {
    const grid = document.getElementById('export-months-grid');
    if (!months.length) {
      grid.innerHTML = '<p class="text-muted text-sm" style="grid-column:1/-1;padding:16px 0">Nenhum dado encontrado.</p>';
      return;
    }
    grid.innerHTML = months.map(m => {
      const label = new Date(m._id.year, m._id.month - 1, 1)
        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      const key = `${m._id.year}-${m._id.month}`;
      return `<div class="month-chip" id="chip-${key}" onclick="Export.toggleMonth('${key}', ${m._id.year}, ${m._id.month})">
        ${label}
        <span class="month-chip-count">${m.count} transações</span>
      </div>`;
    }).join('');
  },

  toggleMonth(key, year, month) {
    const idx = this.selectedMonths.findIndex(m => m.key === key);
    const chip = document.getElementById(`chip-${key}`);
    if (idx >= 0) {
      this.selectedMonths.splice(idx, 1);
      chip?.classList.remove('selected');
    } else {
      this.selectedMonths.push({ key, year: +year, month: +month });
      chip?.classList.add('selected');
    }
  },

  setFormat(fmt) {
    this.format = fmt;
    this._syncFormatUI();
  },

  _syncFormatUI() {
    document.getElementById('fmt-pdf')?.classList.toggle('selected', this.format === 'pdf');
    document.getElementById('fmt-csv')?.classList.toggle('selected', this.format === 'csv');
    const info = document.getElementById('export-info');
    if (info) info.innerHTML = this.format === 'pdf'
      ? 'ℹ️ O PDF inclui logotipo, totais e tabela detalhada com categorias e datas.'
      : 'ℹ️ O CSV pode ser aberto no Excel ou Google Sheets para análise personalizada.';
  },

  async generate() {
    if (!this.selectedMonths.length) {
      Utils.toast('Selecione ao menos um mês.', 'error'); return;
    }
    const btn = document.getElementById('btn-do-export');
    btn.disabled = true; btn.textContent = 'Gerando...';

    try {
      // Busca transações de todos os meses selecionados
      const allTx = [];
      for (const { year, month } of this.selectedMonths) {
        const txs = await API.exportTransactions({ year, month });
        allTx.push(...txs);
      }
      // Ordena por data
      allTx.sort((a, b) => new Date(a.date) - new Date(b.date));

      const cats = Store.get('categories');

      if (this.format === 'csv') {
        this._generateCSV(allTx, cats);
      } else {
        await this._generatePDF(allTx, cats);
      }
      Utils.toast('Relatório gerado com sucesso!', 'success');
      this.close();
    } catch (err) {
      Utils.toast('Erro ao gerar relatório: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '⬇️ Gerar e baixar';
    }
  },

  // ─── CSV ───
  _generateCSV(txs, cats) {
    const header = ['Data','Descrição','Tipo','Categoria','Valor (R$)','Observação'];
    const rows   = txs.map(t => {
      const cat  = cats.find(c => c._id === t.categoryId);
      const type = t.type === 'income' ? 'Receita' : 'Despesa';
      const date = new Date(t.date).toLocaleDateString('pt-BR');
      const val  = (t.type === 'expense' ? -t.amount : t.amount).toFixed(2).replace('.', ',');
      return [date, `"${t.description}"`, type, cat ? cat.name : '—', val, `"${t.note || ''}"`].join(';');
    });

    const totIncome  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totExpense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    rows.push('');
    rows.push(`;;;"Total Receitas";"${totIncome.toFixed(2).replace('.', ',')}";`);
    rows.push(`;;;"Total Despesas";"${totExpense.toFixed(2).replace('.', ',')}";`);
    rows.push(`;;;"Saldo";"${(totIncome-totExpense).toFixed(2).replace('.', ',')}";`);

    const csv  = '\uFEFF' + [header.join(';'), ...rows].join('\n'); // BOM para Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    this._download(blob, `fintrack-relatorio-${Date.now()}.csv`);
  },

  // ─── PDF (Canvas nativo, sem libs) ───
  async _generatePDF(txs, cats) {
    // Usa a Print API do browser via iframe oculto
    const user  = Store.get('user');
    const label = this.selectedMonths.map(({ year, month }) =>
      new Date(year, month-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    ).join(', ');

    const totIncome  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totExpense = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const balance    = totIncome - totExpense;
    const isLight    = document.documentElement.classList.contains('light');

    const rows = txs.map(t => {
      const cat  = cats.find(c => c._id === t.categoryId);
      const date = new Date(t.date).toLocaleDateString('pt-BR');
      const cls  = t.type === 'income' ? 'income' : 'expense';
      const sign = t.type === 'income' ? '+' : '-';
      return `<tr>
        <td>${date}</td>
        <td>${this._esc(t.description)}${t.note ? `<br><small>${this._esc(t.note)}</small>` : ''}</td>
        <td><span class="badge badge-${cls}">${t.type==='income'?'Receita':'Despesa'}</span></td>
        <td>${cat ? cat.icon + ' ' + cat.name : '—'}</td>
        <td class="amount ${cls}">${sign} ${Utils.formatCurrency(t.amount)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Fintrack — Relatório</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, sans-serif; background: #fff; color: #111827; font-size: 13px; padding: 40px; }

  /* HEADER */
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
  .logo-area { display: flex; align-items: center; gap: 12px; }
  .logo-box {
    width: 48px; height: 48px;
    background: linear-gradient(135deg, #3b82f6, #a78bfa);
    border-radius: 12px; display: flex; align-items: center; justify-content: center;
    font-size: 24px; color: #fff;
  }
  .logo-name { font-size: 1.5rem; font-weight: 800; color: #111827; letter-spacing: -0.03em; }
  .logo-sub  { font-size: 0.75rem; color: #6b7280; margin-top: 2px; }
  .report-meta { text-align: right; }
  .report-meta-title { font-size: 0.9rem; font-weight: 700; color: #374151; }
  .report-meta-user  { font-size: 0.78rem; color: #9ca3af; margin-top: 3px; }
  .report-meta-date  { font-size: 0.72rem; color: #d1d5db; margin-top: 2px; }

  /* PERIOD */
  .period-banner {
    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
    border-radius: 12px; padding: 16px 22px; margin-bottom: 24px; color: #fff;
  }
  .period-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.6; margin-bottom: 4px; }
  .period-value { font-size: 1rem; font-weight: 700; }

  /* SUMMARY */
  .summary { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 28px; }
  .sum-card { border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .sum-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #9ca3af; margin-bottom: 6px; }
  .sum-value { font-family: 'JetBrains Mono', monospace; font-size: 1.3rem; font-weight: 700; }
  .sum-value.green { color: #16a34a; }
  .sum-value.red   { color: #dc2626; }
  .sum-value.blue  { color: #2563eb; }

  /* TABLE */
  .section-title { font-size: 0.85rem; font-weight: 700; color: #374151; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f9fafb; padding: 9px 12px; text-align: left; font-size: 0.7rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1.5px solid #e5e7eb; }
  tbody tr { border-bottom: 1px solid #f3f4f6; }
  tbody tr:last-child { border-bottom: none; }
  td { padding: 9px 12px; vertical-align: middle; font-size: 0.8rem; }
  td small { color: #9ca3af; font-size: 0.72rem; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 0.68rem; font-weight: 700; }
  .badge-income  { background: #dcfce7; color: #16a34a; }
  .badge-expense { background: #fee2e2; color: #dc2626; }
  .amount { font-family: 'JetBrains Mono', monospace; font-weight: 700; white-space: nowrap; }
  .amount.income  { color: #16a34a; }
  .amount.expense { color: #dc2626; }

  /* FOOTER */
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 0.72rem; color: #d1d5db; font-weight: 600; }
  .footer-page  { font-size: 0.72rem; color: #d1d5db; }

  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="logo-area">
    <div class="logo-box">💸</div>
    <div>
      <div class="logo-name">Fintrack</div>
      <div class="logo-sub">Gestão Financeira Pessoal</div>
    </div>
  </div>
  <div class="report-meta">
    <div class="report-meta-title">Relatório de Transações</div>
    <div class="report-meta-user">${this._esc(user?.name || '')} · ${this._esc(user?.email || '')}</div>
    <div class="report-meta-date">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  </div>
</div>

<div class="period-banner">
  <div class="period-label">Período</div>
  <div class="period-value">${label}</div>
</div>

<div class="summary">
  <div class="sum-card">
    <div class="sum-label">Total Receitas</div>
    <div class="sum-value green">${Utils.formatCurrency(totIncome)}</div>
  </div>
  <div class="sum-card">
    <div class="sum-label">Total Despesas</div>
    <div class="sum-value red">${Utils.formatCurrency(totExpense)}</div>
  </div>
  <div class="sum-card">
    <div class="sum-label">Saldo do Período</div>
    <div class="sum-value ${balance >= 0 ? 'green' : 'red'}">${Utils.formatCurrency(balance)}</div>
  </div>
</div>

<div class="section-title">${txs.length} Transações</div>
<table>
  <thead>
    <tr>
      <th>Data</th>
      <th>Descrição</th>
      <th>Tipo</th>
      <th>Categoria</th>
      <th>Valor</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div class="footer">
  <div class="footer-brand">💸 Fintrack — fintrack.vercel.app</div>
  <div class="footer-page">Total: ${txs.length} transações · ${Utils.formatCurrency(totIncome)} receitas · ${Utils.formatCurrency(totExpense)} despesas</div>
</div>

<script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };<\/script>
</body></html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
  },

  _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  _download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
