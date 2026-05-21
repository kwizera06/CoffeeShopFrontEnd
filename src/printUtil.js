export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function withThermalPage(printFn) {
  // Clear entirely to prevent ghosting
  document.querySelectorAll('#print-root').forEach(el => el.remove());
  document.querySelectorAll('#print-page-override').forEach(el => el.remove());

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
        padding: 0 !important;
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

  window.addEventListener('afterprint', cleanup, { once: true });
}

// Fixed 32-character lines which safely fits ALL thermal printers (58mm and 80mm) without ugly word-wrap. 
// We use raw text here because many generic POS drivers STRIP all CSS borders/graphics!
const lineEq = "================================";
const lineDash = "--------------------------------";
const lineAst = "********************************";

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
      ? `<div>
          ${ings.map(i => `&nbsp;&nbsp;* ${esc(i.name)}: ${esc(i.qty)} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : '';

    return `
      <div style="font-weight: bold; margin-top: 4px;">
         ${esc(l.quantity)}x ${esc(l.itemName)}
      </div>
      ${ingText}
    `;
  }).join('');

  // We use pure HTML structure with `<br/>` and `&nbsp;` because some basic printer 
  // drivers act as "Generic Text Only" and completely ignore CSS margins, padding, and Flexbox!
  root.innerHTML = `
    <div style="
      font-family: monospace;
      font-size: 14pt;
      line-height: 1.4;
      color: #000;
      text-align: left;
      padding: 10px;
    ">
      <div style="text-align: center; font-weight: bold;">
        *** KITCHEN BAR ***
      </div>
      <div>${lineEq}</div>

      <div>Server: ${esc(waiterName || 'Staff')}</div>
      <div>Station 1</div>
      <div style="text-align: center; font-weight: bold; margin: 8px 0;">DINE IN</div>
      
      <div>${esc(dateStr)} &nbsp; ${esc(timeStr)}</div>
      
      <div>${lineEq}</div>

      <div style="font-weight: bold;">Table: ${esc(tableNumber)}</div>
      <div>Guests: 1</div>
      
      <div>${lineDash}</div>

      ${rows}

      <div>${lineDash}</div>
      <br/>
      <div style="font-weight: bold;">Ticket #: ${esc(String(orderId).slice(0, 4))}</div>
      <div>Order #: ${esc(String(orderId).split('-')[0])}</div>

      <div>${lineAst}</div>
      
      <!-- Crucial blank space: forces printer feed so the paper clears the cutter -->
      <br/><br/><br/><br/><br/>
      .
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
      ? `<div>
          ${ings.map(i => `&nbsp;&nbsp;* ${esc(i.name)}: ${esc(i.qty)} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : '';

    return `
    <div style="margin-top: 4px;">
       <div style="font-weight: bold;">${esc(l.quantity)}x ${esc(l.itemName)}</div>
       <div>&nbsp;Price: ${Number(l.price).toLocaleString()} RWF</div>
    </div>
    ${ingText}
  `}).join('');

  const total = Number(order?.total ?? 0).toLocaleString();
  const methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : (paymentMethod === 'POS' ? 'POS/CARD' : 'CASH');
  const waiter = order?.waiterName || 'Staff';

  root.innerHTML = `
    <div style="
      font-family: monospace;
      font-size: 14pt;
      line-height: 1.4;
      color: #000;
      text-align: left;
      padding: 10px;
    ">
      <div style="text-align: center; font-weight: bold;">
        ${esc(shopName ?? "Mama Prince's Coffee")}
      </div>
      <div>${lineEq}</div>

      <div>Server: ${esc(waiter)}</div>
      <div>Method: ${esc(methodLabel)}</div>
      <div style="text-align: center; font-weight: bold; margin: 8px 0;">DINE IN</div>
      
      <div>${esc(dateStr)} &nbsp; ${esc(timeStr)}</div>
      
      <div>${lineEq}</div>

      <div style="font-weight: bold;">Table: ${esc(order?.tableNumber || '1')}</div>
      <div>Guests: 1</div>
      
      <div>${lineDash}</div>

      ${rows}

      <div>${lineDash}</div>
      <br/>
      <div style="font-weight: bold;">TOTAL: ${total} RWF</div>
      <br/>
      <div>${lineAst}</div>
      
      <div style="font-weight: bold;">Ticket #: ${esc(String(order?.id ?? 'NEW').slice(0, 4))}</div>
      <div>Order #: ${esc(String(order?.id ?? 'NEW').split('-')[0])}</div>
      
      <div style="text-align: center; margin-top: 10px;">Thank you!</div>

      <!-- Crucial blank space: forces printer feed so the paper clears the cutter -->
      <br/><br/><br/><br/><br/>
      .
    </div>
  `;

  document.body.appendChild(root);
  withThermalPage(() => {
    window.print();
  });
}