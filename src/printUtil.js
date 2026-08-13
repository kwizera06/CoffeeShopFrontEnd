export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Print via hidden iframe — faster than printing the full POS page */
function printHtmlInIframe(bodyHtml, paperWidth) {
  const is80mm = paperWidth === '80mm';
  const sidePadding = is80mm ? '4mm' : '2mm';

  document.getElementById('pos-print-iframe')?.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'pos-print-iframe';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Print</title><style>
    @page { margin: 0; size: auto; }
    html, body {
      margin: 0;
      padding: 2mm ${sidePadding} 6mm ${sidePadding};
      width: ${paperWidth};
      box-sizing: border-box;
      font-family: 'Courier New', Courier, monospace;
      color: #000;
      background: #fff;
    }
  </style></head><body>${bodyHtml}</body></html>`);
  doc.close();

  const cleanup = () => {
    iframe.remove();
    win.removeEventListener('afterprint', cleanup);
  };
  win.addEventListener('afterprint', cleanup, { once: true });

  const triggerPrint = () => {
    requestAnimationFrame(() => {
      win.focus();
      win.print();
    });
  };

  if (doc.readyState === 'complete') {
    triggerPrint();
  } else {
    iframe.onload = triggerPrint;
  }
}

// Text-character separators that print 100% reliably on ALL thermal printers
function getLineEq(is80mm) {
  const chars = is80mm ? '='.repeat(38) : '='.repeat(28);
  return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; font-weight: bold; margin: 6px 0; text-align: center; white-space: nowrap; overflow: hidden; letter-spacing: -0.5px;">${chars}</div>`;
}

function getLineDash(is80mm) {
  const chars = is80mm ? '-'.repeat(38) : '-'.repeat(28);
  return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; font-weight: bold; margin: 6px 0; text-align: center; white-space: nowrap; overflow: hidden; letter-spacing: -0.5px;">${chars}</div>`;
}

function getLineAst(is80mm) {
  const chars = is80mm ? '*'.repeat(38) : '*'.repeat(28);
  return `<div style="font-family: 'Courier New', Courier, monospace; font-size: 10pt; font-weight: bold; margin: 6px 0; text-align: center; white-space: nowrap; overflow: hidden; letter-spacing: -0.5px;">${chars}</div>`;
}

export function printKitchenTicket({ orderId, tableNumber, shopName, createdAt, lines, waiterName, order, totalItems, isPartialOrder }) {
  // Support both old and new API
  const finalOrderId = orderId || order?.id
  const finalTableNumber = tableNumber || order?.tableNumber
  const finalWaiterName = waiterName || order?.waiterName
  const finalCreatedAt = createdAt || order?.createdAt
  const finalLines = lines || order?.lines || []
  
  const is80mm = shopName && (
    shopName.toLowerCase().includes('inganji') || 
    shopName.toLowerCase().includes('steak') || 
    shopName.toLowerCase().includes('house')
  );
  const paperWidth = is80mm ? '80mm' : '58mm';
  const printableWidth = is80mm ? '62mm' : '46mm';

  const d = finalCreatedAt ? new Date(finalCreatedAt) : new Date();
  const dateStr = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' });
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' });

  const rows = finalLines.map((l) => {
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

  const html = `
    <div style="
      width: 100%;
      max-width: ${printableWidth};
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      font-weight: bold;
      line-height: 1.2;
      color: #000;
      text-align: left;
    ">
      <div style="text-align: center; font-size: 14pt; font-weight: bold; padding: 5px 0;">
        *** KITCHEN BAR ***
      </div>
      ${getLineEq(is80mm)}

      <div>Server: ${esc(finalWaiterName || 'Staff')}</div>
      <div>Station 1</div>
      <div style="font-size: 14pt; padding: 6px 0; text-align:center; font-weight:bold;">Dine In</div>
      
      <div style="display:flex; justify-content:space-between; font-size: 9pt;">
        <span>${esc(dateStr)}</span>
        <span>${esc(timeStr)}</span>
      </div>
      
      ${getLineEq(is80mm)}

      <div style="font-size: 14pt; font-weight: bold;">Table: ${esc(finalTableNumber)}</div>
      <div style="font-size: 10pt;">Guests: 1</div>
      ${isPartialOrder ? `<div style="font-size: 11pt; font-weight: bold; color: #c00; padding: 4px 0;">⚠ PARTIAL ORDER</div>` : ''}
      
      ${getLineDash(is80mm)}

      ${rows}

      ${getLineDash(is80mm)}
      
      <div style="padding: 8px 0;">
         <div style="font-size: 12pt; font-weight: bold;">Ticket #: ${esc(String(finalOrderId).slice(0, 4))}</div>
         <div style="font-size: 10pt;">Order #: ${esc(String(finalOrderId).split('-')[0])}</div>
      </div>

      ${getLineAst(is80mm)}
    </div>
  `;

  printHtmlInIframe(html, paperWidth);
}

export function printReceipt({ shopName, order, paymentMethod, momoName, momoNumber }) {
  const is80mm = shopName && (
    shopName.toLowerCase().includes('inganji') || 
    shopName.toLowerCase().includes('steak') || 
    shopName.toLowerCase().includes('house')
  );
  const paperWidth = is80mm ? '80mm' : '58mm';
  const printableWidth = is80mm ? '62mm' : '46mm';

  const d = order?.createdAt ? new Date(order.createdAt) : new Date();
  const dateStr = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kigali' });
  const timeStr = d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Kigali' });

  const rows = (order?.lines ?? []).map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : [];
    const ingText = ings.length > 0
      ? `<div style="font-size: 9pt; padding-left: 10px; font-style: italic; text-align: left; font-weight: bold;">
          ${ings.map(i => `• ${esc(i.name)}: ${esc(i.qty)} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : '';

    const qtyCalculationText = l.quantity > 1
      ? `<div style="font-size: 9pt; color: #444; padding-left: 28px; font-style: italic; text-align: left; font-weight: normal; margin-top: 2px;">
          (${esc(l.quantity)} x ${Number(l.price).toLocaleString()})
         </div>`
      : '';

    return `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin: 6px 0 2px 0; font-size: 10pt;">
       <div style="display:flex; width: 65%;">
          <div style="font-weight: bold; margin-right: 8px; min-width: 20px;">${esc(l.quantity)}</div>
          <div style="word-break: break-word; padding-right: 4px;">${esc(l.itemName)}</div>
       </div>
       <div style="width: 35%; text-align: right;">${Number(l.price * l.quantity).toLocaleString()}</div>
    </div>
    ${qtyCalculationText}
    ${ingText}
  `}).join('');

  const total = Number(order?.total ?? 0).toLocaleString();
  
  let methodLabel = 'UNPAID';
  let splitPaymentBreakdownHTML = '';

  if (Array.isArray(paymentMethod)) {
    methodLabel = 'SPLIT';
    splitPaymentBreakdownHTML = `
      ${getLineDash(is80mm)}
      <div style="font-size: 10pt; font-weight: bold; padding: 4px 0 2px 0; text-align: left;">PAYMENT BREAKDOWN:</div>
      ${paymentMethod.map(p => {
        const mLabel = p.method === 'MOBILE_MONEY' ? 'MOMO' : 
                       p.method === 'POS' ? 'CARD' : 
                       p.method === 'LOAN' ? `LOAN (${p.clientName || 'Client'})` : p.method;
        return `
        <div style="display: flex; justify-content: space-between; font-size: 9.5pt; font-weight: bold; margin: 3px 0;">
           <span>• ${esc(mLabel)}</span>
           <span>${Number(p.amount).toLocaleString()}</span>
        </div>
        `;
      }).join('')}
    `;
  } else if (paymentMethod) {
    methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : 
                  paymentMethod === 'POS' ? 'POS/CARD' : 
                  paymentMethod === 'LOAN' ? 'LOAN' : 
                  paymentMethod === 'CASH' ? 'CASH' : paymentMethod;
  }

  const waiter = order?.waiterName || 'Staff';

  const momoPayBlock = (momoName || momoNumber) ? `
    <div style="text-align: center; margin: 12px 0 6px 0; font-size: 9.5pt; border: 1.5px dashed #000; padding: 6px; border-radius: 4px; font-weight: bold; line-height: 1.4;">
       ${momoNumber ? `MOMO: ${esc(momoNumber)}<br/>` : ''}
       ${momoName ? `Name: ${esc(momoName)}` : ''}
    </div>
  ` : '';

  const html = `
    <div style="
      width: 100%;
      max-width: ${printableWidth};
      margin: 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      font-weight: bold;
      line-height: 1.2;
      color: #000;
      text-align: left;
    ">
      <div style="text-align: center; font-size: 14pt; font-weight: bold; padding: 5px 0;">
        ${esc(shopName ?? 'Olitech Hub')}
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

      ${splitPaymentBreakdownHTML}

      ${getLineAst(is80mm)}
      
      <div style="padding: 8px 0;">
         <div style="font-size: 12pt; font-weight: bold;">Ticket #: ${esc(String(order?.id ?? 'NEW').slice(0, 4))}</div>
         <div style="font-size: 10pt;">Order #: ${esc(String(order?.id ?? 'NEW').split('-')[0])}</div>
      </div>
      
      ${momoPayBlock}

      <div style="text-align: center; font-size: 9pt; padding-top: 10px;">
        Thank you for your visit!
      </div>
    </div>
  `;

  printHtmlInIframe(html, paperWidth);
}