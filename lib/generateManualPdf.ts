// Generator for complete system user guide / manual PDF

export function generateUserManualPDF() {
  const dateStr = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Manual do Usuário - Sistema de Gestão e Operações</title>
      <style>
        @page {
          size: A4;
          margin: 15mm 15mm 20mm 15mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.5;
        }

        /* Cover & Header */
        .cover {
          background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
          color: #ffffff;
          padding: 24px;
          border-radius: 16px;
          margin-bottom: 24px;
          box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.3);
        }
        .cover h1 {
          font-size: 22px;
          font-weight: 900;
          margin: 0 0 6px 0;
          letter-spacing: -0.5px;
          text-transform: uppercase;
        }
        .cover p {
          font-size: 12px;
          margin: 0;
          opacity: 0.9;
          font-weight: 500;
        }
        .cover .meta {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-weight: 600;
        }

        .badge-version {
          background: rgba(255, 255, 255, 0.2);
          padding: 3px 10px;
          border-radius: 20px;
          text-transform: uppercase;
          font-size: 9px;
          font-weight: 800;
        }

        /* Table of Contents */
        .toc {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }
        .toc-title {
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #1e293b;
          margin-bottom: 10px;
        }
        .toc-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }
        .toc-item {
          font-size: 11px;
          font-weight: 700;
          color: #2563eb;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Module Sections */
        .module-section {
          margin-bottom: 24px;
          page-break-inside: avoid;
        }
        .module-header {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #f1f5f9;
          padding: 10px 14px;
          border-radius: 10px;
          border-left: 4px solid #2563eb;
          margin-bottom: 12px;
        }
        .module-header h2 {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          text-transform: uppercase;
        }

        .function-card {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }
        .function-card h3 {
          font-size: 12px;
          font-weight: 800;
          color: #1e3a8a;
          margin: 0 0 4px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .function-card p {
          margin: 0 0 8px 0;
          color: #334155;
        }
        .steps-list {
          margin: 0;
          padding-left: 18px;
          color: #475569;
        }
        .steps-list li {
          margin-bottom: 4px;
        }

        .tip-box {
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          padding: 8px 12px;
          margin-top: 8px;
          font-size: 10px;
          color: #1e40af;
          font-weight: 600;
        }

        .footer {
          margin-top: 40px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #94a3b8;
          font-weight: 600;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <!-- Cover Header -->
      <div class="cover">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1>Manual do Usuário & Guia de Funções</h1>
            <p>Documento Instrutivo das Funcionalidades do Sistema Operacional e de Gestão</p>
          </div>
          <span class="badge-version">Versão 2026.1</span>
        </div>
        <div class="meta">
          <span>Data de Emissão: ${dateStr}</span>
          <span>Suporte Técnico & Operacional</span>
        </div>
      </div>

      <!-- Sumário Executivo -->
      <div class="toc">
        <div class="toc-title">📌 Sumário dos Módulos do Sistema</div>
        <div class="toc-grid">
          <div class="toc-item">1. Gestão de Tarefas & Demandas</div>
          <div class="toc-item">2. Dashboard de Vendas & Resultados</div>
          <div class="toc-item">3. Logística de Entregas & Frota</div>
          <div class="toc-item">4. Transferências de Estoque</div>
          <div class="toc-item">5. Garantias & Assistência Técnica</div>
          <div class="toc-item">6. CRM & Funil de Leads</div>
          <div class="toc-item">7. Integração WhatsApp</div>
          <div class="toc-item">8. Configurações & Segurança</div>
        </div>
      </div>

      <!-- Módulo 1: Tarefas -->
      <div class="module-section">
        <div class="module-header">
          <h2>1. Gestão de Tarefas & Demandas (/tasks)</h2>
        </div>

        <div class="function-card">
          <h3>📋 Visualização Multimodais (Grade, Lista, Kanban, Calendário e Mapa)</h3>
          <p>Permite alternar a visualização das tarefas operacionais conforme a necessidade do colaborador ou gestor.</p>
          <ul class="steps-list">
            <li><strong>Modo Grade / Lista:</strong> Exibe detalhes dos prazos, envolvidos, barra de progresso e botões de ação rápida.</li>
            <li><strong>Modo Kanban:</strong> Organiza as tarefas por colunas de status (<em>Pendente</em>, <em>Em Andamento</em>, <em>Concluída</em>) permitindo arrastar e soltar.</li>
            <li><strong>Modo Calendário:</strong> Mapeia as datas de vencimento no calendário mensal.</li>
            <li><strong>Modo Mapa:</strong> Renderiza os marcadores no mapa interativo Leaflet com base nas coordenadas de destino.</li>
          </ul>
        </div>

        <div class="function-card">
          <h3>📍 Filtro "Próximas de Mim" (GPS Proximity Filter)</h3>
          <p>Ordena automaticamente todas as tarefas pendentes com base na distância da localização GPS atual do seu dispositivo.</p>
          <ul class="steps-list">
            <li>Clique no botão <strong>"Próximas de Mim"</strong> na barra de filtros da tela de tarefas.</li>
            <li>Autorize o acesso à localização no navegador quando solicitado.</li>
            <li>O sistema calculará a distância exata em metros ou quilômetros e destacará as tarefas mais próximas no topo.</li>
          </ul>
          <div class="tip-box">
            💡 Dica: No modo Mapa, um radar azul pulsante indicará a sua posição exata no mapa!
          </div>
        </div>

        <div class="function-card">
          <h3>➕ Criação e Atribuição de Demandas</h3>
          <p>Cadastre novas tarefas definindo título, descrição detalhada, colaborador responsável, prioridade e prazo.</p>
        </div>
      </div>

      <!-- Módulo 2: Vendas -->
      <div class="module-section">
        <div class="module-header">
          <h2>2. Dashboard de Vendas & Resultados (/sales e /sales-results)</h2>
        </div>

        <div class="function-card">
          <h3>💰 Registro e Controle de Vendas</h3>
          <p>Permite registrar novas transações comerciais selecionando cliente, vendedor, itens do catálogo e forma de pagamento.</p>
        </div>

        <div class="function-card">
          <h3>📄 Exportação de Relatório Executivo em PDF</h3>
          <p>Gera um relatório completo e formatado pronto para impressão ou download.</p>
          <ul class="steps-list">
            <li>Acesse o topo do Dashboard de Vendas e clique no botão <strong>"Exportar PDF"</strong> na barra de ações.</li>
            <li>O relatório compilará métricas de receita total, ticket médio, desempenho por colaborador e últimas vendas em uma página pronta para salvamento em PDF.</li>
          </ul>
        </div>

        <div class="function-card">
          <h3>📊 Acompanhamento de Metas Anuais</h3>
          <p>Compare os resultados obtidos em relação às metas estabelecidas por colaborador ou departamento.</p>
        </div>
      </div>

      <!-- Módulo 3: Entregas -->
      <div class="module-section">
        <div class="module-header">
          <h2>3. Logística de Entregas & Rastreamento (/deliveries)</h2>
        </div>

        <div class="function-card">
          <h3>🚚 Rastreamento em Tempo Real de Motoristas</h3>
          <p>Monitore o deslocamento das entregas em andamento através de um mapa interativo com suporte a GPS e status de rota.</p>
        </div>

        <div class="function-card">
          <h3>⏱️ Gestão de SLA e Alertas de Prazos Urgentes</h3>
          <p>Acompanhe indicadores de pontualidade e receba alertas para entregas próximas do vencimento.</p>
        </div>
      </div>

      <!-- Módulo 4: Transferências -->
      <div class="module-section">
        <div class="module-header">
          <h2>4. Transferências de Estoque (/transfers)</h2>
        </div>

        <div class="function-card">
          <h3>📦 Romaneios e NFe entre Depósitos</h3>
          <p>Crie registros de transferência de produtos entre filiais, associando números de nota fiscal e conferência de saída e entrada.</p>
        </div>
      </div>

      <!-- Módulo 5: Garantias -->
      <div class="module-section">
        <div class="module-header">
          <h2>5. Garantias & Assistências Técnicas (/warranties)</h2>
        </div>

        <div class="function-card">
          <h3>🛡️ Protocolos de Assistência e Devoluções</h3>
          <p>Registre chamados de garantia com número de protocolo, laudo do defeito, responsável e mapa de assistências autorizadas parceiras.</p>
        </div>
      </div>

      <!-- Módulo 6, 7 & 8: CRM, WhatsApp & Segurança -->
      <div class="module-section">
        <div class="module-header">
          <h2>6. CRM, Atendimento & Configurações do Sistema</h2>
        </div>

        <div class="function-card">
          <h3>📲 Atendimento via WhatsApp Integrado (/whatsapp)</h3>
          <p>Envie atualizações de status de pedidos e tarefas diretamente aos clientes com modelos padronizados.</p>
        </div>

        <div class="function-card">
          <h3>⚙️ Configurações, Segurança e Permissões (/admin/settings)</h3>
          <p>Gerencie dados do seu perfil, altere senhas de acesso, configure o modo escuro/claro e controle o acesso por perfil de usuário (Administrador, Vendedor, Entregador, Estoque).</p>
        </div>
      </div>

      <!-- Rodapé do Documento -->
      <div class="footer">
        <span>Manual Oficial do Usuário • Sistema de Gestão Empresarial</span>
        <span>Página 1 de 1 • Gerado em ${dateStr}</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 400);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=950,height=900');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
