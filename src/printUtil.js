function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/** Injects a temporary @page size rule — 80mm wide, auto tall (thermal roll paper) */
function withThermalPage(printFn) {
  const style = document.createElement('style')
  style.id = 'print-page-override'
  // margin:0 so the full 80mm is usable; height auto so nothing is cut off
  style.textContent = `@page { size: 80mm auto; margin: 0; }`
  document.head.appendChild(style)
  printFn()
  const cleanup = () => style.remove()
  window.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(cleanup, 30000)
}

// ─── KITCHEN TICKET  — 80mm wide, auto height ────────────────────────────────
export function printKitchenTicket({ orderId, tableNumber, shopName, createdAt, lines, waiterName }) {
  const root = document.createElement('div')
  root.id = 'print-root'
  const time = createdAt ? new Date(createdAt).toLocaleString() : new Date().toLocaleString()

  const rows = lines.map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : []
    const ingNote = ings.length > 0
      ? `<tr>
           <td colspan="2" style="padding:2px 0 6px 8px;font-size:10pt;color:#222;word-wrap:break-word;">
             ${ings.map(i => `&#x25B8; ${esc(i.name)}: ${esc(String(i.qty))}${esc(i.unit || '')}`).join('<br/>')}
           </td>
         </tr>`
      : ''
    return `<tr style="border-top:1px dotted #ccc">
      <td style="padding:5px 2px 2px;font-size:12pt;font-weight:700;word-wrap:break-word">${esc(l.itemName)}</td>
      <td style="text-align:right;font-size:12pt;font-weight:700;vertical-align:top;white-space:nowrap;padding:5px 0 2px 4px">x${esc(String(l.quantity))}</td>
    </tr>${ingNote}`
  }).join('')

  root.innerHTML = `
    <div style="width:100%;font-family:'Courier New',Courier,monospace;text-align:center">
      <div style="font-weight:900;font-size:15pt;letter-spacing:3px;text-transform:uppercase">KITCHEN</div>
      <div style="font-size:10pt;margin:2px 0">Table</div>
      <div style="font-size:28pt;font-weight:900;line-height:1">${esc(String(tableNumber))}</div>
      <div style="font-size:8pt;margin:4px 0;font-weight:700">Server: ${esc(waiterName || 'Staff')}</div>
      <div style="font-size:8.5pt;margin:4px 0">#${esc(String(orderId).slice(0, 8))} &nbsp; ${esc(time)}</div>
      <hr style="border:none;border-top:2px solid #000;margin:5px 0"/>
      <table style="width:100%;border-collapse:collapse;text-align:left">
        <thead>
          <tr>
            <th style="font-size:10pt;font-weight:700;padding-bottom:3px;border-bottom:2px solid #000;text-align:left">ITEM</th>
            <th style="font-size:10pt;font-weight:700;padding-bottom:3px;border-bottom:2px solid #000;text-align:right">QTY</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:none;border-top:2px solid #000;margin:5px 0"/>
      ${lines.some(l => l.ingredients?.length > 0)
        ? '<div style="font-size:8pt;font-style:italic;text-align:center">&#x25B8; = ingredient qty per portion</div>'
        : ''}
    </div>
  `

  document.body.appendChild(root)
  withThermalPage(() => {
    requestAnimationFrame(() => {
      window.print()
      root.remove()
    })
  })
}

// ─── PAYMENT RECEIPT — 80mm wide, auto height ────────────────────────────────
export function printReceipt({ shopName, order, paymentMethod }) {
  const root = document.createElement('div')
  root.id = 'print-root'
  const time = order?.createdAt
    ? new Date(order.createdAt).toLocaleString()
    : new Date().toLocaleString()

  const rows = (order?.lines ?? []).map((l) => `
    <tr style="border-top:1px dotted #ccc">
      <td style="padding:4px 2px;font-size:11pt;word-wrap:break-word">${esc(l.itemName)}</td>
      <td style="text-align:center;white-space:nowrap;padding:4px 3px;font-size:11pt">${esc(String(l.quantity))}</td>
      <td style="text-align:right;white-space:nowrap;padding:4px 0;font-size:11pt;font-weight:600">${Number(l.price).toLocaleString()}</td>
    </tr>`).join('')

  const total = Number(order?.total ?? 0).toLocaleString()
  const methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : (paymentMethod === 'POS' ? 'POS/CARD' : 'CASH')
  const waiter = order?.waiterName || 'Staff'

  root.innerHTML = `
    <div style="width:100%;font-family:'Courier New',Courier,monospace;text-align:center">
      <div style="font-weight:900;font-size:16pt;letter-spacing:1px">${esc(shopName ?? 'Coffee Shop')}</div>
      <div style="font-size:9pt;margin:3px 0">${esc(time)}</div>
      <div style="font-size:10pt">Order #${esc(String(order?.id ?? '').slice(0, 8))} &nbsp;·&nbsp; Table ${esc(String(order?.tableNumber ?? ''))}</div>
      <div style="font-size:9pt;margin:2px 0">Server: ${esc(waiter)}</div>
      <hr style="border:none;border-top:2px solid #000;margin:5px 0"/>
      <table style="width:100%;border-collapse:collapse;text-align:left">
        <thead>
          <tr>
            <th style="font-size:10pt;padding-bottom:3px;border-bottom:2px solid #000;text-align:left">Item</th>
            <th style="font-size:10pt;padding-bottom:3px;border-bottom:2px solid #000;text-align:center;white-space:nowrap">Qty</th>
            <th style="font-size:10pt;padding-bottom:3px;border-bottom:2px solid #000;text-align:right;white-space:nowrap">RWF</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:none;border-top:2px solid #000;margin:5px 0"/>
      <div style="display:flex;justify-content:space-between;font-size:14pt;font-weight:900;padding:2px 0">
        <span>TOTAL</span><span>${total} RWF</span>
      </div>
      <div style="margin-top:5px;text-align:left;font-size:11pt">Payment: <strong>${esc(methodLabel)}</strong></div>
      <hr style="border:none;border-top:1px dashed #000;margin:8px 0"/>
      <div style="font-size:10pt;font-style:italic">Thank you for your visit!</div>
    </div>
  `

  document.body.appendChild(root)
  withThermalPage(() => {
    requestAnimationFrame(() => {
      window.print()
      root.remove()
    })
  })
}
