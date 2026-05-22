export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function withThermalPage(printFn) {
  const style = document.createElement('style');
  style.id = 'print-page-override';
  style.textContent = `
    @page { 
      margin: 0; 
      size: auto; 
    }
    @media print {
      body > *:not(#print-root) { display: none !important; }
      body, html { 
        margin: 0 !important; 
        padding: 0 !important; 
        background: #fff !important; 
      }
      #print-root {
        display: block !important;
        position: static !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 5mm 5mm 20mm 5mm !important;
        box-sizing: border-box !important;
        color: #000 !important;
      }
    }
  `;
  document.head.appendChild(style);
  
  // Set timeout to allow the DOM to absorb the injected styles before spawning print dialog
  setTimeout(() => {
    printFn();
  }, 100);

  const cleanup = () => {
    style.remove();
    document.querySelectorAll('#print-root').forEach(el => el.remove());
  };

  // Cleanup happens immediately after print dialog is closed
  window.addEventListener('afterprint', cleanup, { once: true });
}

// Replaced static 50-character strings with responsive CSS borders!
const lineEq = `<div style="border-bottom: 2px dashed #000; margin: 8px 0; width: 100%;"></div>`;
const lineDash = `<div style="border-bottom: 1px dashed #000; margin: 6px 0; width: 100%;"></div>`;
const lineAst = `<div style="border-bottom: 2px dotted #000; margin: 8px 0; width: 100%;"></div>`;

export function printKitchenTicket({ orderId, tableNumber, shopName, createdAt, lines, waiterName }) {
  // Clear any old tickets before starting
  document.querySelectorAll('#print-root').forEach(el => el.remove());

  const root = document.createElement('div');
  root.id = 'print-root';

  const d = createdAt ? new Date(createdAt) : new Date();
  const dateStr = d.toLocaleDateString();
  const timeStr = d.toLocaleTimeString();

  const rows = lines.map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : [];
    const ingText = ings.length > 0
      ? `<div style="font-size: 11pt; padding-left: 20px; font-style: italic; text-align: left; font-weight: bold; margin-bottom: 8px;">
          ${ings.map(i => `• ${esc(i.name)}: ${esc(i.qty)} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : '';

    return `
      <div style="display:flex; justify-content:flex-start; margin: 8px 0 2px 0; font-size: 14pt;">
         <div style="min-width: 28px; font-weight: bold;">${esc(l.quantity)}</div>
         <div style="word-break: break-word;">${esc(l.itemName)}</div>
      </div>
      ${ingText}
    `;
  }).join('');

  // max-width set to a safer 60mm which easily fits 58mm & 80mm printers without wrapping wildly
  root.innerHTML = `
    <div style="
      width: 100%;
      max-width: 60mm;
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12pt;
      line-height: 1.3;
      color: #000;
      text-align: left;
    ">
      <div style="text-align: center; font-size: 16pt; font-weight: bold; padding: 5px 0;">
        *** KITCHEN BAR ***
      </div>
      ${lineEq}

      <div>Server: ${esc(waiterName || 'Staff')}</div>
      <div>Station 1</div>
      <div style="font-size: 18pt; padding: 8px 0; text-align:center; font-weight:bold;">Dine In</div>
      
      <div style="display:flex; justify-content:space-between;">
        <span>${esc(dateStr)}</span>
        <span>${esc(timeStr)}</span>
      </div>
      
      ${lineEq}

      <div style="font-size: 16pt; font-weight: bold;">Table: ${esc(tableNumber)}</div>
      <div style="font-size: 12pt;">Guests: 1</div>
      
      ${lineDash}

      ${rows}

      ${lineDash}
      
      <div style="padding: 10px 0;">
         <div style="font-size: 14pt; font-weight: bold;">Ticket #: ${esc(String(orderId).slice(0, 4))}</div>
         <div style="font-size: 11pt;">Order #: ${esc(String(orderId).split('-')[0])}</div>
      </div>

      ${lineAst}
    </div>
  `;

  document.body.appendChild(root);
  withThermalPage(() => {
    window.print();
  });
}

export function printReceipt({ shopName, order, paymentMethod }) {
  // Clear any old tickets before starting
  document.querySelectorAll('#print-root').forEach(el => el.remove());

  const root = document.createElement('div');
  root.id = 'print-root';

  const d = order?.createdAt ? new Date(order.createdAt) : new Date();
  const dateStr = d.toLocaleDateString();
  const timeStr = d.toLocaleTimeString();

  const rows = (order?.lines ?? []).map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : [];
    const ingText = ings.length > 0
      ? `<div style="font-size: 10pt; padding-left: 20px; font-style: italic; text-align: left;">
          ${ings.map(i => `• ${esc(i.name)}: ${esc(i.qty)} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : '';

    return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin: 6px 0 2px 0; font-size: 12pt;">
       <div style="display:flex; width: 70%;">
          <div style="min-width: 24px; font-weight: bold;">${esc(l.quantity)}</div>
          <div style="word-break: break-word; padding-right: 4px;">${esc(l.itemName)}</div>
       </div>
       <div style="width: 30%; text-align: right;">${Number(l.price).toLocaleString()}</div>
    </div>
    ${ingText}
  `}).join('');

  const total = Number(order?.total ?? 0).toLocaleString();
  const methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : (paymentMethod === 'POS' ? 'POS/CARD' : 'CASH');
  const waiter = order?.waiterName || 'Staff';

  root.innerHTML = `
    <div style="
      width: 100%;
      max-width: 60mm;
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12pt;
      line-height: 1.3;
      color: #000;
      text-align: left;
    ">
      <div style="text-align: center; font-size: 16pt; font-weight: bold; padding: 5px 0;">
        ${esc(shopName ?? "Mama Prince's Coffee")}
      </div>
      ${lineEq}

      <div>Server: ${esc(waiter)}</div>
      <div>Method: ${esc(methodLabel)}</div>
      <div style="font-size: 18pt; padding: 8px 0; text-align: center; font-weight:bold;">Dine In</div>
      
      <div style="display:flex; justify-content:space-between;">
        <span>${esc(dateStr)}</span>
        <span>${esc(timeStr)}</span>
      </div>
      
      ${lineEq}

      <div style="font-size: 16pt; font-weight: bold;">Table: ${esc(order?.tableNumber || '1')}</div>
      <div style="font-size: 12pt;">Guests: 1</div>
      
      ${lineDash}

      ${rows}

      ${lineDash}

      <div style="display:flex; justify-content:space-between; font-size: 16pt; font-weight:bold; margin-top: 10px;">
         <span>TOTAL</span>
         <span>${total}</span>
      </div>

      ${lineAst}
      
      <div style="padding: 10px 0;">
         <div style="font-size: 14pt; font-weight: bold;">Ticket #: ${esc(String(order?.id ?? 'NEW').slice(0, 4))}</div>
         <div style="font-size: 11pt;">Order #: ${esc(String(order?.id ?? 'NEW').split('-')[0])}</div>
      </div>
      <div style="text-align: center; font-size: 10pt; padding-top: 10px;">
        Thank you for your visit!
      </div>
    </div>
  `;

  document.body.appendChild(root);
  withThermalPage(() => {
    window.print();
  });
}