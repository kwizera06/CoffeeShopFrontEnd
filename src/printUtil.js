export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function withThermalPage(paperWidth, printFn) {
  const style = document.createElement('style');
  style.id = 'print-page-override';
  
  const is80mm = paperWidth === '80mm';
  const sidePadding = is80mm ? '4mm' : '2mm';

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
        width: ${paperWidth} !important;
        margin: 0 !important;
        padding: 2mm ${sidePadding} 20mm ${sidePadding} !important;
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

// Text-character separators that print 100% reliably on ALL thermal printers
function getLineEq(is80mm) {
  const chars = is80mm ? '='.repeat(46) : '='.repeat(32);
  return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; font-weight: bold; margin: 6px 0; text-align: center; white-space: nowrap; overflow: hidden; letter-spacing: -0.5px;">${chars}</div>`;
}

function getLineDash(is80mm) {
  const chars = is80mm ? '-'.repeat(46) : '-'.repeat(32);
  return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; font-weight: bold; margin: 6px 0; text-align: center; white-space: nowrap; overflow: hidden; letter-spacing: -0.5px;">${chars}</div>`;
}

function getLineAst(is80mm) {
  const chars = is80mm ? '*'.repeat(46) : '*'.repeat(32);
  return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; font-weight: bold; margin: 6px 0; text-align: center; white-space: nowrap; overflow: hidden; letter-spacing: -0.5px;">${chars}</div>`;
}

export function printKitchenTicket({ orderId, tableNumber, shopName, createdAt, lines, waiterName }) {
  const is80mm = shopName && (
    shopName.toLowerCase().includes('inganji') || 
    shopName.toLowerCase().includes('steak') || 
    shopName.toLowerCase().includes('house')
  );
  const paperWidth = is80mm ? '80mm' : '58mm';
  const printableWidth = is80mm ? '72mm' : '54mm';

  // Clear any old tickets before starting
  document.querySelectorAll('#print-root').forEach(el => el.remove());

  const root = document.createElement('div');
  root.id = 'print-root';

  const d = createdAt ? new Date(createdAt) : new Date();
  const dateStr = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' });
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' });

  const rows = lines.map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : [];
    const ingText = ings.length > 0
      ? `<div style="font-size: 9pt; padding-left: 10px; font-style: italic; text-align: left; font-weight: bold; margin-bottom: 8px;">
          ${ings.map(i => `• ${esc(i.name)}: ${esc(i.qty)} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : '';

    return `
      <div style="display:flex; justify-content:flex-start; margin: 8px 0 2px 0; font-size: 12pt;">
         <div style="font-weight: bold; margin-right: 12px; min-width: 24px;">${esc(l.quantity)}</div>
         <div style="word-break: break-word;">${esc(l.itemName)}</div>
      </div>
      ${ingText}
    `;
  }).join('');

  root.innerHTML = `
    <div style="
      width: 100%;
      max-width: ${printableWidth};
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      line-height: 1.2;
      color: #000;
      text-align: left;
    ">
      <div style="text-align: center; font-size: 14pt; font-weight: bold; padding: 5px 0;">
        *** KITCHEN BAR ***
      </div>
      ${getLineEq(is80mm)}

      <div>Server: ${esc(waiterName || 'Staff')}</div>
      <div>Station 1</div>
      <div style="font-size: 14pt; padding: 6px 0; text-align:center; font-weight:bold;">Dine In</div>
      
      <div style="display:flex; justify-content:space-between; font-size: 9pt;">
        <span>${esc(dateStr)}</span>
        <span>${esc(timeStr)}</span>
      </div>
      
      ${getLineEq(is80mm)}

      <div style="font-size: 14pt; font-weight: bold;">Table: ${esc(tableNumber)}</div>
      <div style="font-size: 10pt;">Guests: 1</div>
      
      ${getLineDash(is80mm)}

      ${rows}

      ${getLineDash(is80mm)}
      
      <div style="padding: 8px 0;">
         <div style="font-size: 12pt; font-weight: bold;">Ticket #: ${esc(String(orderId).slice(0, 4))}</div>
         <div style="font-size: 10pt;">Order #: ${esc(String(orderId).split('-')[0])}</div>
      </div>

      ${getLineAst(is80mm)}
    </div>
  `;

  document.body.appendChild(root);
  withThermalPage(paperWidth, () => {
    window.print();
  });
}

export function printReceipt({ shopName, order, paymentMethod }) {
  const is80mm = shopName && (
    shopName.toLowerCase().includes('inganji') || 
    shopName.toLowerCase().includes('steak') || 
    shopName.toLowerCase().includes('house')
  );
  const paperWidth = is80mm ? '80mm' : '58mm';
  const printableWidth = is80mm ? '72mm' : '54mm';

  // Clear any old tickets before starting
  document.querySelectorAll('#print-root').forEach(el => el.remove());

  const root = document.createElement('div');
  root.id = 'print-root';

  const d = order?.createdAt ? new Date(order.createdAt) : new Date();
  const dateStr = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' });
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' });

  const rows = (order?.lines ?? []).map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : [];
    const ingText = ings.length > 0
      ? `<div style="font-size: 9pt; padding-left: 10px; font-style: italic; text-align: left;">
          ${ings.map(i => `• ${esc(i.name)}: ${esc(i.qty)} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : '';

    return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin: 6px 0 2px 0; font-size: 10pt;">
       <div style="display:flex; width: 65%;">
          <div style="font-weight: bold; margin-right: 8px; min-width: 20px;">${esc(l.quantity)}</div>
          <div style="word-break: break-word; padding-right: 4px;">${esc(l.itemName)}</div>
       </div>
       <div style="width: 35%; text-align: right;">${Number(l.price).toLocaleString()}</div>
    </div>
    ${ingText}
  `}).join('');

  const total = Number(order?.total ?? 0).toLocaleString();
  const methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : 
                      paymentMethod === 'POS' ? 'POS/CARD' : 
                      paymentMethod === 'LOAN' ? 'LOAN' : 
                      paymentMethod === 'CASH' ? 'CASH' : 'UNPAID';
  const waiter = order?.waiterName || 'Staff';

  root.innerHTML = `
    <div style="
      width: 100%;
      max-width: ${printableWidth};
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      line-height: 1.2;
      color: #000;
      text-align: left;
    ">
      <div style="text-align: center; font-size: 14pt; font-weight: bold; padding: 5px 0;">
        ${esc(shopName ?? "Mama Prince's Coffee")}
      </div>
      ${getLineEq(is80mm)}

      <div>Server: ${esc(waiter)}</div>
      <div>Method: ${esc(methodLabel)}</div>
      <div style="font-size: 14pt; padding: 6px 0; text-align: center; font-weight:bold;">Dine In</div>
      
      <div style="display:flex; justify-content:space-between; font-size: 9pt;">
        <span>${esc(dateStr)}</span>
        <span>${esc(timeStr)}</span>
      </div>
      
      ${getLineEq(is80mm)}

      <div style="font-size: 14pt; font-weight: bold;">Table: ${esc(order?.tableNumber || '1')}</div>
      <div style="font-size: 10pt;">Guests: 1</div>
      
      ${getLineDash(is80mm)}

      ${rows}

      ${getLineDash(is80mm)}

      <div style="display:flex; justify-content:space-between; font-size: 14pt; font-weight:bold; margin-top: 10px;">
         <span>TOTAL</span>
         <span>${total}</span>
      </div>

      ${getLineAst(is80mm)}
      
      <div style="padding: 8px 0;">
         <div style="font-size: 12pt; font-weight: bold;">Ticket #: ${esc(String(order?.id ?? 'NEW').slice(0, 4))}</div>
         <div style="font-size: 10pt;">Order #: ${esc(String(order?.id ?? 'NEW').split('-')[0])}</div>
      </div>
      <div style="text-align: center; font-size: 9pt; padding-top: 10px;">
        Thank you for your visit!
      </div>
    </div>
  `;

  document.body.appendChild(root);
  withThermalPage(paperWidth, () => {
    window.print();
  });
}