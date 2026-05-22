export function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function withThermalPage(printFn) {
  // Remove old print styles
  document
    .querySelectorAll("#print-page-override")
    .forEach((el) => el.remove());

  const style = document.createElement("style");
  style.id = "print-page-override";

  style.textContent = `
    @page {
      margin: 0;
    }

    @media print {

      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }

      body * {
        visibility: hidden;
      }

      #print-root,
      #print-root * {
        visibility: visible;
      }

      #print-root {
        position: absolute;
        left: 0;
        top: 0;
        width: 280px !important;
        max-width: 280px !important;
        margin: 0 auto !important;
        padding: 0 !important;
        color: #000 !important;
        background: #fff !important;
      }
    }
  `;

  document.head.appendChild(style);

  setTimeout(() => {
    printFn();
  }, 150);

  const cleanup = () => {
    style.remove();

    document
      .querySelectorAll("#print-root")
      .forEach((el) => el.remove());
  };

  window.addEventListener("afterprint", cleanup, {
    once: true,
  });
}

// Safe thermal separator lengths
const lineEq = "==============================";
const lineDash = "------------------------------";
const lineAst = "******************************";

export function printKitchenTicket({
  orderId,
  tableNumber,
  shopName,
  createdAt,
  lines,
  waiterName,
}) {
  // Remove previous tickets
  document
    .querySelectorAll("#print-root")
    .forEach((el) => el.remove());

  const root = document.createElement("div");
  root.id = "print-root";

  const d = createdAt
    ? new Date(createdAt)
    : new Date();

  const dateStr = d.toLocaleDateString();
  const timeStr = d.toLocaleTimeString();

  const rows = (lines || [])
    .map((l) => {
      const ings = Array.isArray(l.ingredients)
        ? l.ingredients.filter((i) => i.name)
        : [];

      const ingText =
        ings.length > 0
          ? `
            <div style="margin-left:10px; margin-top:2px;">
              ${ings
                .map(
                  (i) => `
                    <div>
                      • ${esc(i.name)}:
                      ${esc(i.qty)}
                      ${esc(i.unit || "")}
                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : "";

      return `
        <div style="margin-top:8px;">

          <div style="
            font-weight:bold;
            font-size:13px;
            word-break: break-word;
          ">
            ${esc(l.quantity)}x ${esc(l.itemName)}
          </div>

          ${ingText}

        </div>
      `;
    })
    .join("");

  root.innerHTML = `
    <div style="
      width:280px;
      max-width:280px;
      font-family: monospace;
      font-size:12px;
      line-height:1.5;
      color:#000;
      padding:6px;
      box-sizing:border-box;
      white-space:normal;
      overflow-wrap:break-word;
    ">

      <div style="
        text-align:center;
        font-weight:bold;
        font-size:15px;
      ">
        KITCHEN BAR
      </div>

      <div>${lineEq}</div>

      <div>
        <strong>Server:</strong>
      </div>

      <div style="margin-bottom:6px;">
        ${esc(waiterName || "Staff")}
      </div>

      <div>
        <strong>Station:</strong> 1
      </div>

      <div style="
        text-align:center;
        font-weight:bold;
        font-size:14px;
        margin:8px 0;
      ">
        DINE IN
      </div>

      <div>
        <strong>Date:</strong>
        ${esc(dateStr)}
      </div>

      <div>
        <strong>Time:</strong>
        ${esc(timeStr)}
      </div>

      <div>${lineEq}</div>

      <div>
        <strong>Table:</strong>
        ${esc(tableNumber || "1")}
      </div>

      <div>
        <strong>Guests:</strong> 1
      </div>

      <div>${lineDash}</div>

      ${rows}

      <div>${lineDash}</div>

      <br/>

      <div>
        <strong>Ticket #:</strong>
        ${esc(String(orderId || "").slice(0, 4))}
      </div>

      <div>
        <strong>Order #:</strong>
        ${esc(String(orderId || "").split("-")[0])}
      </div>

      <div>${lineAst}</div>

      <div style="height:40px;"></div>

    </div>
  `;

  document.body.appendChild(root);

  withThermalPage(() => {
    window.print();
  });
}

export function printReceipt({
  shopName,
  order,
  paymentMethod,
}) {
  // Remove previous tickets
  document
    .querySelectorAll("#print-root")
    .forEach((el) => el.remove());

  const root = document.createElement("div");
  root.id = "print-root";

  const d = order?.createdAt
    ? new Date(order.createdAt)
    : new Date();

  const dateStr = d.toLocaleDateString();
  const timeStr = d.toLocaleTimeString();

  const rows = (order?.lines || [])
    .map((l) => {
      const ings = Array.isArray(l.ingredients)
        ? l.ingredients.filter((i) => i.name)
        : [];

      const ingText =
        ings.length > 0
          ? `
            <div style="margin-left:10px; margin-top:2px;">
              ${ings
                .map(
                  (i) => `
                    <div>
                      • ${esc(i.name)}:
                      ${esc(i.qty)}
                      ${esc(i.unit || "")}
                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : "";

      return `
        <div style="margin-top:8px;">

          <div style="
            font-weight:bold;
            font-size:13px;
            word-break: break-word;
          ">
            ${esc(l.quantity)}x ${esc(l.itemName)}
          </div>

          <div>
            Price:
            ${Number(l.price || 0).toLocaleString()} RWF
          </div>

          ${ingText}

        </div>
      `;
    })
    .join("");

  const total = Number(order?.total || 0).toLocaleString();

  const methodLabel =
    paymentMethod === "MOBILE_MONEY"
      ? "MOMO"
      : paymentMethod === "POS"
      ? "POS/CARD"
      : "CASH";

  const waiter =
    order?.waiterName || "Staff";

  root.innerHTML = `
    <div style="
      width:280px;
      max-width:280px;
      font-family: monospace;
      font-size:12px;
      line-height:1.5;
      color:#000;
      padding:6px;
      box-sizing:border-box;
      white-space:normal;
      overflow-wrap:break-word;
    ">

      <div style="
        text-align:center;
        font-weight:bold;
        font-size:15px;
      ">
        ${esc(shopName || "Coffee Shop")}
      </div>

      <div>${lineEq}</div>

      <div>
        <strong>Server:</strong>
      </div>

      <div style="margin-bottom:6px;">
        ${esc(waiter)}
      </div>

      <div>
        <strong>Payment:</strong>
        ${esc(methodLabel)}
      </div>

      <div style="
        text-align:center;
        font-weight:bold;
        font-size:14px;
        margin:8px 0;
      ">
        DINE IN
      </div>

      <div>
        <strong>Date:</strong>
        ${esc(dateStr)}
      </div>

      <div>
        <strong>Time:</strong>
        ${esc(timeStr)}
      </div>

      <div>${lineEq}</div>

      <div>
        <strong>Table:</strong>
        ${esc(order?.tableNumber || "1")}
      </div>

      <div>
        <strong>Guests:</strong> 1
      </div>

      <div>${lineDash}</div>

      ${rows}

      <div>${lineDash}</div>

      <br/>

      <div style="
        font-weight:bold;
        font-size:14px;
      ">
        TOTAL:
        ${total} RWF
      </div>

      <br/>

      <div>
        <strong>Ticket #:</strong>
        ${esc(String(order?.id || "NEW").slice(0, 4))}
      </div>

      <div>
        <strong>Order #:</strong>
        ${esc(String(order?.id || "NEW").split("-")[0])}
      </div>

      <div>${lineAst}</div>

      <div style="
        text-align:center;
        margin-top:10px;
        font-weight:bold;
      ">
        Thank You!
      </div>

      <div style="height:40px;"></div>

    </div>
  `;

  document.body.appendChild(root);

  withThermalPage(() => {
    window.print();
  });
}