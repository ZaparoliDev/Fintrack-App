const Import = {
  parsedRows: [],
  openPanel() {
    this.parsedRows=[];
    document.getElementById('import-overlay').classList.add('open');
    document.getElementById('import-preview').innerHTML='';
    document.getElementById('import-file').value='';
    document.getElementById('import-format').value='fintrack';
    document.getElementById('import-result').classList.add('hidden');
    document.getElementById('import-step-upload').classList.remove('hidden');
  },
  close() { document.getElementById('import-overlay').classList.remove('open'); },
  onFileChange(input) {
    const file=input.files[0];
    if (!file) return;
    const reader=new FileReader();
    reader.onload=e=>this._parseCSV(e.target.result, document.getElementById('import-format').value);
    reader.readAsText(file,'UTF-8');
  },
  _parseCSV(text, format) {
    // Remove BOM se presente
    text = text.replace(/^\uFEFF/,'');
    const lines = text.split(/\r?\n/).filter(l=>l.trim());
    if (lines.length<2) { Utils.toast('Arquivo vazio ou inválido.','error'); return; }

    let rows=[];
    if (format==='fintrack') {
      // Formato Fintrack: Data;Descrição;Tipo;Categoria;Valor;Observação
      const header = lines[0].split(';').map(h=>h.trim().replace(/"/g,''));
      rows = lines.slice(1).map(line=>{
        const cols=line.split(';').map(c=>c.trim().replace(/"/g,''));
        return {
          date:        cols[0] ? cols[0].split('/').reverse().join('-') : '',
          description: cols[1]||'',
          type:        cols[2]==='Receita'?'income':'expense',
          amount:      parseFloat((cols[4]||'0').replace(',','.')),
          note:        cols[5]||''
        };
      }).filter(r=>r.description&&r.amount>0);

    } else if (format==='nubank') {
      // Nubank: date,title,amount  (crédito é negativo no CSV deles)
      rows = lines.slice(1).map(line=>{
        const cols=line.split(',').map(c=>c.trim().replace(/"/g,''));
        const amount=parseFloat(cols[2]||0);
        return { date:cols[0]||'', description:cols[1]||'', type:amount<0?'expense':'income', amount:Math.abs(amount), note:'Importado Nubank' };
      }).filter(r=>r.description&&r.amount>0);

    } else if (format==='inter') {
      // Inter: Data;Histórico;Tipo Lançamento;Valor
      rows = lines.slice(1).map(line=>{
        const cols=line.split(';').map(c=>c.trim().replace(/"/g,''));
        const amount=parseFloat((cols[3]||'0').replace(',','.'));
        const tipo=cols[2]||'';
        return {
          date:        cols[0]?cols[0].split('/').reverse().join('-'):'',
          description: cols[1]||'',
          type:        tipo.toLowerCase().includes('crédito')||tipo.toLowerCase().includes('recebido')?'income':'expense',
          amount:      Math.abs(amount),
          note:        'Importado Inter'
        };
      }).filter(r=>r.description&&r.amount>0);

    } else if (format==='itau') {
      // Itaú: Data;Histórico;Valor
      rows = lines.slice(1).map(line=>{
        const cols=line.split(';').map(c=>c.trim().replace(/"/g,''));
        const amount=parseFloat((cols[2]||'0').replace(',','.'));
        return {
          date:        cols[0]?cols[0].split('/').reverse().join('-'):'',
          description: cols[1]||'',
          type:        amount>=0?'income':'expense',
          amount:      Math.abs(amount),
          note:        'Importado Itaú'
        };
      }).filter(r=>r.description&&r.amount>0);
    }

    this.parsedRows=rows;
    this._renderPreview(rows);
  },
  _renderPreview(rows) {
    const el=document.getElementById('import-preview');
    if (!rows.length) { el.innerHTML='<p class="text-muted text-sm">Nenhuma linha válida encontrada.</p>'; return; }
    const preview=rows.slice(0,8);
    el.innerHTML=`
      <div class="import-preview-info">${rows.length} transações encontradas — prévia das primeiras ${preview.length}:</div>
      <div class="import-table-wrap">
        <table style="width:100%;font-size:0.78rem;border-collapse:collapse">
          <thead><tr>
            <th style="padding:6px 10px;text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">Data</th>
            <th style="padding:6px 10px;text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">Descrição</th>
            <th style="padding:6px 10px;text-align:left;color:var(--text-muted);border-bottom:1px solid var(--border)">Tipo</th>
            <th style="padding:6px 10px;text-align:right;color:var(--text-muted);border-bottom:1px solid var(--border)">Valor</th>
          </tr></thead>
          <tbody>${preview.map(r=>`<tr>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft)">${r.date}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft)">${r.description}</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft)"><span class="badge-type badge-${r.type}">${r.type==='income'?'Receita':'Despesa'}</span></td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border-soft);text-align:right;font-family:'JetBrains Mono',monospace">${Utils.formatCurrency(r.amount)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
      <button class="btn btn-primary btn-full mt-3" onclick="Import.doImport()">⬆️ Importar ${rows.length} transações</button>
    `;
  },
  async doImport() {
    if (!this.parsedRows.length) { Utils.toast('Nenhuma transação para importar.','error'); return; }
    const btn=document.querySelector('#import-preview .btn-primary');
    if (btn) { btn.disabled=true; btn.textContent='Importando...'; }
    try {
      const r=await API.importTransactions({ transactions:this.parsedRows });
      document.getElementById('import-step-upload').classList.add('hidden');
      const result=document.getElementById('import-result');
      result.classList.remove('hidden');
      result.innerHTML=`<div class="empty-state" style="padding:30px">
        <div class="empty-icon">✅</div>
        <div class="empty-title">${r.imported} transações importadas!</div>
        <div class="empty-sub">As transações já aparecem no seu extrato.</div>
        <button class="btn btn-primary btn-sm mt-3" onclick="Import.close();App.navigate('transactions')">Ver transações</button>
      </div>`;
      await Transactions.load();
      Dashboard.refresh();
    } catch(err) { Utils.toast(err.message,'error'); if(btn){btn.disabled=false;btn.textContent=`⬆️ Importar ${this.parsedRows.length} transações`;} }
  }
};
