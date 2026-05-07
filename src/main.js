import "./style.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import QRCode from "qrcode";

const A4_WIDTH_PX = 794;
// Tuned to reduce unused vertical space vs full 96dpi A4 height.
const A4_HEIGHT_PX = 1080;

const BASE = import.meta.env.BASE_URL || "/";

function ordinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDateTimeForPoster(isoStringOrEmpty) {
  if (!isoStringOrEmpty) return "";
  const d = new Date(isoStringOrEmpty);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = d.toLocaleString("en-GB", { month: "short" });
  const yyyy = d.getFullYear();
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const hh12 = ((hours + 11) % 12) + 1;
  return `${dd} ${mm} ${yyyy}\n@${hh12}.${mins} ${ampm}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function")
      node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) node.appendChild(c);
  return node;
}

const state = {
  orgName: "PROJECT SHELTER",
  eventType: "Handing Over Ceremony",
  houseNo: "43",
  beneficiary: "Mrs. Geetha Rajesh",
  address: "New Kudumbi Colony,\nKumaranasan Nagar,\nElamkulam, Kochi,\nKerala",
  dateTime: "",
  qrValue: "",
  phone: "9845811515 / 9448071973",
  email: "info@projectshelter.org.in",
  website: "www.projectshelter.org.in",
  topImageDataUrl: "",
  logoDataUrl: ""
};

function render() {
  const houseNoNum = Number(state.houseNo || 0) || 0;
  const ord = ordinalSuffix(houseNoNum);
  const ordMatch = String(ord).match(/^(\d+)([a-z]+)$/i);
  const ordNumber = ordMatch?.[1] ?? String(houseNoNum || "");
  const ordSuffix = (ordMatch?.[2] ?? "").toUpperCase();

  const titleNode = el("div", { class: "title" }, [
    document.createTextNode(`${state.eventType.toUpperCase()} OF`),
    document.createElement("br"),
    document.createTextNode(`THE ${ordNumber}`),
    el("sup", { text: ordSuffix }),
    document.createTextNode(" HOUSE")
  ]);

  const subtitle = `A HOUSE FOR ${state.beneficiary.toUpperCase()}`;

  document.querySelector("#app").replaceChildren(
    el("div", { class: "shell" }, [
      el("div", { class: "card" }, [
        el("h2", { text: "Event details" }),
        el("div", { class: "form" }, [
          el("div", { class: "row" }, [
            fieldSelect("Event type", "eventType", [
              "Handing Over Ceremony",
              "Foundation Laying Ceremony"
            ]),
            fieldText("House no", "houseNo", "43")
          ]),
          fieldText("Beneficiary name", "beneficiary", "Mrs. Geetha Rajesh"),
          fieldTextarea("Address", "address", "Full address"),
          el("div", { class: "row" }, [
            fieldDatetime("Date & time", "dateTime"),
            fieldText("QR value (maps link)", "qrValue", "https://maps.app.goo.gl/...")
          ]),
          el("div", { class: "row" }, [
            fieldFile("Top photo (optional)", "topImageDataUrl", "image/*"),
            fieldFile("Logo (optional)", "logoDataUrl", "image/*")
          ]),
          el("div", { class: "row" }, [
            fieldText("Phone", "phone", state.phone),
            fieldText("Email", "email", state.email)
          ]),
          fieldText("Website", "website", state.website),
          el("div", { class: "actions" }, [
            el("button", {
              class: "btn",
              id: "btnPng",
              text: "Download PNG (A4)"
            }),
            el("button", {
              class: "btn secondary",
              id: "btnPdf",
              text: "Download PDF (A4)"
            })
          ]),
          el("div", {
            class: "hint",
            text:
              "Tip: paste a Google Maps link into “QR value”. If empty, the QR box will show a placeholder."
          })
        ])
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Preview (A4)" }),
        el("div", { class: "previewWrap" }, [
          el("div", { class: "poster", id: "poster" }, [
            el("div", { class: "topImage" }, [
              state.topImageDataUrl
                ? el("img", { src: state.topImageDataUrl, alt: "Top photo" })
                : el("img", {
                    src: `${BASE}invitation-template.png`,
                    alt: "Template photo"
                  }),
              el("div", { class: "topOverlay" })
            ]),
            el("div", { class: "body" }, [
              el("div", { class: "brandRow" }, [
                el("div", { class: "brandLogo" }, [
                  state.logoDataUrl
                    ? el("img", {
                        class: "brandLogoImg uploadedLogo",
                        src: state.logoDataUrl,
                        alt: "Logo"
                      })
                    : el("img", {
                        class: "brandLogoImg defaultLogo",
                        src: `${BASE}project-shelter-logo.jpg`,
                        alt: "Project Shelter logo"
                      })
                ])
              ]),
              titleNode,
              el("div", { class: "subtitle", text: subtitle }),
              el("div", { class: "details" }, [
                detailCol(
                  "Date & Time",
                  formatDateTimeForPoster(state.dateTime) || "—"
                ),
                detailCol("To Shelter", state.address || "—"),
                qrCol()
              ])
            ]),
            el("div", { class: "footer" }, [
              footerItem(state.phone),
              footerItem(state.email),
              footerItem(state.website)
            ])
          ])
        ])
      ])
    ])
  );

  wireActions();
  refreshQr();

  // Fix poster dimensions (avoid device zoom affecting capture)
  const poster = document.getElementById("poster");
  poster.style.width = `${A4_WIDTH_PX}px`;
  poster.style.height = `${A4_HEIGHT_PX}px`;
}

function detailCol(title, value) {
  return el("div", { class: "detailCol" }, [
    el("h3", { text: title }),
    el("div", { class: "value", text: value })
  ]);
}

function qrCol() {
  return el("div", { class: "detailCol" }, [
    el("h3", { text: "Scan for location" }),
    el("div", { class: "value" }, [
      el("div", { class: "qrBox" }, [
        el("img", {
          id: "qrImg",
          alt: "QR",
          src: ""
        })
      ])
    ])
  ]);
}

function footerItem(text) {
  return el("div", { class: "item" }, [el("span", { class: "dot" }), el("span", { text })]);
}

function fieldText(labelText, key, placeholder = "") {
  return el("label", {}, [
    el("span", { text: labelText }),
    el("input", {
      value: state[key] ?? "",
      placeholder,
      oninput: (e) => {
        state[key] = e.target.value;
        render();
      }
    })
  ]);
}

function fieldTextarea(labelText, key, placeholder = "") {
  return el("label", {}, [
    el("span", { text: labelText }),
    el("textarea", {
      placeholder,
      oninput: (e) => {
        state[key] = e.target.value;
        render();
      }
    }, [document.createTextNode(state[key] ?? "")])
  ]);
}

function fieldSelect(labelText, key, options) {
  const select = el("select", {
    onchange: (e) => {
      state[key] = e.target.value;
      render();
    }
  });
  for (const opt of options) {
    const o = el("option", { value: opt, text: opt });
    if ((state[key] ?? "") === opt) o.selected = true;
    select.appendChild(o);
  }
  return el("label", {}, [el("span", { text: labelText }), select]);
}

function fieldDatetime(labelText, key) {
  return el("label", {}, [
    el("span", { text: labelText }),
    el("input", {
      type: "datetime-local",
      value: state[key] ?? "",
      oninput: (e) => {
        state[key] = e.target.value;
        render();
      }
    })
  ]);
}

function fieldFile(labelText, key, accept = "*/*") {
  return el("label", {}, [
    el("span", { text: labelText }),
    el("input", {
      type: "file",
      accept,
      onchange: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        state[key] = await fileToDataUrl(file);
        render();
      }
    })
  ]);
}

async function fileToDataUrl(file) {
  const reader = new FileReader();
  const p = new Promise((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
  });
  reader.readAsDataURL(file);
  return await p;
}

async function refreshQr() {
  const img = document.getElementById("qrImg");
  if (!img) return;

  const value = (state.qrValue || "").trim();
  if (!value) {
    img.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="190">
          <rect x="0" y="0" width="190" height="190" fill="#fff"/>
          <rect x="6" y="6" width="178" height="178" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
          <text x="95" y="94" text-anchor="middle" font-family="Arial" font-size="12" fill="#64748b">QR goes here</text>
        </svg>`
      );
    return;
  }

  img.src = await QRCode.toDataURL(value, {
    width: 190,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" }
  });
}

async function capturePosterCanvas(posterEl) {
  const cloneHost = document.createElement("div");
  cloneHost.style.position = "fixed";
  cloneHost.style.left = "-10000px";
  cloneHost.style.top = "0";
  cloneHost.style.width = `${A4_WIDTH_PX}px`;
  cloneHost.style.height = `${A4_HEIGHT_PX}px`;
  cloneHost.style.background = "#ffffff";

  const clone = posterEl.cloneNode(true);
  clone.style.transform = "none";
  clone.style.width = `${A4_WIDTH_PX}px`;
  clone.style.height = `${A4_HEIGHT_PX}px`;
  cloneHost.appendChild(clone);
  document.body.appendChild(cloneHost);

  try {
    const imgs = Array.from(clone.querySelectorAll("img"));
    await Promise.all(
      imgs.map(async (img) => {
        try {
          if (img.decode) await img.decode();
          else await new Promise((r) => (img.onload = img.onerror = r));
        } catch {
          // best-effort; html2canvas will still render what it can
        }
      })
    );

    return await html2canvas(clone, { scale: 3, backgroundColor: "#ffffff" });
  } finally {
    cloneHost.remove();
  }
}

function wireActions() {
  const btnPng = document.getElementById("btnPng");
  const btnPdf = document.getElementById("btnPdf");
  const poster = document.getElementById("poster");

  btnPng.addEventListener("click", async () => {
    btnPng.disabled = true;
    btnPdf.disabled = true;
    try {
      const canvas = await capturePosterCanvas(poster);
      canvas.toBlob((blob) => {
        if (!blob) return;
        downloadBlob(blob, `${safeName()}-A4.png`);
      }, "image/png");
    } finally {
      btnPng.disabled = false;
      btnPdf.disabled = false;
    }
  });

  btnPdf.addEventListener("click", async () => {
    btnPng.disabled = true;
    btnPdf.disabled = true;
    try {
      const canvas = await capturePosterCanvas(poster);
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Fit without distortion (preserve aspect ratio)
      const imgW = canvas.width;
      const imgH = canvas.height;
      const scale = Math.min(pageWidth / imgW, pageHeight / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      const x = (pageWidth - w) / 2;
      const y = (pageHeight - h) / 2;
      pdf.addImage(imgData, "PNG", x, y, w, h);
      const blob = pdf.output("blob");
      downloadBlob(blob, `${safeName()}-A4.pdf`);
    } finally {
      btnPng.disabled = false;
      btnPdf.disabled = false;
    }
  });
}

function safeName() {
  const house = (state.houseNo || "").toString().trim() || "house";
  const person = (state.beneficiary || "").trim() || "beneficiary";
  return `${house}-${person}`.replace(/[^\w.-]+/g, "_").slice(0, 80);
}

render();

