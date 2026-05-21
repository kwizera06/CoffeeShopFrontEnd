// function esc(s) {
//   return String(s)
//     .replaceAll('&', '&amp;')
//     .replaceAll('<', '&lt;')
//     .replaceAll('>', '&gt;')
// }

// /** Injects a temporary @page size rule — 80mm wide, auto tall (thermal roll paper) */
// function withThermalPage(printFn) {
//   const style = document.createElement('style')
//   style.id = 'print-page-override'
//   // margin:0 so the full 80mm is usable; height auto so nothing is cut off
//   style.textContent = `@page { size: 80mm auto; margin: 0; }`
//   document.head.appendChild(style)
//   printFn()
//   const cleanup = () => style.remove()
//   window.addEventListener('afterprint', cleanup, { once: true })
//   setTimeout(cleanup, 30000)
// }

// const lineEq = "==================================================";
// const lineDash = "--------------------------------------------------";
// const lineAst = "**************************************************";

// // ─── KITCHEN TICKET  — 80mm wide, auto height ────────────────────────────────
// export function printKitchenTicket({ orderId, tableNumber, shopName, createdAt, lines, waiterName }) {
//   const root = document.createElement('div')
//   root.id = 'print-root'
  
//   const d = createdAt ? new Date(createdAt) : new Date()
//   const dateStr = d.toLocaleDateString()
//   const timeStr = d.toLocaleTimeString()

//   const rows = lines.map((l) => {
//     const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : []
//     const ingText = ings.length > 0
//       ? `<div style="font-size: 11pt; padding-left: 20px; font-style: italic; text-align: left;">
//           ${ings.map(i => `* ${esc(i.name)}: ${esc(String(i.qty))} ${esc(i.unit || '')}`).join('<br/>')}
//          </div>`
//       : ''

//     return `
//       <div style="display:flex; justify-content:flex-start; gap: 16px; margin: 8px 0 0 0; font-size: 14pt;">
//          <span style="min-width: 24px;">${esc(String(l.quantity))}</span>
//          <span>${esc(l.itemName)}</span>
//       </div>
//       ${ingText}
//     `
//   }).join('')

//   root.innerHTML = `
//     <div style="width:100%; font-family: 'Courier New', Courier, monospace; text-align:center; font-size: 11pt; line-height: 1.3;">
//       <div style="font-size: 14pt; padding: 10px 0;">*** KITCHEN BAR ***</div>
//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>
      
//       <div style="display:flex; justify-content:space-between; text-align:left;">
//         <span>Server: ${esc(waiterName || 'Staff')}</span>
//         <span>Station 1</span>
//       </div>
      
//       <div style="font-size: 20pt; padding: 12px 0; font-weight: normal;">Dine In</div>
      
//       <div style="display:flex; justify-content:space-between; text-align:left;">
//         <span>${esc(dateStr)}</span>
//         <span>${esc(timeStr)}</span>
//       </div>
      
//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>

//       <div style="text-align:left; font-size: 16pt;">Table: ${esc(String(tableNumber))}</div>
//       <div style="text-align:left; font-size: 12pt;">Guests: 1</div>
      
//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

//       <div style="text-align:left; margin: 10px 0;">
//         ${rows}
//       </div>

//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%; margin-top: 20px;">${lineAst}</div>
      
//       <div style="padding: 10px 0;">
//          <div style="font-size: 16pt;">Ticket #: ${esc(String(orderId).slice(0, 4))}</div>
//          <div style="font-size: 12pt;">Order #: ${esc(String(orderId).split('-')[0])}</div>
//       </div>

//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineAst}</div>
//     </div>
//   `

//   document.body.appendChild(root)
//   withThermalPage(() => {
//     requestAnimationFrame(() => {
//       window.print()
//       root.remove()
//     })
//   })
// }

// // ─── PAYMENT RECEIPT — 80mm wide, auto height ────────────────────────────────
// export function printReceipt({ shopName, order, paymentMethod }) {
//   const root = document.createElement('div')
//   root.id = 'print-root'
  
//   const d = order?.createdAt ? new Date(order.createdAt) : new Date()
//   const dateStr = d.toLocaleDateString()
//   const timeStr = d.toLocaleTimeString()

//   const rows = (order?.lines ?? []).map((l) => {
//     const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : []
//     const ingText = ings.length > 0
//       ? `<div style="font-size: 11pt; padding-left: 32px; font-style: italic; text-align: left;">
//           ${ings.map(i => `* ${esc(i.name)}: ${esc(String(i.qty))} ${esc(i.unit || '')}`).join('<br/>')}
//          </div>`
//       : ''

//     return `
//     <div style="display:flex; justify-content:space-between; margin: 6px 0 0 0; font-size: 12pt;">
//        <div style="display:flex; gap: 12px; max-width: 65%;">
//           <span style="min-width: 20px;">${esc(String(l.quantity))}</span>
//           <span style="word-wrap:break-word;">${esc(l.itemName)}</span>
//        </div>
//        <div>${Number(l.price).toLocaleString()}</div>
//     </div>
//     ${ingText}
//   `}).join('')

//   const total = Number(order?.total ?? 0).toLocaleString()
//   const methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : (paymentMethod === 'POS' ? 'POS/CARD' : 'CASH')
//   const waiter = order?.waiterName || 'Staff'

//   root.innerHTML = `
//     <div style="width:100%; font-family: 'Courier New', Courier, monospace; text-align:center; font-size: 11pt; line-height: 1.3;">
//       <div style="font-size: 14pt; padding: 10px 0;">*** ${esc(shopName ?? "Mama Prince's Coffee")} ***</div>
//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>
      
//       <div style="display:flex; justify-content:space-between; text-align:left;">
//         <span>Server: ${esc(waiter)}</span>
//         <span>${esc(methodLabel)}</span>
//       </div>
      
//       <div style="font-size: 20pt; padding: 12px 0; font-weight: normal;">Dine In</div>
      
//       <div style="display:flex; justify-content:space-between; text-align:left;">
//         <span>${esc(dateStr)}</span>
//         <span>${esc(timeStr)}</span>
//       </div>
      
//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>

//       <div style="text-align:left; font-size: 16pt;">Table: ${esc(String(order?.tableNumber || '1'))}</div>
//       <div style="text-align:left; font-size: 12pt;">Guests: 1</div>
      
//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

//       <div style="text-align:left; margin: 10px 0;">
//         ${rows}
//       </div>

//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

//       <div style="display:flex; justify-content:space-between; font-size: 14pt; font-weight:bold; margin-top: 10px;">
//          <span>TOTAL RWF</span>
//          <span>${total}</span>
//       </div>

//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%; margin-top: 20px;">${lineAst}</div>
      
//       <div style="padding: 10px 0;">
//          <div style="font-size: 16pt;">Ticket #: ${esc(String(order?.id ?? 'NEW').slice(0, 4))}</div>
//          <div style="font-size: 12pt;">Order #: ${esc(String(order?.id ?? 'NEW').split('-')[0])}</div>
//       </div>

//       <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineAst}</div>
//     </div>
//   `

//   document.body.appendChild(root)
//   withThermalPage(() => {
//     requestAnimationFrame(() => {
//       window.print()
//       root.remove()
//     })
//   })
// }
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
  style.textContent = `
    @page { size: 80mm auto; margin: 0; }
    @media print {
      body > *:not(#print-root) { display: none !important; }
      #print-root {
        display: block !important;
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 80mm !important;
        max-width: 80mm !important;
        margin: 0 !important;
        padding: 0 0 30mm 0 !important; /* Huge bottom padding to feed paper past cutter */
      }
    }
  `
  document.head.appendChild(style)
  printFn()
  const cleanup = () => style.remove()
  window.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(cleanup, 30000)
}

const lineEq = "==================================================";
const lineDash = "--------------------------------------------------";
const lineAst = "**************************************************";

// ─── KITCHEN TICKET  — 80mm wide, auto height ────────────────────────────────
export function printKitchenTicket({ orderId, tableNumber, shopName, createdAt, lines, waiterName }) {
  const root = document.createElement('div')
  root.id = 'print-root'

  const d = createdAt ? new Date(createdAt) : new Date()
  const dateStr = d.toLocaleDateString()
  const timeStr = d.toLocaleTimeString()

  const rows = lines.map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : []
    const ingText = ings.length > 0
      ? `<div style="font-size: 12pt; padding-left: 30px; font-style: italic; text-align: left; font-weight: bold; margin-bottom: 8px;">
          ${ings.map(i => `• ${esc(i.name)}: ${esc(String(i.qty))} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : ''

    return `
      <div style="display:flex; justify-content:flex-start; gap: 16px; margin: 8px 0 0 0; font-size: 14pt;">
         <span style="min-width: 24px;">${esc(String(l.quantity))}</span>
         <span style="word-break: break-word;">${esc(l.itemName)}</span>
      </div>
      ${ingText}
    `
  }).join('')

  // KEY FIX: width is set to 72mm (80mm minus ~4mm margin each side) on the
  // content div itself. This means text wraps at the correct thermal width
  // regardless of what page size the printer driver forces.
  root.innerHTML = `
    <div style="
      width: 72mm;
      max-width: 72mm;
      font-family: 'Courier New', Courier, monospace;
      text-align: center;
      font-size: 11pt;
      line-height: 1.3;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
      overflow-wrap: break-word;
      word-break: break-word;
      margin: 0 auto;
    ">
      <div style="font-size: 14pt; padding: 10px 0;">*** KITCHEN BAR ***</div>
      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>

      <div style="display:flex; justify-content:space-between; text-align:left;">
        <span>Server: ${esc(waiterName || 'Staff')}</span>
        <span>Station 1</span>
      </div>

      <div style="font-size: 20pt; padding: 12px 0; font-weight: normal;">Dine In</div>

      <div style="display:flex; justify-content:space-between; text-align:left;">
        <span>${esc(dateStr)}</span>
        <span>${esc(timeStr)}</span>
      </div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>

      <div style="text-align:left; font-size: 16pt;">Table: ${esc(String(tableNumber))}</div>
      <div style="text-align:left; font-size: 12pt;">Guests: 1</div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

      <div style="text-align:left; margin: 10px 0;">
        ${rows}
      </div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%; margin-top: 20px;">${lineAst}</div>

      <div style="padding: 10px 0;">
         <div style="font-size: 16pt;">Ticket #: ${esc(String(orderId).slice(0, 4))}</div>
         <div style="font-size: 12pt;">Order #: ${esc(String(orderId).split('-')[0])}</div>
      </div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineAst}</div>
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

  const d = order?.createdAt ? new Date(order.createdAt) : new Date()
  const dateStr = d.toLocaleDateString()
  const timeStr = d.toLocaleTimeString()

  const rows = (order?.lines ?? []).map((l) => {
    const ings = Array.isArray(l.ingredients) ? l.ingredients.filter(i => i.name) : []
    const ingText = ings.length > 0
      ? `<div style="font-size: 11pt; padding-left: 32px; font-style: italic; text-align: left;">
          ${ings.map(i => `* ${esc(i.name)}: ${esc(String(i.qty))} ${esc(i.unit || '')}`).join('<br/>')}
         </div>`
      : ''

    return `
    <div style="display:flex; justify-content:space-between; margin: 6px 0 0 0; font-size: 12pt;">
       <div style="display:flex; gap: 12px; max-width: 65%;">
          <span style="min-width: 20px;">${esc(String(l.quantity))}</span>
          <span style="word-wrap:break-word; word-break: break-word;">${esc(l.itemName)}</span>
       </div>
       <div>${Number(l.price).toLocaleString()}</div>
    </div>
    ${ingText}
  `}).join('')

  const total = Number(order?.total ?? 0).toLocaleString()
  const methodLabel = paymentMethod === 'MOBILE_MONEY' ? 'MOMO' : (paymentMethod === 'POS' ? 'POS/CARD' : 'CASH')
  const waiter = order?.waiterName || 'Staff'

  // KEY FIX: same 72mm constraint here
  root.innerHTML = `
    <div style="
      width: 72mm;
      max-width: 72mm;
      font-family: 'Courier New', Courier, monospace;
      text-align: center;
      font-size: 11pt;
      line-height: 1.3;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
      overflow-wrap: break-word;
      word-break: break-word;
      margin: 0 auto;
    ">
      <div style="font-size: 14pt; padding: 10px 0;">*** ${esc(shopName ?? "Mama Prince's Coffee")} ***</div>
      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>

      <div style="display:flex; justify-content:space-between; text-align:left;">
        <span>Server: ${esc(waiter)}</span>
        <span>${esc(methodLabel)}</span>
      </div>

      <div style="font-size: 20pt; padding: 12px 0; font-weight: normal;">Dine In</div>

      <div style="display:flex; justify-content:space-between; text-align:left;">
        <span>${esc(dateStr)}</span>
        <span>${esc(timeStr)}</span>
      </div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineEq}</div>

      <div style="text-align:left; font-size: 16pt;">Table: ${esc(String(order?.tableNumber || '1'))}</div>
      <div style="text-align:left; font-size: 12pt;">Guests: 1</div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

      <div style="text-align:left; margin: 10px 0;">
        ${rows}
      </div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineDash}</div>

      <div style="display:flex; justify-content:space-between; font-size: 14pt; font-weight:bold; margin-top: 10px;">
         <span>TOTAL RWF</span>
         <span>${total}</span>
      </div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%; margin-top: 20px;">${lineAst}</div>

      <div style="padding: 10px 0;">
         <div style="font-size: 16pt;">Ticket #: ${esc(String(order?.id ?? 'NEW').slice(0, 4))}</div>
         <div style="font-size: 12pt;">Order #: ${esc(String(order?.id ?? 'NEW').split('-')[0])}</div>
      </div>

      <div style="overflow:hidden; white-space:nowrap; letter-spacing: -1px; width:100%;">${lineAst}</div>
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