function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function printKitchenTicket({ orderId, tableNumber, shopName, createdAt, lines }) {
  const root = document.createElement('div')
  root.id = 'print-root'
  root.className = 'thermal-ticket'
  const time = createdAt ? new Date(createdAt).toLocaleString() : new Date().toLocaleString()
  const rows = lines
    .map(
      (l) =>
        `<tr><td style="padding: 2px 0">${esc(l.itemName)}</td><td style="text-align:right">x${esc(String(l.quantity))}</td></tr>`,
    )
    .join('')
  root.innerHTML = `
    <div style="text-align:center">
      <div style="font-weight:900;font-size:16pt">KITCHEN TICKET</div>
      <div style="font-size:10pt;margin:5px 0">Table: <span style="font-size:18pt;font-weight:900">${esc(String(tableNumber))}</span></div>
      <div style="font-size:9pt">Order #${esc(String(orderId).slice(0, 8))} · ${esc(time)}</div>
      <hr/>
      <table style="width:100%;border-collapse:collapse;font-size:12pt;font-weight:700">
        <thead>
          <tr style="border-bottom:1px solid black">
            <th style="text-align:left">ITEM</th>
            <th style="text-align:right">QTY</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr/>
    </div>
  `
  document.body.appendChild(root)
  requestAnimationFrame(() => {
    window.print()
    root.remove()
  })
}

export function printReceipt({ shopName, order, paymentMethod }) {
  const root = document.createElement('div')
  root.id = 'print-root'
  root.className = 'thermal-ticket'
  const time = order?.createdAt
    ? new Date(order.createdAt).toLocaleString()
    : new Date().toLocaleString()
  const rows = (order?.lines ?? [])
    .map(
      (l) => `
      <tr>
        <td style="padding: 2px 0">${esc(l.itemName)}</td>
        <td style="text-align:center">${esc(String(l.quantity))}</td>
        <td style="text-align:right">${Number(l.price).toFixed(2)}</td>
      </tr>`,
    )
    .join('')
  const total = Number(order?.total ?? 0).toFixed(2)
  const methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : 'CASH'
  root.innerHTML = `
    <div style="text-align:center">
      <div style="font-weight:900;font-size:16pt">${esc(shopName ?? 'Coffee shop')}</div>
      <div style="font-size:9pt">${esc(time)}</div>
      <div style="font-size:10pt;margin:5px 0">Order #${esc(String(order?.id ?? '').slice(0, 8))} · Tbl ${esc(
        String(order?.tableNumber ?? ''),
      )}</div>
      <hr/>
      <table style="width:100%;border-collapse:collapse;font-size:10pt">
        <thead>
          <tr style="border-bottom:1px solid black">
            <th style="text-align:left">Item</th>
            <th style="width:30px">Qty</th>
            <th style="text-align:right;width:60px">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr/>
      <div style="display:flex;justify-content:space-between;font-size:12pt;font-weight:900">
        <span>TOTAL</span><span>${total}</span></div>
      <div style="margin-top:10px;text-align:left;font-size:10pt">Paid: <strong>${esc(methodLabel)}</strong></div>
      <div style="margin-top:20px;font-style:italic">Thank you for your visit!</div>
    </div>
  `
  document.body.appendChild(root)
  requestAnimationFrame(() => {
    window.print()
    root.remove()
  })
}
