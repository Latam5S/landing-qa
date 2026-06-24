import api from "./rest-client.js";

const URLS = {
  districts: "lstDistritos.json",
  coverage: { Dinsides: "lstDinsides.json" },
  agency: {
    Shalom: "lstShalom.json",
    "Olva Courier": "lstOlvaCourier.json",
    Marvisur: "lstMarvisur.json",
    Encomienda: "lstEncomienda.json",
  },
};

const COURIER_TYPES = {
  Shalom: "agency",
  "Olva Courier": "agency",
  Marvisur: "agency",
  Dinsides: "home",
  Delivery: "home",
  "Retiro en tienda": "store",
  Encomienda: "agency",
};
const DAY_NAMES_FULL = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
const MONTH_NAMES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
const DAY_INDEX_MAP = {
  Dom: 0,
  Lun: 1,
  Mar: 2,
  Mié: 3,
  Jue: 4,
  Vie: 5,
  Sáb: 6,
};

const app = {
  init: async () => {
    const p = new URLSearchParams(window.location.search);
    state.merchantId = p.get("merchant");
    if (!state.merchantId) return app.showError();
    try {
      const token = await api.getGuestToken(state.merchantId);
      api.setToken(token);
      const json = await api.getMerchantConfig();
      if (json.dataJson && json.dataJson.merchantName) {
        state.config = json.dataJson;
        app.renderClient();
        document.getElementById("loading-overlay").classList.add("hidden");
      } else {
        app.showError();
      }
    } catch (e) {
      app.showError();
    }
  },

  showError: () => {
    document.getElementById("loading-overlay").classList.add("hidden");
    document
      .getElementById("view-client")
      .parentElement.classList.add("hidden");
    document.getElementById("error-view").classList.remove("hidden");
    lucide.createIcons();
  },

  normalizeText: (text) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),

  renderClient: () => {
    document.title = `Envío - ${state.config.merchantName}`;
    document.getElementById("client-title").innerText =
      state.config.merchantName || "Agenda tu envío";
    document.getElementById("client-title").classList.remove("hidden");
    document.getElementById("client-time").innerText =
      state.config.updateTime || "--:--";

    const cl = state.config.couriers || [];
    const cs = document.getElementById("c-courier-select");
    cs.innerHTML =
      '<option value="" disabled selected>Elige una opción...</option>';

    let homeCourierDefinitivo = null;
    if (cl.includes("Dinsides")) homeCourierDefinitivo = "Dinsides";
    else
      homeCourierDefinitivo = cl.find(
        (c) => (COURIER_TYPES[c] || "home") === "home",
      );
    state.primaryHomeCourier = homeCourierDefinitivo;

    let homeOptionAdded = false;
    cl.forEach((c) => {
      const type = COURIER_TYPES[c] || "home";
      if (type === "agency") {
        const opt = document.createElement("option");
        opt.value = c;
        opt.innerText = "Retiro en agencia " + c;
        cs.appendChild(opt);
      } else if (type === "store") {
        const opt = document.createElement("option");
        opt.value = c;
        opt.innerText = c;
        cs.appendChild(opt);
      } else {
        if (!homeOptionAdded) {
          const opt = document.createElement("option");
          opt.value = "GENERIC_HOME";
          opt.innerText = "Delivery (Solo Lima)";
          cs.appendChild(opt);
          homeOptionAdded = true;
        }
      }
    });

    app.generateDateOptions();
    app.loadExternalLists();
    lucide.createIcons();
    document.getElementById("c-phone").focus();
  },

  handleClientPhone: (el) => {
    let val = el.value.replace(/\D/g, "");
    if (val.length > 0 && val.charAt(0) !== "9") val = val.substring(1);
    el.value = val;
    const badge = document.getElementById("user-found-badge");
    if (val.length === 9) {
      const cache = JSON.parse(
        localStorage.getItem("latam5s_client_cache") || "{}",
      );
      if (cache[val]) {
        badge.classList.remove("hidden");
        app.fillFromCache(cache[val]);
        app.showToast("¡Hola de nuevo! Cargamos tus datos ✨");
        [
          "block-service",
          "dynamic-form-section",
          "block-personal",
          "block-closing",
        ].forEach((id, idx) => setTimeout(() => app.revealStep(id), idx * 100));
      } else {
        badge.classList.add("hidden");
        app.revealStep("block-service");
      }
    }
  },

  fillFromCache: (data) => {
    if (data.name) document.getElementById("c-name").value = data.name;
    if (data.courier) {
      const select = document.getElementById("c-courier-select");
      const type = COURIER_TYPES[data.courier] || "home";
      if (type === "agency" || type === "store") {
        if ([...select.options].some((o) => o.value === data.courier)) {
          select.value = data.courier;
          app.onCourierChange(data.courier);
        }
      } else {
        select.value = "GENERIC_HOME";
        app.onCourierChange("GENERIC_HOME");
      }
    }
    setTimeout(() => {
      document.getElementById("c-date-select").value = "";
      if (data.type === "agency") {
        if (data.dni) document.getElementById("c-dni").value = data.dni;
        if (data.agency) {
          document.getElementById("c-agency").value = data.agency;
          document
            .getElementById("btn-clear-agency")
            .classList.remove("hidden");
        }
      } else {
        if (data.district) {
          document.getElementById("c-district").value = data.district;
          document
            .getElementById("btn-clear-district")
            .classList.remove("hidden");
        }
        if (data.address)
          document.getElementById("c-address").value = data.address;
        if (data.ref) document.getElementById("c-ref").value = data.ref;
      }
    }, 100);
  },

  revealStep: (id) => {
    const el = document.getElementById(id);
    if (el && el.classList.contains("hidden")) {
      el.classList.remove("hidden");
      setTimeout(() => el.classList.remove("opacity-0", "translate-y-4"), 50);
      if (id === "block-service" || id === "block-closing")
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  },

  onCourierChange: (val) => {
    let realCourier = val === "GENERIC_HOME" ? state.primaryHomeCourier : val;
    state.selectedCourier = realCourier;
    state.selectedCourierType = COURIER_TYPES[realCourier] || "home";
    document.getElementById("dynamic-form-section").classList.remove("hidden");
    const af = document.getElementById("fields-agency"),
      hf = document.getElementById("fields-home");
    ["c-dni", "c-agency", "c-address", "c-district", "c-ref"].forEach((id) =>
      document.getElementById(id).removeAttribute("required"),
    );
    if (state.selectedCourierType === "agency") {
      af.classList.remove("hidden");
      hf.classList.add("hidden");
      document.getElementById("c-dni").setAttribute("required", "true");
      document.getElementById("c-agency").setAttribute("required", "true");
      document.getElementById("c-agency").value = "";
      app.loadAgencies(realCourier);
      app.clearDistrict();
      app.loadDateLabel();
    } else if (state.selectedCourierType === "store") {
      af.classList.add("hidden");
      hf.classList.add("hidden");
      app.clearAgency();
      app.clearDistrict();
      app.revealStep("block-personal");
      app.loadDateLabel();
    } else {
      af.classList.add("hidden");
      hf.classList.remove("hidden");
      document.getElementById("c-address").setAttribute("required", "true");
      document.getElementById("c-district").setAttribute("required", "true");
      document.getElementById("c-ref").setAttribute("required", "true");
      app.clearAgency();
      app.clearDistrict();
      app.loadExternalLists(realCourier);
      app.loadDateLabel();
    }
  },

  loadDateLabel: async () => {
    const label = document.getElementById("c-date-label");
    if (label && state.selectedCourierType === "store")
      label.innerText = "Fecha de Recojo";
    else if (label) label.innerText = "Fecha de Envío";
  },

  loadExternalLists: async (courierName) => {
    let url =
      courierName && URLS.coverage && URLS.coverage[courierName]
        ? URLS.coverage[courierName]
        : URLS.districts;
    const input = document.getElementById("c-district");
    if (input) {
      input.placeholder = "Cargando distritos...";
      input.disabled = true;
      input.value = "";
    }
    state.externalData.districts = [];
    try {
      const res = await fetch(url);
      const data = await res.json();
      state.externalData.districts = data.map(
        (d) => d.Distrito || d.nombre || d,
      );
    } catch (e) {
      console.error(e);
    } finally {
      if (input) {
        input.placeholder = "Buscar Distrito...";
        input.disabled = false;
      }
    }
  },

  loadAgencies: async (courierName) => {
    const url = URLS.agency[courierName];
    if (!url) {
      state.externalData.agencies = [];
      return;
    }
    const input = document.getElementById("c-agency");
    input.placeholder = `Cargando sedes ${courierName}...`;
    input.disabled = true;
    try {
      const res = await fetch(url);
      const rawData = await res.json();
      state.externalData.agencies = rawData.map((item) => ({
        Agencia: item.Agencia || item.c_nom_agencia || "Agencia",
        Direccion: item.Direccion || item.c_direccion || "",
      }));
      input.placeholder = `Buscar sede ${courierName}...`;
      input.disabled = false;
    } catch (e) {
      input.placeholder = "Error cargando agencias";
    }
  },

  searchAgency: (q) => {
    const c = document.getElementById("agency-results");
    const x = document.getElementById("btn-clear-agency");

    if (!q) {
      c.classList.add("hidden");
      x.classList.add("hidden");
      return;
    }
    x.classList.remove("hidden");

    if (q.length < 2) {
      c.classList.add("hidden");
      return;
    }

    if (c.classList.contains("hidden")) {
      c.classList.remove("hidden");
      setTimeout(
        () =>
          document
            .getElementById("c-agency")
            .scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    }

    const cleanQ = app.normalizeText(q);
    const terms = cleanQ.split(" ").filter((t) => t.length > 0);

    const m = (state.externalData.agencies || [])
            .filter(a => {
                const fullText = app.normalizeText(`${a.Agencia} ${a.Direccion}`);
                return terms.every(term => fullText.includes(term));
            })
            .sort((a, b) => {
                const aName = app.normalizeText(a.Agencia);
                const bName = app.normalizeText(b.Agencia);
                return terms.some(t => bName.startsWith(t)) - terms.some(t => aName.startsWith(t));
            })
            .slice(0, 100);

    if (m.length) {
      c.innerHTML = m
        .map(
          (a) => `
                        <div onmousedown="app.selectAgency('${a.Agencia.replace(/'/g, "\\'")}','${a.Direccion.replace(/'/g, "\\'").replace(/\n/g, " ")}')" 
                             class="p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0">
                            <p class="font-bold text-brand_text text-sm mb-0.5">${a.Agencia}</p>
                            <p class="text-xs text-gray-500">${a.Direccion}</p>
                        </div>
                    `,
        )
        .join("");
    } else {
      c.innerHTML = `
                        <div class="p-4 text-center">
                            <p class="text-gray-400 text-sm font-bold">No encontramos esa agencia 😕</p>
                            <p class="text-xs text-gray-400 mt-1">Intenta buscar solo por el distrito o una palabra clave.</p>
                        </div>
                    `;
    }
  },

  selectAgency: (n, a) => {
    const address = a?.trim() ? ` | ${a}` : "";
    document.getElementById("c-agency").value = `${n}${address}`;
    document.getElementById("agency-results").classList.add("hidden");
    document.getElementById("btn-clear-agency").classList.remove("hidden");
    document
      .getElementById("c-agency")
      .classList.remove("border-red-500", "bg-red-50");
  },

  clearAgency: () => {
    const i = document.getElementById("c-agency");
    i.value = "";
    document.getElementById("agency-results").classList.add("hidden");
    document.getElementById("btn-clear-agency").classList.add("hidden");
    i.focus();
  },

  validateAgencyOnBlur: (el) => {
    setTimeout(() => {
      const val = el.value.trim();
      if (!val) return;
      const loadedAgencies = state.externalData.agencies || [];
      const isValid = loadedAgencies.some(
        (item) =>
          `${item.Agencia}${item.Direccion?.trim() ? " | " + item.Direccion : ""}` ===
          val,
      );
      if (!isValid) {
        el.value = "";
        app.showToast("⚠️ Selecciona una opción del listado");
        document.getElementById("agency-results").classList.add("hidden");
      }
    }, 200);
  },

  searchDistrict: (q) => {
    const c = document.getElementById("district-results");
    const x = document.getElementById("btn-clear-district");

    if (!q) {
      c.classList.add("hidden");
      x.classList.add("hidden");
      return;
    }
    x.classList.remove("hidden");

    if (q.length < 1) {
      c.classList.add("hidden");
      return;
    }

    if (c.classList.contains("hidden")) {
      c.classList.remove("hidden");
      setTimeout(
        () =>
          document
            .getElementById("c-district")
            .scrollIntoView({ behavior: "smooth", block: "start" }),
        100,
      );
    }

    const cleanQ = app.normalizeText(q);
    const m = (state.externalData.districts || [])
        .filter(d => app.normalizeText(d).includes(cleanQ))
        .sort((a, b) => {
            const aNorm = app.normalizeText(a);
            const bNorm = app.normalizeText(b);
            return bNorm.startsWith(cleanQ) - aNorm.startsWith(cleanQ);
        })
        .slice(0, 50);

    // CAMBIO AQUÍ: Usamos onmousedown en lugar de onclick
    c.innerHTML = m.length
      ? m
        .map(
          (d) => `
                    <div onmousedown="app.selectDistrict('${d.replace(/'/g, "\\'")}')" 
                         class="p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0">
                        <p class="font-bold text-brand_text text-sm">${d}</p>
                    </div>
                `,
        )
        .join("")
      : '<div class="p-3 text-gray-400 text-sm text-center">Sin resultados</div>';
  },

  selectDistrict: (v) => {
    document.getElementById("c-district").value = v;
    document.getElementById("district-results").classList.add("hidden");
    document.getElementById("btn-clear-district").classList.remove("hidden");
  },
  clearDistrict: () => {
    const i = document.getElementById("c-district");
    i.value = "";
    document.getElementById("district-results").classList.add("hidden");
    document.getElementById("btn-clear-district").classList.add("hidden");
    i.focus();
  },

  validateDistrictOnBlur: (el) => {
    setTimeout(() => {
      const val = el.value.trim();
      if (!val) return;
      const validDistricts = state.externalData.districts || [];
      if (!validDistricts.includes(val)) {
        el.value = "";
        app.showToast("⚠️ Elige un distrito de la lista");
        document.getElementById("district-results").classList.add("hidden");
      }
    }, 200);
  },

  generateDateOptions: () => {
    const s = document.getElementById("c-date-select");
    s.innerHTML =
      '<option value="" disabled selected>Elige una fecha...</option>';
    const allowedDays = state.config.shippingDays || [];
    if (!allowedDays.length) return;
    const now = new Date();
    const gap = parseInt(state.config.updateGap || 0);
    const [cutHour, cutMinute] = (state.config.updateTime || "18:00")
      .split(":")
      .map(Number);
    const cutTime = new Date(now);
    cutTime.setHours(cutHour, cutMinute, 0, 0);
    let startOffset = gap;
    if (now > cutTime) startOffset = gap + 1;
    for (let i = startOffset; i < startOffset + 14; i++) {
      const f = new Date(now);
      f.setDate(now.getDate() + i);
      const dayIndex = f.getDay();
      if (allowedDays.some((n) => DAY_INDEX_MAP[n] === dayIndex)) {
        let prefix = "";
        if (i === 0) prefix = "¡HOY! - ";
        else if (i === 1) prefix = "Mañana - ";
        const lbl = `${prefix}${DAY_NAMES_FULL[dayIndex]} ${f.getDate()} ${MONTH_NAMES[f.getMonth()]}`;
        const val = `${DAY_NAMES_FULL[dayIndex]} ${f.getDate().toString().padStart(2, "0")}/${(f.getMonth() + 1).toString().padStart(2, "0")}`;
        const o = document.createElement("option");
        o.value = val;
        o.innerText = lbl;
        s.appendChild(o);
      }
    }
  },

  submitOrder: async (e) => {
    e.preventDefault();
    if (!state.selectedCourier) {
      app.showToast("⚠️ Selecciona un tipo de envío");
      app.revealStep("block-service");
      document.getElementById("c-courier-select").focus();
      return;
    }
    const dateSelect = document.getElementById("c-date-select");
    if (!dateSelect.value) {
      app.showToast("📅 Selecciona la fecha de envío");
      app.revealStep("block-closing");
      dateSelect.focus();
      return;
    }
    const phone = document.getElementById("c-phone").value.trim();
    const name = document.getElementById("c-name").value.trim();
    const day = dateSelect.value;
    if (name.length < 3) return app.showToast("⚠️ Ingresa un nombre válido");
    if (!/^9\d{8}$/.test(phone)) return app.showToast("⚠️ Celular inválido");

    if (state.selectedCourierType === "agency") {
      const inputAgency = document.getElementById("c-agency");
      const loadedAgencies = state.externalData.agencies || [];
      const isValid = loadedAgencies.some(
        (item) =>
          `${item.Agencia}${item.Direccion?.trim() ? " | " + item.Direccion : ""}` ===
          inputAgency.value.trim(),
      );
      if (!isValid) {
        inputAgency.focus();
        inputAgency.classList.add(
          "animate-shake",
          "border-red-500",
          "bg-red-50",
        );
        setTimeout(
          () =>
            inputAgency.classList.remove(
              "animate-shake",
              "border-red-500",
              "bg-red-50",
            ),
          1000,
        );
        return app.showToast("⚠️ Selecciona una agencia de la lista");
      }
    } else if (state.selectedCourierType === "home") {
      const inputDist = document.getElementById("c-district");
      const validDistricts = state.externalData.districts || [];
      if (!validDistricts.includes(inputDist.value.trim())) {
        inputDist.focus();
        inputDist.classList.add("animate-shake", "border-red-500", "bg-red-50");
        setTimeout(
          () =>
            inputDist.classList.remove(
              "animate-shake",
              "border-red-500",
              "bg-red-50",
            ),
          1000,
        );
        return app.showToast("⚠️ Selecciona un distrito de la lista");
      }
      const inputRef = document.getElementById("c-ref");
      if (inputRef.value.trim().length < 3) {
        // Mínimo 3 letras
        inputRef.focus();
        inputRef.classList.add("animate-shake", "border-red-500", "bg-red-50");
        setTimeout(
          () =>
            inputRef.classList.remove(
              "animate-shake",
              "border-red-500",
              "bg-red-50",
            ),
          1000,
        );
        return app.showToast(
          "⚠️ Ingresa una referencia (color de casa, piso, etc)",
        );
      }
    }

    let data = {
      clientName: name,
      clientPhone: phone,
      courier: state.selectedCourier,
      shippingDate: day,
      createdAt: Date.now(),
      product: "N/A",
    };
    const cacheData = {
      name: name,
      courier: state.selectedCourier,
      type: state.selectedCourierType,
    };
    let wa = "";

    if (state.selectedCourierType === "agency") {
      data.clientDni = document.getElementById("c-dni").value.trim();
      data.clientAgency = document.getElementById("c-agency").value.trim();
      cacheData.dni = data.clientDni;
      cacheData.agency = data.clientAgency;
      wa = `📦 *NUEVO ENVÍO (AGENCIA)*\n\n👤 ${name}\n📱 ${phone}\n🆔 DNI: ${data.clientDni}\n🏢 Agencia: ${data.clientAgency.replace(" | ", "\n📍 ")}\n\n🚚 ${state.selectedCourier}\n📅 ${day}`;
    } else if (state.selectedCourierType === "store") {
      wa = `📦 *NUEVO RETIRO EN TIENDA*\n\n👤 ${name}\n📱 ${phone}\n\n📅 ${day}`;
    } else {
      data.clientAddress = document.getElementById("c-address").value.trim();
      data.clientDistrict = document.getElementById("c-district").value.trim();
      data.clientRef = document.getElementById("c-ref").value.trim();
      cacheData.district = data.clientDistrict;
      cacheData.address = data.clientAddress;
      cacheData.ref = data.clientRef;
      wa = `📦 *NUEVO ENVÍO (DELIVERY)*\n\n👤 ${name}\n📱 ${phone}\n📍 ${data.clientDistrict}\n🏠 ${data.clientAddress}\n🗺️ Ref: ${data.clientRef}\n\n🚚 ${state.selectedCourier}\n📅 ${day}`;
    }

    const cache = JSON.parse(
      localStorage.getItem("latam5s_client_cache") || "{}",
    );
    cache[phone] = cacheData;
    localStorage.setItem("latam5s_client_cache", JSON.stringify(cache));

    const btn = document.getElementById("btn-submit-order");
    const spinner = document.getElementById("btn-submit-spinner");
    const text = document.getElementById("btn-submit-text");

    btn.disabled = true;
    spinner.classList.remove("hidden");
    text.classList.add("hidden");

    try {
      // Se requiere un anonymous-token para crear pedidos sin estar logueado
      // Pasamos useAnonymous=true para que el api client lo gestione automáticamente
      const res = await api.createOrder(data, true);
      console.log("Order saved, response:", res);
    } catch (e) {
      console.error("Error saving order:", e);
      app.showToast(
        "Ocurrió un error al guardar tu envío. Intenta nuevamente.",
        "error",
      );
      btn.disabled = false;
      spinner.classList.add("hidden");
      text.classList.remove("hidden");
      return;
    }
    btn.disabled = false;
    state.waMessage = wa;
    document.getElementById("order-summary").innerText = wa.replace(/\*/g, "");
    document.getElementById("client-form").classList.add("hidden");
    document.getElementById("view-client").classList.add("hidden");
    document.getElementById("client-title").classList.add("hidden");
    document.getElementById("success-view").classList.remove("hidden");
  },

  sendWhatsApp: () => {
    if (!state.waMessage || !state.config.whatsapp) return;
    window.open(
      `https://wa.me/51${state.config.whatsapp}?text=${encodeURIComponent(state.waMessage)}`,
      "_blank",
    );
  },

  showToast: (msg, type = "") => {
    const toatType = type ? `${type}-` : "";
    const el = document.getElementById(`${toatType}toast`);
    document.getElementById(`${toatType}toast-msg`).innerText = msg;
    el.classList.remove("opacity-0", "-translate-y-20");
    setTimeout(() => el.classList.add("opacity-0", "-translate-y-20"), 3000);
  },
};

const state = {
  merchantId: null,
  config: {},
  selectedCourierType: null,
  selectedCourier: null,
  externalData: { districts: null, agencies: [] },
};
app.init();
window.app = app;
