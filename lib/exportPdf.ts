// Utility for generating and exporting sales dashboard data and visualizations to a PDF report

interface SalesPDFReportData {
  title?: string;
  period?: string;
  totalRevenue: number;
  totalSales: number;
  avgTicket: number;
  activeProductsCount?: number;
  salesBySeller?: { name: string; value: number }[];
  salesByCategory?: { name: string; value: number }[];
  salesResults?: { 
    name: string; 
    res2025?: number; 
    meta2026?: number; 
    res2026?: number; 
    target_2026?: number;
    result_2026?: number;
    atingimento?: number;
  }[];
  recentTransactions?: {
    customer_name: string;
    seller_name?: string;
    sale_date: string;
    total_value: number;
    payment_method: string;
  }[];
}

export function exportSalesDashboardToPDF(data: SalesPDFReportData) {
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const title = data.title || 'RELATÓRIO EXECUTIVO DE VENDAS E PERFORMANCE';
  const period = data.period || new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Generate printable HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        @page {
          size: A4;
          margin: 15mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 2px solid #3b82f6;
          margin-bottom: 20px;
        }
        .header h1 {
          font-size: 18px;
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
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          border: 1px solid #bfdbfe;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .metric-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
        }
        .metric-card .label {
          font-size: 9px;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        .metric-card .value {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
        }
        .metric-card .value.emerald { color: #059669; }
        .metric-card .value.blue { color: #2563eb; }
        .metric-card .value.amber { color: #d97706; }

        .section-title {
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #334155;
          margin: 20px 0 10px 0;
          padding-bottom: 4px;
          border-bottom: 1px solid #e2e8f0;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 11px;
        }
        th {
          background: #f1f5f9;
          color: #475569;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 9px;
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
        .font-bold { font-weight: 700; }
        .font-black { font-weight: 900; }
        .text-emerald { color: #059669; }
        .text-blue { color: #2563eb; }

        .progress-bar-outer {
          width: 100%;
          height: 8px;
          background: #e2e8f0;
          border-radius: 4px;
          overflow: hidden;
          margin-top: 4px;
        }
        .progress-bar-inner {
          height: 100%;
          background: #2563eb;
          border-radius: 4px;
        }

        .footer {
          margin-top: 30px;
          padding-top: 12px;
          border-top: 1px dashed #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #94a3b8;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${title}</h1>
          <p>Gerado em: ${dateStr} • Período: ${period}</p>
        </div>
        <div class="badge">Relatório Oficial em PDF</div>
      </div>

      <!-- Key Metrics -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="label">Receita Total</div>
          <div class="value emerald">R$ ${data.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="metric-card">
          <div class="label">Total de Vendas</div>
          <div class="value blue">${data.totalSales}</div>
        </div>
        <div class="metric-card">
          <div class="label">Ticket Médio</div>
          <div class="value amber">R$ ${data.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="metric-card">
          <div class="label">Produtos em Catálogo</div>
          <div class="value">${data.activeProductsCount || 0}</div>
        </div>
      </div>

      <!-- Sellers Performance Table -->
      ${data.salesBySeller && data.salesBySeller.length > 0 ? `
        <div class="section-title">Desempenho por Vendedor / Colaborador</div>
        <table>
          <thead>
            <tr>
              <th>Vendedor</th>
              <th class="text-right">Total Faturado (R$)</th>
              <th class="text-right">Participação</th>
            </tr>
          </thead>
          <tbody>
            ${data.salesBySeller.map(s => {
              const share = data.totalRevenue > 0 ? ((s.value / data.totalRevenue) * 100).toFixed(1) : '0';
              return `
                <tr>
                  <td class="font-bold">${s.name}</td>
                  <td class="text-right font-black text-emerald">R$ ${s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td class="text-right font-bold">${share}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      <!-- Detailed Results & Goals -->
      ${data.salesResults && data.salesResults.length > 0 ? `
        <div class="section-title">Acompanhamento de Resultados vs. Metas</div>
        <table>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th class="text-right">Res. 2025</th>
              <th class="text-right">Meta 2026</th>
              <th class="text-right">Res. 2026</th>
              <th class="text-right">Atingimento</th>
            </tr>
          </thead>
          <tbody>
            ${data.salesResults.map(r => {
              const res2026 = r.res2026 ?? r.result_2026 ?? 0;
              const meta2026 = r.meta2026 ?? r.target_2026 ?? 0;
              const ating = meta2026 > 0 ? Math.round((res2026 / meta2026) * 100) : 0;
              return `
                <tr>
                  <td class="font-bold">${r.name}</td>
                  <td class="text-right">R$ ${(r.res2025 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td class="text-right font-bold">R$ ${meta2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td class="text-right font-black text-blue">R$ ${res2026.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td class="text-right font-bold ${ating >= 100 ? 'text-emerald' : ''}">${ating}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      <!-- Recent Transactions -->
      ${data.recentTransactions && data.recentTransactions.length > 0 ? `
        <div class="section-title">Últimas Transações Registradas</div>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Data</th>
              <th>Forma de Pagamento</th>
              <th class="text-right">Valor (R$)</th>
            </tr>
          </thead>
          <tbody>
            ${data.recentTransactions.slice(0, 10).map(t => `
              <tr>
                <td class="font-bold">${t.customer_name}</td>
                <td>${t.seller_name || 'Vendedor'}</td>
                <td>${t.sale_date}</td>
                <td>${t.payment_method}</td>
                <td class="text-right font-black text-emerald">R$ ${t.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <div class="footer">
        <span>Sistema de Gestão & Performance • AI Studio Sales Dashboard</span>
        <span>Documento gerado digitalmente • Código de validação: ${Math.random().toString(36).substring(2, 9).toUpperCase()}</span>
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

  // Open printable window
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
