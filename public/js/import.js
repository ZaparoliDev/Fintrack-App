const Import = {
  parsedRows: [],

  openPanel() {
    this.parsedRows = [];
    document.getElementById('import-overlay').classList.add('open');
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('import-file').value = '';
    document.getElementById('import-format').value = 'nubank-conta';
    document.getElementById('import-result').classList.add('hidden');
    document.getElementById('import-step-upload').classList.remove('hidden');
  },

  close() {
    document.getElementById('import-overlay').classList.remove('open');
  },

  onFileChange(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => this._parseCSV(e.target.result, document.getElementById('import-format').value);
    reader.readAsText(file, 'UTF-8');
  },

  _splitCSVLine(line) {
    // Parser robusto — lida com campos com vírgula dentro de aspas
    const result = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if ((ch === ',' || ch === ';') && !inQuote) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result.map(c => c.replace(/^"|"$/g, '').trim());
  },

  _parseCSV(text, format) {
    text = text.replace(/^\uFEFF/, ''); // remove BOM
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { Utils.toast('Arquivo vazio ou inválido.', 'error'); return; }

    // Detectar separador automaticamente
    const sep = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].split(sep).map(h => h.trim().replace(/"/g, '').toLowerCase());

    let rows = [];

    if (format === 'nubank-conta') {
      // Formato NuConta: Data,Valor,Identificador,Descrição
      // Data: YYYY-MM-DD | Valor: negativo=despesa, positivo=receita
      rows = lines.slice(1).map(line => {
        const cols = this._splitCSVLine(line);
        if (cols.length < 4) return null;
        const date   = cols[0] || '';    // YYYY-MM-DD — já no formato certo
        const amount = parseFloat((cols[1] || '0').replace(',', '.'));
        const desc   = cols[3] || cols[1] || 'Importado Nubank';
        if (!date || isNaN(amount) || amount === 0) return null;
        return {
          date,
          description: desc,
          type:   amount < 0 ? 'expense' : 'income',
          amount: Math.abs(amount),
          note:   'Importado NuConta'
        };
      }).filter(Boolean);

    } else if (format === 'nubank-cartao') {
      // Formato Nubank Cartão: date,title,amount  (valores sempre positivos, tudo é despesa)
      rows = lines.slice(1).map(line => {
        const cols = this._splitCSVLine(line);
        if (cols.length < 3) return null;
        const date   = cols[0] || '';
        const desc   = cols[1] || 'Importado Nubank';
        const amount = parseFloat((cols[2] || '0').replace(',', '.'));
        if (!date || isNaN(amount) || amount === 0) return null;
        // Nubank cartão: data pode vir como YYYY-MM-DD ou DD/MM/YYYY
        const dateFmt = date.includes('/') ? date.split('/').reverse().join('-') : date;
        return {
          date:        dateFmt,
          description: desc,
          type:        amount < 0 ? 'income' : 'expense', // estornos são negativos
          amount:      Math.abs(amount),
          note:        'Importado Cartão Nubank'
        };
      }).filter(Boolean);

    } else if (format === 'inter') {
      // Inter: Data;Histórico;Tipo Lançamento;Valor
      rows = lines.slice(1).map(line => {
        const cols = this._splitCSVLine(line);
        if (cols.length < 4) return null;
        const rawDate = cols[0] || '';
        const desc    = cols[1] || 'Importado Inter';
        const tipo    = (cols[2] || '').toLowerCase();
        const amount  = parseFloat((cols[3] || '0').replace(',', '.'));
        if (!rawDate || isNaN(amount) || amount === 0) return null;
        const date = rawDate.includes('/') ? rawDate.split('/').reverse().join('-') : rawDate;
        const isIncome = tipo.includes('crédito') || tipo.includes('recebido') || tipo.includes('pix recebido') || tipo.includes('ted recebido');
        return {
          date,
          description: desc,
          type:   isIncome ? 'income' : 'expense',
          amount: Math.abs(amount),
          note:   'Importado Inter'
        };
      }).filter(Boolean);

    } else if (format === 'itau') {
      // Itaú: Data;Histórico;Valor  (positivo=receita, negativo=despesa)
      rows = lines.slice(1).map(line => {
        const cols = this._splitCSVLine(line);
        if (cols.length < 3) return null;
        const rawDate = cols[0] || '';
        const desc    = cols[1] || 'Importado Itaú';
        const amount  = parseFloat((cols[2] || '0').replace('.', '').replace(',', '.'));
        if (!rawDate || isNaN(amount) || amount === 0) return null;
        const date = rawDate.includes('/') ? rawDate.split('/').reverse().join('-') : rawDate;
        return {
          date,
          description: desc,
          type:   amount >= 0 ? 'income' : 'expense',
          amount: Math.abs(amount),
          note:   'Importado Itaú'
        };
      }).filter(Boolean);

    } else if (format === 'fintrack') {
      // Fintrack export: Data;Descrição;Tipo;Categoria;Valor (R$);Observação
      rows = lines.slice(1).map(line => {
        const cols = this._splitCSVLine(line);
        if (cols.length < 5) return null;
        const rawDate = cols[0] || '';
        const desc    = cols[1] || '';
        const tipo    = cols[2] || '';
        const amount  = parseFloat((cols[4] || '0').replace(',', '.'));
        if (!rawDate || isNaN(amount) || amount === 0) return null;
        const date = rawDate.includes('/') ? rawDate.split('/').reverse().join('-') : rawDate;
        return {
          date,
          description: desc,
          type:   tipo === 'Receita' ? 'income' : 'expense',
          amount: Math.abs(amount),
          note:   cols[5] || ''
        };
      }).filter(Boolean);
    }

    if (!rows.length) {
      document.getElementById('import-preview').innerHTML =
        '<p class="text-muted text-sm" style="padding:12px 0">⚠️ Nenhuma linha válida encontrada. Verifique se o formato selecionado corresponde ao arquivo.</p>';
      return;
    }

    this.parsedRows = rows;
    this._renderPreview(rows);
  },

  _renderPreview(rows) {
    const el      = document.getElementById('import-preview');
    const preview = rows.slice(0, 8);
    const totalIncome  = rows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const totalExpense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

    el.innerHTML = `
      <div class="import-preview-info">
        <strong>${rows.length} transações</strong> encontradas —
        <span style="color:var(--green)">+${Utils.formatCurrency(totalIncome)}</span>
        <span style="color:var(--red)"> -${Utils.formatCurrency(totalExpense)}</span>
        <br><small class="text-muted">Prévia das primeiras ${preview.length}:</small>
      </div>
      <div class="import-table-wrap">
        <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
          <thead><tr>
            <th style="padding:6px 10px;text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">Data</th>
            <th style="padding:6px 10px;text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">Descrição</th>
            <th style="padding:6px 10px;text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">Tipo</th>
            <th style="padding:6px 10px;text-align:right;color:var(--text-muted);border-bottom:1px solid var(--border)">Valor</th>
          </tr></thead>
          <tbody>
            ${preview.map(r => `<tr>
              <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft)">${r.date}</td>
              <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.description}</td>
              <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft)">
                <span class="badge-type badge-${r.type}">${r.type === 'income' ? 'Receita' : 'Despesa'}</span>
              </td>
              <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft);text-align:right;font-family:'JetBrains Mono',monospace;color:${r.type === 'income' ? 'var(--green)' : 'var(--red)'}">
                ${r.type === 'income' ? '+' : '-'} ${Utils.formatCurrency(r.amount)}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <button class="btn btn-primary btn-full mt-3" onclick="Import.doImport()">
        ⬆️ Importar ${rows.length} transações
      </button>
    `;
  },

  async doImport() {
    if (!this.parsedRows.length) { Utils.toast('Nenhuma transação para importar.', 'error'); return; }
    const btn = document.querySelector('#import-preview .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Importando...'; }
    try {
      const r = await API.importTransactions({ transactions: this.parsedRows });
      document.getElementById('import-step-upload').classList.add('hidden');
      const result = document.getElementById('import-result');
      result.classList.remove('hidden');
      result.innerHTML = `<div class="empty-state" style="padding:30px">
        <div class="empty-icon">✅</div>
        <div class="empty-title">${r.imported} transações importadas!</div>
        <div class="empty-sub">As transações já aparecem no seu extrato.</div>
        <button class="btn btn-primary btn-sm mt-3" onclick="Import.close();App.navigate('transactions')">Ver transações →</button>
      </div>`;
      await Transactions.load();
      Dashboard.refresh();
    } catch(err) {
      Utils.toast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = `⬆️ Importar ${this.parsedRows.length} transações`; }
    }
  }
};
