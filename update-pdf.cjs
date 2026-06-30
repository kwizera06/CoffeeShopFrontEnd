const fs = require('fs');
const file = 'c:/Users/hp/Desktop/Olitech CoffeeShop/CoffeeShop_Frontend/src/pages/shop/Owner.jsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const newPdfCode = `      // ── HEADER ─────────────────────────────────────────────────
      doc.setFillColor(...BLUE)
      doc.rect(0, 0, 210, 36, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text((context?.name || 'OLITECH COFFEE SHOP').toUpperCase(), 105, 14, { align: 'center' })
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(14)
      doc.text(title, 105, 23, { align: 'center' })
      doc.setFontSize(12)
      doc.text(\`Period: \${dateRange}\`, 105, 30, { align: 'center' })

      doc.setTextColor(120)
      doc.setFontSize(10)
      doc.text(\`Generated: \${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Kigali' })}\`, 14, 44)
      doc.text(\`Shifts included: \${shiftsList.length}\`, 196, 44, { align: 'right' })

      y = 52;

      // ── SECTION 1: MONEY RECONCILIATION ────────────────────────
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLUE)
      doc.text('1. MONEY RECONCILIATION', 14, y)
      y += 6

      const reconBody = [
        [{ content: 'CASH', colSpan: 3, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 13 } }],
        ['Opening Balance',                 f(agg.initial_cash),          ''],
        ['Sales Collected',                 f(agg.total_cash_sales),      ''],
        ['Expenses Paid Out',          \`- \${f(agg.expenses)}\`,            ''],
        ['Expected Closing',                f(expectedCash),              'System'],
        ['Actual Counted',                  f(agg.actual_cash_on_hand),   'Cashier'],
        ['Variance',                        f(diffCash),                  diffCash === 0 ? '✓ Balanced' : '⚠ MISMATCH'],
        [{ content: 'MOBILE MONEY (MOMO)', colSpan: 3, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 13 } }],
        ['Opening Balance',                 f(agg.initial_momo),          ''],
        ['Sales Received',                  f(agg.total_momo_sales),      ''],
        ['Transferred to Owner',       \`- \${f(agg.cashout)}\`,            ''],
        ['Actual Phone Balance',            f(agg.actual_momo_on_hand),   'Cashier'],
        [{ content: 'CARD (POS) & LOANS', colSpan: 3, styles: { halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 13 } }],
        ['POS / CARD — Total Sales',        f(agg.total_pos_sales),       ''],
        ['LOANS — Credits Issued',          f(agg.total_loan_sales),      ''],
        ['LOANS — Repayments Received',     f(agg.total_loan_repayments), ''],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Description', 'Amount (RWF)', 'Note']],
        body: reconBody,
        theme: 'grid',
        headStyles: { fillColor: BLUE, fontSize: 12, fontStyle: 'bold', textColor: 255 },
        styles: { fontSize: 12, cellPadding: 4 },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const label = String(data.row.cells[0]?.raw || '')
          
          if (data.row.cells.length === 1) return; // Skip subheaders

          const isVariance = label.includes('Variance')
          const isMismatch = (label.includes('Variance') && diffCash !== 0)
          const isBalanced = (label.includes('Variance') && diffCash === 0)
          
          if (isMismatch) {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = [255, 240, 240]
          } else if (isBalanced) {
            data.cell.styles.textColor = GREEN
            data.cell.styles.fontStyle = 'bold'
          } else if (label.includes('Expected') || label.includes('Actual') || label.includes('Phone')) {
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })
      y = doc.lastAutoTable.finalY + 12

      // ── SECTION 2: ALL CURRENT STOCK ───────────────────────────
      newPageIfNeeded(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLUE)
      doc.text('2. CURRENT STOCK LEVELS', 14, y)
      y += 6

      const stockBody = stockItems.map(item => {
        const status = getItemStockStatus(item)
        return [
          item.name,
          item.category,
          item.itemType === 'INGREDIENT' ? 'Ingredient' : 'Product',
          \`\${item.stock} \${item.unit || 'pcs'}\`,
          item.minThreshold > 0 ? \`\${item.minThreshold} \${item.unit || 'pcs'}\` : '—',
          status,
        ]
      })

      autoTable(doc, {
        startY: y,
        head: [['Name', 'Category', 'Type', 'In Stock', 'Min Level', 'Status']],
        body: stockBody,
        theme: 'grid',
        headStyles: { fillColor: BLUE, fontSize: 12, fontStyle: 'bold', textColor: 255 },
        styles: { fontSize: 12, cellPadding: 3 },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 5) return
          const val = String(data.cell.raw || '')
          if (val === 'CRITICAL') {
            data.cell.styles.textColor = RED
            data.cell.styles.fontStyle = 'bold'
          } else if (val === 'LOW') {
            data.cell.styles.textColor = [217, 119, 6]
            data.cell.styles.fontStyle = 'bold'
          } else if (val === 'HEALTHY') {
            data.cell.styles.textColor = GREEN
          }
        }
      })
      y = doc.lastAutoTable.finalY + 12

      // ── SECTION 3: LOANS & CREDITS ─────────────────────────────
      newPageIfNeeded(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...BLUE)
      doc.text('3. CREDIT & LOANS ACTIVITY', 14, y)
      y += 6

      const loanSummaryBody = [
        ['New Credits Issued (count)',    String(loansIssued.length),  ''],
        ['Total Amount Issued',           f(totalIssued),              ''],
        ['Repayments Collected (count)',  String(loansRepaid.length),  ''],
        ['Total Amount Repaid',           f(totalRepaid),              ''],
        ['Net Outstanding Change',
          \`\${totalIssued - totalRepaid >= 0 ? '+' : ''}\${f(totalIssued - totalRepaid)}\`,
          totalIssued - totalRepaid > 0 ? 'Debt Increased' : totalIssued - totalRepaid < 0 ? 'Debt Reduced' : 'No Change'],
      ]

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value', 'Note']],
        body: loanSummaryBody,
        theme: 'grid',
        headStyles: { fillColor: BLUE, fontSize: 12, fontStyle: 'bold', textColor: 255 },
        styles: { fontSize: 12, cellPadding: 4 },
        margin: { left: 14, right: 14 },
        didParseCell: (data) => {
          if (data.section !== 'body') return
          const label = String(data.row.cells[0]?.raw || '')
          if (label.includes('Net Outstanding')) {
            const netVal = totalIssued - totalRepaid
            data.cell.styles.fontStyle = 'bold'
            if (netVal > 0) data.cell.styles.textColor = RED
            else if (netVal < 0) data.cell.styles.textColor = GREEN
          }
        }
      })
      y = doc.lastAutoTable.finalY + 8

      // Detailed loans issued (if any)
      if (loansIssued.length > 0) {
        newPageIfNeeded(30)
        y += 2
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(12)
        doc.setTextColor(80)
        doc.text('Credits Issued This Period:', 14, y)
        y += 6
        autoTable(doc, {
          startY: y,
          head: [['Client Name', 'Amount', 'Status']],
          body: loansIssued.map(l => [l.name, f(l.amount), l.status]),
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], fontSize: 12, textColor: 255 },
          styles: { fontSize: 12, cellPadding: 3 },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 8
      }

      if (loansRepaid.length > 0) {
        newPageIfNeeded(30)
        y += 2
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(12)
        doc.setTextColor(80)
        doc.text('Repayments Collected This Period:', 14, y)
        y += 6
        autoTable(doc, {
          startY: y,
          head: [['Client Name', 'Amount Paid', 'Method']],
          body: loansRepaid.map(r => [r.name, f(r.amount), r.method]),
          theme: 'grid',
          headStyles: { fillColor: [71, 85, 105], fontSize: 12, textColor: 255 },
          styles: { fontSize: 12, cellPadding: 3 },
          margin: { left: 14, right: 14 },
        })
        y = doc.lastAutoTable.finalY + 8
      }`;

const newLines = [
  ...lines.slice(0, 2813),
  newPdfCode,
  ...lines.slice(3043)
];

fs.writeFileSync(file, newLines.join('\n'));
console.log('Update successful!');
