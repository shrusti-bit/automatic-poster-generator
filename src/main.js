import "./style.css";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import QRCode from "qrcode";

const A4_WIDTH_PX = 794;
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
  logoDataUrl: "",
  openingLabel: "Opening by",
  guestName: "Chandy Oommen, MLA",
  collaborationPartner: "House Challenge",
  partnerLogoDataUrl: ""
};

function escapeAttrValue(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function projectShelterLogo() {
  if (state.logoDataUrl) {
    return el("img", {
      class: "brandLogoImg uploadedLogo",
      src: state.logoDataUrl,
      alt: "Logo"
    });
  }
  return el("img", {
    class: "brandLogoImg defaultLogo",
    src: `${BASE}project-shelter-logo.jpg`,
    alt: "Project Shelter logo"
  });
}

function partnerLogo() {
  if (state.partnerLogoDataUrl) {
    return el("img", {
      class: "brandLogoImg partnerLogoImg",
      src: state.partnerLogoDataUrl,
      alt: "Partner logo"
    });
  }
  return el("div", { class: "partnerLogoPlaceholder", text: "Partner logo" });
}

function buildTitleNode(ordNumber, ordSuffix) {
  return el("div", { class: "title" }, [
    document.createTextNode(`${state.eventType.toUpperCase()} OF`),
    document.createElement("br"),
    document.createTextNode(`THE ${ordNumber}`),
    el("sup", { text: ordSuffix }),
    document.createTextNode(" HOUSE")
  ]);
}

function buildPoster(variant, qrImgId) {
  const houseNoNum = Number(state.houseNo || 0) || 0;
  const ord = ordinalSuffix(houseNoNum);
  const ordMatch = String(ord).match(/^(\d+)([a-z]+)$/i);
  const ordNumber = ordMatch?.[1] ?? String(houseNoNum || "");
  const ordSuffix = (ordMatch?.[2] ?? "").toUpperCase();
  const subtitle = `A HOUSE FOR ${state.beneficiary.toUpperCase()}`;

  const brandRow =
    variant === 2
      ? el("div", { class: "brandRow brandRowDual" }, [
          el("div", { class: "brandLogo brandLogoHalf brandLogoPrimary" }, [projectShelterLogo()]),
          el("div", { class: "brandLogo brandLogoHalf brandLogoPartner" }, [partnerLogo()])
        ])
      : el("div", { class: "brandRow" }, [
          el("div", { class: "brandLogo" }, [projectShelterLogo()])
        ]);

  const bodyChildren = [
    brandRow,
    buildTitleNode(ordNumber, ordSuffix)
  ];

  if (variant === 2) {
    bodyChildren.push(
      el("div", { class: "openingBlock" }, [
        el("div", { class: "openingLabel", text: state.openingLabel || "Opening by" }),
        el("div", { class: "openingGuest", text: state.guestName || "—" })
      ])
    );
  }

  bodyChildren.push(el("div", { class: "subtitle", text: subtitle }));

  if (variant === 2 && (state.collaborationPartner || "").trim()) {
    bodyChildren.push(
      el("div", {
        class: "collaboration",
        text: `in collaboration with ${state.collaborationPartner.trim()}`
      })
    );
  }

  bodyChildren.push(
    el("div", { class: "details" }, [
      detailCol("Date & Time", formatDateTimeForPoster(state.dateTime) || "—"),
      detailCol("To Shelter", state.address || "—"),
      qrCol(qrImgId)
    ])
  );

  return el("div", {
    class: variant === 2 ? "poster poster-page2" : "poster",
    id: variant === 1 ? "poster" : "poster2"
  }, [
    el("div", { class: "topImage" }, [
      state.topImageDataUrl
        ? el("img", { src: state.topImageDataUrl, alt: "House photo" })
        : el("img", {
            src: `${BASE}house-placeholder.svg`,
            alt: "House placeholder"
          }),
      el("div", { class: "topOverlay" })
    ]),
    el("div", { class: "body" }, bodyChildren),
    el("div", { class: "footer" }, [
      footerItem(state.phone),
      footerItem(state.email),
      footerItem(state.website)
    ])
  ]);
}

function render() {
  const active = document.activeElement;
  const activeKey = active?.getAttribute?.("data-key") || "";
  const canRestoreSelection =
    active && typeof active.selectionStart === "number" && typeof active.selectionEnd === "number";
  const selectionStart = canRestoreSelection ? active.selectionStart : null;
  const selectionEnd = canRestoreSelection ? active.selectionEnd : null;

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
            fieldFile("House photo (optional)", "topImageDataUrl", "image/*"),
            fieldFile("Logo (optional)", "logoDataUrl", "image/*")
          ]),
          el("div", { class: "row" }, [
            fieldText("Phone", "phone", state.phone),
            fieldText("Email", "email", state.email)
          ]),
          fieldText("Website", "website", state.website),
          el("div", { class: "formSectionTitle", text: "Page 2 extras" }),
          el("div", { class: "row" }, [
            fieldText("Opening label", "openingLabel", "Opening by"),
            fieldText("Guest name", "guestName", "Chandy Oommen, MLA")
          ]),
          fieldText("Collaboration partner", "collaborationPartner", "House Challenge"),
          fieldFile("Partner logo (Page 2)", "partnerLogoDataUrl", "image/*"),
          el("div", { class: "actions" }, [
            el("button", {
              class: "btn",
              id: "btnPng1",
              text: "Download Page 1 PNG"
            }),
            el("button", {
              class: "btn secondary",
              id: "btnPng2",
              text: "Download Page 2 PNG"
            }),
            el("button", {
              class: "btn",
              id: "btnPdf",
              text: "Download PDF (2 pages)"
            })
          ]),
          el("div", {
            class: "hint",
            text:
              "Page 1 is the standard poster. Page 2 adds the guest, collaboration line, and partner logo."
          })
        ])
      ]),
      el("div", { class: "card" }, [
        el("h2", { text: "Preview (A4)" }),
        el("div", { class: "previewWrap" }, [
          el("div", { class: "previewPage" }, [
            el("div", { class: "previewLabel", text: "Page 1" }),
            buildPoster(1, "qrImg")
          ]),
          el("div", { class: "previewPage" }, [
            el("div", { class: "previewLabel", text: "Page 2" }),
            buildPoster(2, "qrImg2")
          ])
        ])
      ])
    ])
  );

  wireActions();
  refreshQr("qrImg");
  refreshQr("qrImg2");

  for (const id of ["poster", "poster2"]) {
    const poster = document.getElementById(id);
    if (poster) {
      poster.style.width = `${A4_WIDTH_PX}px`;
      poster.style.height = `${A4_HEIGHT_PX}px`;
    }
  }

  if (activeKey) {
    const next = document.querySelector(`[data-key="${escapeAttrValue(activeKey)}"]`);
    if (next && typeof next.focus === "function") {
      next.focus({ preventScroll: true });
      if (
        canRestoreSelection &&
        typeof next.setSelectionRange === "function" &&
        selectionStart !== null &&
        selectionEnd !== null
      ) {
        try {
          next.setSelectionRange(selectionStart, selectionEnd);
        } catch {
          // Some input types don't support selection ranges.
        }
      }
    }
  }
}

function detailCol(title, value) {
  return el("div", { class: "detailCol" }, [
    el("h3", { text: title }),
    el("div", { class: "value", text: value })
  ]);
}

function qrCol(qrImgId) {
  return el("div", { class: "detailCol" }, [
    el("h3", { text: "Scan for location" }),
    el("div", { class: "value" }, [
      el("div", { class: "qrBox" }, [
        el("img", {
          id: qrImgId,
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
      "data-key": key,
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
    el(
      "textarea",
      {
        "data-key": key,
        placeholder,
        oninput: (e) => {
          state[key] = e.target.value;
          render();
        }
      },
      [document.createTextNode(state[key] ?? "")]
    )
  ]);
}

function fieldSelect(labelText, key, options) {
  const select = el("select", {
    "data-key": key,
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
      "data-key": key,
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
      "data-key": key,
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

async function refreshQr(qrImgId) {
  const img = document.getElementById(qrImgId);
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
          // best-effort
        }
      })
    );

    return await html2canvas(clone, { scale: 3, backgroundColor: "#ffffff" });
  } finally {
    cloneHost.remove();
  }
}

function addCanvasToPdf(pdf, canvas) {
  const imgData = canvas.toDataURL("image/png");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgW = canvas.width;
  const imgH = canvas.height;
  const scale = Math.min(pageWidth / imgW, pageHeight / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  const x = (pageWidth - w) / 2;
  const y = (pageHeight - h) / 2;
  pdf.addImage(imgData, "PNG", x, y, w, h);
}

function wireActions() {
  const btnPng1 = document.getElementById("btnPng1");
  const btnPng2 = document.getElementById("btnPng2");
  const btnPdf = document.getElementById("btnPdf");
  const poster1 = document.getElementById("poster");
  const poster2 = document.getElementById("poster2");

  const setBusy = (busy) => {
    btnPng1.disabled = busy;
    btnPng2.disabled = busy;
    btnPdf.disabled = busy;
  };

  btnPng1.addEventListener("click", async () => {
    setBusy(true);
    try {
      const canvas = await capturePosterCanvas(poster1);
      canvas.toBlob((blob) => {
        if (!blob) return;
        downloadBlob(blob, `${safeName()}-page1-A4.png`);
      }, "image/png");
    } finally {
      setBusy(false);
    }
  });

  btnPng2.addEventListener("click", async () => {
    setBusy(true);
    try {
      const canvas = await capturePosterCanvas(poster2);
      canvas.toBlob((blob) => {
        if (!blob) return;
        downloadBlob(blob, `${safeName()}-page2-A4.png`);
      }, "image/png");
    } finally {
      setBusy(false);
    }
  });

  btnPdf.addEventListener("click", async () => {
    setBusy(true);
    try {
      const canvas1 = await capturePosterCanvas(poster1);
      const canvas2 = await capturePosterCanvas(poster2);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      addCanvasToPdf(pdf, canvas1);
      pdf.addPage();
      addCanvasToPdf(pdf, canvas2);
      downloadBlob(pdf.output("blob"), `${safeName()}-A4-2pages.pdf`);
    } finally {
      setBusy(false);
    }
  });
}

function safeName() {
  const house = (state.houseNo || "").toString().trim() || "house";
  const person = (state.beneficiary || "").trim() || "beneficiary";
  return `${house}-${person}`.replace(/[^\w.-]+/g, "_").slice(0, 80);
}

render();
