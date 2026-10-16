// PDF Generator for Consolidated Monthly Report (Sales, Tasks, Leads)

export interface ConsolidatedMonthData {
  monthName: string;
  vendasReceita: number;
  vendasMeta: number;
  vendasQtd: number;
  tarefasCriadas: number;
  tarefasConcluidas: number;
  taxaConclusaoTarefas: number;
  leadsCaptados: number;
  leadsConvertidos: number;
  taxaConversaoLeads: number;
  ticketMedio: number;
}

export function exportConsolidatedReportToPDF(
  monthlyData: ConsolidatedMonthData[],
  totals: {
    totalReceita: number;
    totalMetas: number;
    totalTarefasCriadas: number;
    totalTarefasConcluidas: number;
    totalLeadsCaptados: number;
    totalLeadsConvertidos: number;
    avgTicket: number;
    avgLeadConversionRate: number;
    avgTaskCompletionRate: number;
  }
) {
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório Consolidado de Desempenho Mensal</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 3px solid #2563eb;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 20px;
          font-weight: 900;
          color: #1e3a8a;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .header p {
          font-size: 11px;
          color: #64748b;
          margin: 0;
          font-weight: 600;
        }
        .badge {
          background: #eff6ff;
          color: #2563eb;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          border: 1px solid #bfdbfe;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .metric-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
        }
        .metric-card .label {
          font-size: 8px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .metric-card .value {
          font-size: 14px;
          font-weight: 900;
          color: #0f172a;
        }
        .text-emerald { color: #059669; }
        .text-blue { color: #2563eb; }
        .text-indigo { color: #4f46e5; }
        .text-amber { color: #d97706; }

        .section-title {
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #334155;
          margin: 16px 0 10px 0;
          padding-bottom: 4px;
          border-bottom: 2px solid #e2e8f0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 10px;
        }
        th {
          background: #f1f5f9;
          color: #475569;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 8px;
          letter-spacing: 0.5px;
          padding: 8px 10px;
          text-align: left;
          border-bottom: 1px solid #cbd5e1;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          color: #1e293b;
        }
        tr:nth-child(even) td {
          background: #fafafa;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: 700; }
        .font-black { font-weight: 900; }

        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 8px;
          color: #94a3b8;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>PAINEL DE RELATÓRIOS CONSOLIDADO (VENDAS, TAREFAS E LEADS)</h1>
          <p>Análise Comparativa Mensal de Desempenho Operacional e Comercial • Gerado em: ${dateStr}</p>
        </div>
        <div class="badge">Relatório Oficial Consolidado</div>
      </div>

      <!-- Key Metrics -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="label">Receita Vendas (R$)</div>
          <div class="value text-emerald">R$ ${totals.totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="metric-card">
          <div class="label">Meta de Vendas (R$)</div>
          <div class="value">R$ ${totals.totalMetas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="metric-card">
          <div class="label">Tarefas Concluídas</div>
          <div class="value text-blue">${totals.totalTarefasConcluidas} / ${totals.totalTarefasCriadas}</div>
        </div>
        <div class="metric-card">
          <div class="label">Taxa Tarefas (%)</div>
          <div class="value text-indigo">${totals.avgTaskCompletionRate}%</div>
        </div>
        <div class="metric-card">
          <div class="label">Leads Convertidos</div>
          <div class="value text-emerald">${totals.totalLeadsConvertidos} / ${totals.totalLeadsCaptados}</div>
        </div>
        <div class="metric-card">
          <div class="label">Taxa Conversão Leads</div>
          <div class="value text-amber">${totals.avgLeadConversionRate}%</div>
        </div>
      </div>

      <div class="section-title">Detalhamento Comparativo Mensal de Vendas, Tarefas e Leads</div>
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            <th class="text-right">Receita Vendas (R$)</th>
            <th class="text-right">Meta Vendas (R$)</th>
            <th class="text-right">Ticket Médio (R$)</th>
            <th class="text-center">Tarefas (Criadas/Concluídas)</th>
            <th class="text-center">Rate Tarefas (%)</th>
            <th class="text-center">Leads (Captados/Convertidos)</th>
            <th class="text-center">Taxa Leads (%)</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyData.map(m => `
            <tr>
              <td class="font-black text-blue">${m.monthName}</td>
              <td class="text-right font-black text-emerald">R$ ${m.vendasReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td class="text-right font-bold">R$ ${m.vendasMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td class="text-right font-bold">R$ ${m.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              <td class="text-center font-bold">${m.tarefasCriadas} / ${m.tarefasConcluidas}</td>
              <td class="text-center font-black ${m.taxaConclusaoTarefas >= 70 ? 'text-emerald' : 'text-amber'}">${m.taxaConclusaoTarefas}%</td>
              <td class="text-center font-bold">${m.leadsCaptados} / ${m.leadsConvertidos}</td>
              <td class="text-center font-black ${m.taxaConversaoLeads >= 20 ? 'text-emerald' : ''}">${m.taxaConversaoLeads}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        <span>Sistema de Gestão & Performance • AI Studio Reports</span>
        <span>Relatório emitido digitalmente • Código de segurança: ${Math.random().toString(36).substring(2, 9).toUpperCase()}</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=1000,height=800');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
