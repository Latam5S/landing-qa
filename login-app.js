import api from "./rest-client.js";

// CONFIGURACIÓN DE LIMITES DEL PLAN (FEATURE FLAGS)
const PLAN_FEATURES = {
    Gratis: {
        allowViewOrders: false, // NO mostrar nada
    },
    Pro: {
        allowViewOrders: true,
    },
    Empresa: {
        allowViewOrders: true,
    },
};

const SafeStorage = {
    memory: {},
    setItem: function (k, v) {
        try {
            localStorage.setItem(k, v);
        } catch (e) {
            this.memory[k] = v;
        }
    },
    getItem: function (k) {
        try {
            return localStorage.getItem(k);
        } catch (e) {
            return this.memory[k] || null;
        }
    },
    removeItem: function (k) {
        try {
            localStorage.removeItem(k);
        } catch (e) {
            delete this.memory[k];
        }
    },
};

const ALL_COURIERS = [
    "Shalom",
    "Olva Courier",
    "Marvisur",
    "Dinsides",
    "Delivery",
    "Retiro en tienda",
    "Encomienda",
];
const ALL_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const initialState = {
    merchantName: "",
    whatsapp: "",
    couriers: [],
    shippingDays: [],
    updateTime: "18:00",
    updateGap: "0",
};
const state = {
    user: null,
    merchantId: null,
    config: { ...initialState },
    allOrders: [],
    selectedOrders: new Set(),
    visibleOrders: [],
    filterStatus: "PENDIENTE",
};

// Helper para sanitizar XSS
const escapeHtml = (unsafe) => {
    if (typeof unsafe !== "string") return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

const multiAddressCouriers = [
    "Shalom",
    "Olva Courier",
    "Marvisur",
];

const app = {
    // --- NUEVA FUNCIÓN: Formateo estricto de WhatsApp ---
    formatWhatsapp: (el) => {
        // 1. Eliminar cualquier caracter que NO sea número
        let val = el.value.replace(/\D/g, "");

        // 2. Validar que empiece con 9
        // Si el primer digito no es 9 y ya hay algo escrito, lo borramos
        if (val.length > 0 && val.charAt(0) !== "9") {
            val = val.substring(1);
        }

        // 3. Actualizar el valor del input visualmente
        el.value = val;

        // 4. Actualizar el estado y chequear validaciones
        app.updateConfigInput("whatsapp", val);

        // Feedback visual inmediato (Borde rojo si no son 9 dígitos)
        if (val.length > 0 && val.length < 9) {
            el.classList.add("border-red-500/50");
            el.classList.remove("border-white/10", "focus:border-primary");
        } else {
            el.classList.remove("border-red-500/50");
            el.classList.add("border-white/10", "focus:border-primary");
        }
    },

    // 1. Función pura que devuelve si es válido y qué falta
    validateConfig: () => {
        const c = state.config;
        const errors = [];

        if (!c.merchantName || c.merchantName.length < 3)
            errors.push("Nombre del emprendimiento");

        // --- ACTUALIZACIÓN AQUÍ: Validación estricta de Regex ---
        // ^9 = empieza con 9
        // \d{8}$ = seguido de exactamente 8 dígitos más (total 9)
        if (!c.whatsapp || !/^9\d{8}$/.test(c.whatsapp))
            errors.push("Celular válido (9 dígitos)");
        // -------------------------------------------------------

        if (!c.couriers || c.couriers.length === 0)
            errors.push("Al menos un Courier");
        if (!c.shippingDays || c.shippingDays.length === 0)
            errors.push("Al menos un día de envío");
        if (!c.updateTime) errors.push("Hora de corte");
        if (c.updateGap === "" || c.updateGap === null || c.updateGap === undefined)
            errors.push("Días de anticipación");

        return {
            isValid: errors.length === 0,
            errors: errors,
        };
    },

    // 2. Función visual que actualiza la UI (candado en pestaña compartir)
    checkConfigStatus: () => {
        const validation = app.validateConfig();
        const navShare = document.getElementById("nav-share");
        const icon = navShare.querySelector("i"); // El icono de Lucide

        if (validation.isValid) {
            // Estado: HABILITADO
            navShare.classList.remove("opacity-50", "cursor-not-allowed");
            navShare.classList.add("hover:bg-white/5", "hover:text-white");
            // Cambiamos el icono a share-2 (normal)
            if (icon) icon.setAttribute("data-lucide", "share-2");
        } else {
            // Estado: BLOQUEADO
            navShare.classList.add("opacity-50", "cursor-not-allowed");
            navShare.classList.remove("hover:bg-white/5", "hover:text-white");
            // Cambiamos el icono a lock (bloqueado)
            if (icon) icon.setAttribute("data-lucide", "share-2");
        }
        lucide.createIcons(); // Refrescar iconos
    },

    updateConfigInput: (key, value) => {
        state.config[key] = value;
        app.checkConfigStatus(); // <--- IMPORTANTE: Revalida visualmente en tiempo real
    },

    toggleLoading: (show) => {
        const el = document.getElementById("loading-overlay");
        show
            ? (el.classList.remove("hidden"),
                setTimeout(() => el.classList.remove("opacity-0"), 10))
            : (el.classList.add("opacity-0"),
                setTimeout(() => el.classList.add("hidden"), 300));
    },

    modalTimer: null,

    // 1. openModal CORREGIDO
    openModal: (htmlContent) => {
        const el = document.getElementById("generic-modal");
        const content = document.getElementById("modal-content");

        // --- LA CORRECCIÓN MÁGICA ---
        // Si había una orden de cerrar el modal, LA CANCELAMOS inmediatamente.
        if (app.modalTimer) clearTimeout(app.modalTimer);
        // -----------------------------

        content.innerHTML = htmlContent;

        el.classList.remove("hidden");

        // Pequeño delay para permitir que el navegador procese el cambio de display antes de la opacidad
        setTimeout(() => {
            el.classList.remove("opacity-0");
            if (el.firstElementChild) {
                el.firstElementChild.classList.remove("scale-95");
                el.firstElementChild.classList.add("scale-100");
            }
        }, 10);

        if (window.lucide) lucide.createIcons();
    },

    // 2. closeModal CORREGIDO
    closeModal: () => {
        const el = document.getElementById("generic-modal");
        if (!el) return;

        // Iniciamos animación de salida
        el.classList.add("opacity-0");
        if (el.firstElementChild) {
            el.firstElementChild.classList.remove("scale-100");
            el.firstElementChild.classList.add("scale-95");
        }

        // Guardamos la referencia del Timer para poder cancelarlo si se abre rápido de nuevo
        app.modalTimer = setTimeout(() => {
            el.classList.add("hidden");
            app.modalTimer = null; // Limpiamos la variable
        }, 200); // 200ms debe coincidir con tu CSS duration-200
    },

    // Reemplazo de showModal (Confirmación)
    showModal: (msg, onConfirm) => {
        app.openModal(`
            <div class="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center mb-6 text-primary mx-auto shadow-neon border border-primary/20">
                <i data-lucide="alert-circle" class="w-7 h-7"></i>
            </div>
            <h3 class="text-xl font-bold text-white mb-3 text-center">Confirmación</h3>
            <p class="text-slate-400 text-sm mb-8 leading-relaxed text-center">${msg}</p>
            <div class="flex gap-3">
                <button onclick="app.closeModal()" class="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 border border-white/10 transition">Cancelar</button>
                <button id="btn-confirm-action" class="flex-1 py-3 rounded-xl font-bold bg-primary text-white hover:bg-blue-600 shadow-neon transition">Confirmar</button>
            </div>
        `);
        document.getElementById("btn-confirm-action").onclick = () => {
            onConfirm();
            app.closeModal();
        };
    },

    // Reemplazo de openStatusMenu
    openStatusMenu: () => {
        if (state.selectedOrders.size === 0)
            return app.showToast("Selecciona al menos un envío");
        app.openModal(`
            <h3 class="text-xl font-bold text-white mb-2 text-center">Actualizar Estado</h3>
            <p class="text-xs text-slate-400 text-center mb-6">Se aplicará a ${state.selectedOrders.size} elemento(s).</p>
            <div class="space-y-4">
                <button onclick="app.setStatus('ENVIADO')" class="w-full py-4 rounded-xl font-bold bg-secondary/20 text-secondary hover:bg-secondary/30 border border-secondary/30 flex items-center justify-center gap-3 transition">
                    <i data-lucide="truck" class="w-5 h-5"></i> MARCAR COMO ENVIADO
                </button>
                <button onclick="app.setStatus('PENDIENTE')" class="w-full py-4 rounded-xl font-bold bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30 flex items-center justify-center gap-3 transition">
                    <i data-lucide="clock" class="w-5 h-5"></i> MARCAR COMO PENDIENTE
                </button>
            </div>
        `);
    },

    // Reemplazo de showUpgradeModal
    showUpgradeModal: () => {
        app.openModal(`
            <div class="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-6 text-primary mx-auto shadow-neon border border-primary/20">
                <i data-lucide="crown" class="w-8 h-8"></i>
            </div>
            <h3 class="text-2xl font-bold text-white mb-2 text-center">Plan Pro</h3>
            <p class="text-slate-300 text-sm mb-6 leading-relaxed text-center">Desbloquea el historial ilimitado.</p>
            <button onclick="app.activateTrial()" class="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-primary to-indigo-600 text-white hover:scale-[1.02] transition shadow-neon flex items-center justify-center gap-2">
                <i data-lucide="sparkles" class="w-4 h-4"></i> Gratis por 7 días
            </button>
        `);
    },

    // FUNCIÓN CORREGIDA: ACTIVACIÓN INMEDIATA
    activateTrial: async () => {
        app.toggleLoading(true);
        try {
            const json = await api.startTrial();

            if (json.status === "success") {
                // 1. Actualizar Estado Local Inmediatamente (Sin preguntar al servidor)
                state.user.plan = json.plan;
                SafeStorage.setItem("app_current_user", JSON.stringify(state.user));

                // 2. Actualizar Visualmente el Badge del Plan (Sidebar)
                document
                    .querySelectorAll(".user-plan-display")
                    .forEach(
                        (el) => (el.innerText = `PLAN ${state.user.plan.toUpperCase()}`),
                    );

                // 3. Cerrar Modal
                app.closeModal();

                // 4. Recargar los Pedidos (Ahora que el estado es PRO, se mostrarán)
                // IMPORTANTE: No llamamos a loadData(), solo a loadOrders()
                await app.loadOrders();

                app.showToast("¡Prueba Activada! Disfruta 7 días Pro 🎉");
            } else {
                // ERROR (Ya la usó)
                app.closeModal();
                app.showModal(json.message || "No se pudo activar la prueba", () =>
                    app.closeModal(),
                );
            }
        } catch (e) {
            app.showToast("Error de conexión", "error");
        }
        app.toggleLoading(false);
    },

    setStatus: (newStatus) => {
        app.closeModal("modal-status");
        app.showModal(
            `¿Cambiar ${state.selectedOrders.size} envíos a ${newStatus}?`,
            async () => {
                app.toggleLoading(true);
                const ids = Array.from(state.selectedOrders);
                try {
                    await api.updateOrdersStatus(ids, newStatus);
                    app.showToast("Estados actualizados");
                    app.loadOrders();
                } catch (e) {
                    app.showToast("Error al actualizar estados", "error");
                }
                app.toggleLoading(false);
            },
        );
    },

    // NUEVA FUNCIÓN: ENVIAR RESUMEN AL CLIENTE
    sendClientSummary: (orderId) => {
        const order = state.allOrders.find(
            (o) => String(o.orderId || o.createdAt) === String(orderId),
        );
        if (!order) return app.showToast("Error: No se encontró el pedido.", "error");

        const storeName = state.config.merchantName || "Nuestra Tienda";
        let phone = (order.clientPhone || "").replace(/[^0-9]/g, "");
        if (phone.length === 9) {
            phone = "51" + phone;
        }

        // Validación básica de número
        if (phone.length < 9)
            return app.showToast("El número de teléfono no es válido.", "error");

        const statusEmoji = order.status === "ENVIADO" ? "✅" : "📦";
        const statusText = order.status === "ENVIADO" ? "Enviado" : "Programado";

        let destinationInfo = "";
        if (order.clientAgency) {
            destinationInfo = `🏢 *Agencia:* ${order.clientAgency} (DNI: ${order.clientDni})`;
        } else if (order.clientAddress) {
            destinationInfo = `🏠 *Dirección:* ${order.clientDistrict}, ${order.clientAddress} (Ref: ${order.clientRef})`;
        }

        // CORRECCIÓN CLAVE: Usamos \n en lugar de %0A y emojis literales
        const message =
            order.courier !== "Retiro en tienda"
                ? `Hola *${order.clientName}*! 👋\n` +
                `Tu envío en *${storeName}* está *${statusText}* ${statusEmoji}\n\n` +
                `📅 *Fecha:* ${order.shippingDate}\n` +
                `🚚 *Courier:* ${order.courier}\n` +
                `${destinationInfo}\n\n` +
                `Gracias por tu compra! ✨`
                : `Hola *${order.clientName}*! 👋\n` +
                `Tu retiro en tienda está *${statusText}* ${statusEmoji}\n\n` +
                `📅 *Fecha:* ${order.shippingDate}\n` +
                `Gracias por tu compra! ✨`;

        // CORRECCIÓN CLAVE: encodeURIComponent envuelve TODO el mensaje
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank");
    },

    showToast: (msg, type = "") => {
        const prefix = type ? `${type}-` : "";
        const el = document.getElementById(`${prefix}toast`);
        document.getElementById(`${prefix}toast-msg`).innerText = msg;
        el.classList.remove("opacity-0", "-translate-y-20");
        setTimeout(() => el.classList.add("opacity-0", "-translate-y-20"), 3000);
    },

    scrollToEl: (el) => {
        setTimeout(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
    },

    handleLogin: async (e) => {
        e.preventDefault();
        const p = document.getElementById("auth-phone").value.trim();
        const pw = document.getElementById("auth-pass").value.trim();
        const err = document.getElementById("auth-error");
        app.toggleLoading(true);
        try {
            const data = await api.login(p, pw);
            if (data.accessToken) {
                const payload = api.getTokenPayload();
                const user = {
                    uid: payload.sub,
                    phone: payload.phone || p,
                    isAdmin: payload.isAdmin || false,
                    plan: payload.plan || "Gratis",
                };
                app.loginSuccess(user);
                return;
            } else {
                err.innerText = data.message || "Error al iniciar sesión";
                err.classList.remove("hidden");
                app.toggleLoading(false);
            }
        } catch (e) {
            console.error(e);
            err.innerText =
                e.detail?.trim() === "Incorrect username or password"
                    ? "Usuario o contraseña incorrectos"
                    : "Error de conexión con el servidor";
            err.classList.remove("hidden");
            app.toggleLoading(false);
        }
    },

    loginSuccess: (u) => {
        state.user = u;
        SafeStorage.setItem("app_current_user", JSON.stringify(u));
        app.init();
    },

    logout: () => {
        api.clearToken();
        SafeStorage.removeItem("app_current_user");
        state.user = null;
        state.merchantId = null;
        window.location.reload();
    },

    adminLoadUsers: async () => {
        const l = document.getElementById("admin-users-list");
        // Verificamos si tenemos el token guardado en el estado del usuario
        // state.user.token viene del cambio que hicimos en loginUser en el backend
        const plan = state?.user?.plan;
        if (plan !== "Admin") {
            l.innerHTML =
                '<tr><td colspan="4" class="p-4 text-center text-red-400">⛔ Error de sesión: Relogueate como Admin</td></tr>';
            return;
        }

        l.innerHTML =
            '<tr><td colspan="4" class="p-4 text-center text-slate-400"><i data-lucide="shield-check" class="inline w-4 h-4 mr-1"></i> Autorizando...</td></tr>';
        lucide.createIcons();
        app.toggleLoading(true);
        try {
            const merchants = await api.getAllMerchants();

            if (Array.isArray(merchants)) {
                // Renderizado de la tabla (Tu código visual original)
                l.innerHTML = merchants.length
                    ? merchants
                        .map(
                            (user) =>
                                `<tr class="bg-white border-b hover:bg-slate-50"><td class="px-6 py-4 font-bold text-slate-700">${escapeHtml(user.phone)}</td><td class="px-6 py-4"><span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded">${escapeHtml(user.plan || "Gratis")}</span></td><td class="px-6 py-4 text-xs text-slate-400">${user.createdAt ? new Date(user.createdAtDate).toLocaleDateString() : "-"}</td><td class="px-6 py-4 text-right flex gap-2 justify-end"><button onclick="app.adminResend('${escapeHtml(user.uid)}','${escapeHtml(user.phone)}')" class="text-indigo-600 text-xs font-bold hover:bg-indigo-50 px-2 py-1 rounded">Clave</button><select onchange="app.adminUpdatePlan('${escapeHtml(user.uid)}', this.value)" class="text-xs border rounded p-1 bg-slate-50 cursor-pointer outline-none"><option value="" disabled selected>Cambiar Plan</option><option value="Gratis">Gratis</option><option value="Pro">Pro</option><option value="Empresa">Empresa</option></select></td></tr>`,
                        )
                        .join("")
                    : '<tr><td colspan="4" class="p-4 text-center">Base de datos vacía</td></tr>';
            } else {
                l.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500 font-bold">⛔ Acceso Denegado o Error</td></tr>`;
            }
        } catch (e) {
            console.error(e);
            l.innerHTML =
                '<tr><td colspan="4" class="p-4 text-center text-red-400">Error de conexión</td></tr>';
        }

        app.toggleLoading(false);
    },

    adminUpdatePlan: (uid, newPlan) => {
        app.showModal(`¿Confirmas cambiar el plan a ${newPlan}?`, async () => {
            app.toggleLoading(true);
            try {
                await api.adminUpdateUserPlan(uid, newPlan);
                app.adminLoadUsers();
                app.showToast("Plan actualizado");
            } catch (e) {
                console.error("Error updating plan", e);
                app.showToast("Error al actualizar el plan", "error");
            }
            app.toggleLoading(false);
        });
    },

    adminCreateUser: async (e) => {
        e.preventDefault();
        const p = document.getElementById("admin-new-phone").value.trim(),
            pl = document.getElementById("admin-new-plan").value;
        app.toggleLoading(true);
        const np = Math.floor(1000 + Math.random() * 9000).toString();
        try {
            // Nota: El backend REST espera UserBase con passwordHash
            const userData = {
                phone: p,
                passwordHash: np,
                plan: pl,
                createdAtDate: new Date().toISOString(),
                trialEndsAt: new Date().toISOString(),
                hasUsedTrial: false,
            };
            await api.createMerchant(userData);
        } catch (e) {
            console.error("Error creating merchant", e);
            app.toggleLoading(false);
            app.showToast("Error al crear usuario", "error");
            return;
        }
        window.open(
            `https://wa.me/51${p}?text=${encodeURIComponent(`🔐 Bienvenid@ (Plan ${pl})\n\n📱 User: ${p}\n🔑 Pass: *${np}*\n\nEntra: ${window.location.href}`)}`,
            "_blank",
        );
        document.getElementById("admin-new-phone").value = "";
        app.adminLoadUsers();
        app.showToast("Usuario creado con éxito");
    },

    adminResend: (uid, phone) => {
        app.showModal(`¿Resetear clave para ${phone}?`, async () => {
            app.toggleLoading(true);
            const np = Math.floor(1000 + Math.random() * 9000).toString();
            try {
                await api.adminUpdatePassword(uid, np);
                window.open(
                    `https://wa.me/51${phone}?text=${encodeURIComponent(`🔐 *Recuperación de clave:*\n\n📱Usuario: ${phone}\n🔑Nueva Clave: *${np}*`)}`,
                    "_blank",
                );
                app.showToast("Contraseña restablecida");
            } catch (e) {
                console.error("Error resetting password", e);
                app.showToast("Error al restablecer la contraseña", "error");
            }
            app.toggleLoading(false);
        });
    },

    saveConfig: async () => {
        // 1. SANITIZACIÓN (LIMPIEZA DE DATOS)
        const nameInput = document.getElementById("inp-store-name");

        // Lógica de limpieza: trim() quita bordes, replace(/\s+/g, ' ') colapsa espacios internos
        let cleanName = nameInput.value.trim().replace(/\s+/g, " ");

        // Aplicamos la limpieza al input visual y al estado
        nameInput.value = cleanName;
        app.updateConfigInput("merchantName", cleanName);

        // 2. VALIDACIÓN (Ahora valida sobre el nombre ya limpio)
        const validation = app.validateConfig();

        if (!validation.isValid) {
            const missing = validation.errors.join(", ");
            app.showToast(`⚠️ No se puede guardar. Falta: ${missing}`);

            const btn = document.getElementById("btn-save-config");
            btn.classList.add("bg-red-500", "animate-shake");
            setTimeout(
                () => btn.classList.remove("bg-red-500", "animate-shake"),
                500,
            );
            return;
        }

        // 3. PROCESO DE GUARDADO (Backend)
        const btn = document.getElementById("btn-save-config");
        btn.disabled = true;
        btn.innerHTML =
            '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Guardando...';
        lucide.createIcons();

        app.toggleLoading(true);

        // Recopilamos el resto de valores
        state.config.merchantName = cleanName; // Aseguramos usar el limpio
        state.config.whatsapp = document.getElementById("inp-whatsapp").value;
        state.config.updateTime = document.getElementById("inp-time").value;
        state.config.updateGap = document.getElementById("inp-gap").value;

        SafeStorage.setItem(
            `config_${state.user.uid}`,
            JSON.stringify(state.config),
        );

        try {
            await api.saveMerchantConfig(state.config);

            setTimeout(() => {
                app.toggleLoading(false);
                app.showToast("Configuración guardada y optimizada");
                app.checkConfigStatus();

                btn.disabled = false;
                btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Guardar';
                lucide.createIcons();
            }, 500);
        } catch (e) {
            console.error("Error saving config", e);
            app.toggleLoading(false);
            app.showToast("Error al guardar la configuración", "error");

            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i> Guardar';
            lucide.createIcons();
        }
    },

    changePassword: async () => {
        const newPass = document.getElementById("inp-new-pass").value.trim();
        if (!newPass) return;
        app.showModal(
            "¿Estás seguro de cambiar tu contraseña actual?",
            async () => {
                app.toggleLoading(true);
                try {
                    await api.updatePassword(newPass);
                    document.getElementById("inp-new-pass").value = "";
                    app.showToast("Contraseña actualizada");
                } catch (e) {
                    console.error("Error updating password", e);
                    app.showToast("Error al actualizar contraseña", "error");
                }
                app.toggleLoading(false);
            },
        );
    },

    // --- NUEVO HELPER: Genera la URL correcta dinámicamente ---
    getShareUrl: () => {
        // 1. Detecta la carpeta actual (ej: /landing/ o /)
        const path = window.location.pathname;
        const folder = path.substring(0, path.lastIndexOf("/") + 1);

        // 2. Construye la URL apuntando a form.html
        return `${window.location.origin}${folder}form?merchant=${state.user.uid}`;
    },

    // --- FUNCIONES MODIFICADAS ---

    copyLink: () => {
        const text = app.getShareUrl(); // <--- Usamos el helper
        const fallbackCopy = (t) => {
            const ta = document.createElement("textarea");
            ta.value = t;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
        };
        if (navigator.clipboard && navigator.clipboard.writeText)
            navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        else fallbackCopy(text);
        app.showToast("Enlace copiado al portapapeles");
    },

    shareOnWhatsapp: () => {
        const url = app.getShareUrl(); // <--- Usamos el helper
        const message = `${url}\n*PROGRAMA TU ENVÍO AQUÍ* ☝️`;
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    },

    openClientLink: () => {
        const url = app.getShareUrl(); // <--- Usamos el helper
        window.open(url, "_blank");
    },

    loadData: async () => {
        app.toggleLoading(true);

        // 1. Cargar Configuración
        state.config = { ...initialState };
        try {
            const json = await api.getMerchantConfig();
            if (json.dataJson) state.config = json.dataJson;
            delete state.config.isNewConfig; // Limpiamos la bandera si existe
        } catch (e) {
            const local = SafeStorage.getItem(`config_${state.merchantId}`);
            const config = local ? JSON.parse(local) : state.config;
            state.config = { ...config, isNewConfig: true };
        }

        // 2. Verificar estado del plan
        if (state.user && state.merchantId) {
            try {
                const jsonStatus = await api.getMerchantStatus();

                if (jsonStatus && jsonStatus.plan !== state.user.plan) {
                    state.user.plan = jsonStatus.plan;
                    if (jsonStatus.plan === "Gratis") delete state.user.trialEndsAt;
                    SafeStorage.setItem("app_current_user", JSON.stringify(state.user));
                    app.showToast("Tu plan se ha actualizado");
                }
            } catch (e) {
                console.log("Offline or API check failed", e);
            }

            document
                .querySelectorAll(".user-phone-display")
                .forEach((el) => (el.innerText = state.user.phone));
            if (state.user.plan)
                document
                    .querySelectorAll(".user-plan-display")
                    .forEach(
                        (el) => (el.innerText = `PLAN ${state.user.plan.toUpperCase()}`),
                    );
        }

        // 3. Renderizado (Directo al dashboard, ya no hay cliente)
        app.renderDashboard();
        app.loadOrders();

        app.toggleLoading(false);
    },

    // --- onFilterChange FUSIONADA (Conserva tu lógica original + lo nuevo) ---

    onFilterChange: () => {
        // 1. LÓGICA ORIGINAL (IMPORTANTE: Limpiar selección al filtrar)
        // Esto estaba en tu código base y evita errores al filtrar cosas ya seleccionadas
        state.selectedOrders.clear();

        // Ocultar barra de acciones si existe (botones de eliminar/imprimir masivo)
        const toolbar = document.getElementById("selection-actions");
        if (toolbar) toolbar.classList.add("hidden");

        // Resetear contador de seleccionados
        const countEl = document.getElementById("selected-count");
        if (countEl) countEl.innerText = "0";

        // 2. LÓGICA NUEVA (El puntito indicador de fecha)
        const dSpec = document.getElementById("date-specific");
        const indicator = document.getElementById("date-indicator");

        if (dSpec && indicator) {
            if (dSpec.value) indicator.classList.remove("hidden");
            else indicator.classList.add("hidden");
        }

        // 3. RENDERIZAR
        app.renderOrders();
    },

    downloadFormat: async (type) => {
        app.toggleLoading(true);
        document.getElementById("modal-export").classList.add("hidden"); // Cerrar modal

        // Cargar SheetJS si no existe
        if (typeof XLSX === "undefined") {
            await new Promise((r) => {
                const s = document.createElement("script");
                s.src =
                    "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
                s.onload = r;
                document.head.appendChild(s);
            });
        }

        const list = state.visibleOrders;
        let dataToExport = [];
        let fileName = "";
        let sheetName = "";

        // Obtenemos el año completo (ej: 2025)
        const currentYearFull = new Date().getFullYear();

        // --- 1. SHALOM (.xlsx) ---
        if (type === "shalom") {
            const shalomList = list.filter((x) => x.courier.match(/shalom/i));

            dataToExport = shalomList.map((x) => {
                let destino = "";
                let rawName = "";

                // A. Extraer nombre de la agencia (antes del PIPE)
                if (x.clientAgency && x.clientAgency.includes("|")) {
                    rawName = x.clientAgency.split("|")[0].trim();
                } else {
                    rawName = x.clientAgency || x.clientDistrict || "";
                }

                // B. LÓGICA DE "ÚLTIMO DATO"
                if (rawName.includes("/")) {
                    const parts = rawName.split("/");
                    destino = parts[parts.length - 1].trim().toUpperCase();
                } else {
                    destino = rawName.toUpperCase();
                }

                return {
                    "DESTINATARIO (DOC)": x.clientDni || "",
                    "TELF. DESTINATARIO": x.clientPhone || "",
                    "CONTACTO (DOC)": null,
                    "TELF. CONTACTO": null,
                    "NRO GRR": null,
                    "ORIGEN": null,
                    "DESTINO": destino,
                    "MERCADERIA": null,
                    "ALTO": null,
                    "ANCHO": null,
                    "LARGO": null,
                    "PESO": null,
                    "CANTIDAD": "1",
                };
            });
            fileName = `CargaMasiva_Shalom_${new Date().toISOString().slice(0, 10)}.xlsx`;
            sheetName = "Hoja1";
        }

        // --- 2. OLVA COURIER (.xlsx) ---
        else if (type === "olva") {
            const olvaList = list.filter((x) => x.courier.match(/olva/i));

            dataToExport = olvaList.map((x, idx) => {
                const nameParts = (x.clientName || "").split(" ");
                let nombres = nameParts[0];
                let apPaterno = nameParts.length > 1 ? nameParts[1] : ".";
                let apMaterno =
                    nameParts.length > 2 ? nameParts.slice(2).join(" ") : ".";

                const isAgency = !!x.clientAgency;
                let direccion = "",
                    tienda = "",
                    distrito = "",
                    provincia = "LIMA",
                    dpto = "LIMA";

                if (isAgency && x.clientAgency.includes("|")) {
                    tienda = x.clientAgency.split("|")[0].trim();
                } else {
                    direccion =
                        `${x.clientAddress} ${x.clientRef ? "(" + x.clientRef + ")" : ""}`.trim();
                    distrito = x.clientDistrict || "";
                }

                return {
                    "Nro envío": idx + 1,
                    "Tipo de entrega": isAgency
                        ? "Recojo en Tienda"
                        : "Entrega a domicilio",
                    Departamento: dpto,
                    Provincia: provincia,
                    Distrito: distrito,
                    Dirección: direccion,
                    Tienda: tienda,
                    Referencia: x.clientRef || "",
                    "Tipo Empaque": "Paquete",
                    "Tipo Artículo": "VARIOS",
                    "Descripción de Artículo": "MERCADERIA",
                    "Valor del Envío (S/.)": "0",
                    "Peso (kg)": "1",
                    "Largo (cm)": "10",
                    "Ancho (cm)": "10",
                    "Alto (cm)": "10",
                    "¿Retorno de Cargo?": "NO",
                    "# Folios": "0",
                    "Tipo Documento": "DNI",
                    "Nro DNI/RUC/CE": x.clientDni || "00000000",
                    Celular: x.clientPhone,
                    "Razón Social": "",
                    Contacto: "",
                    Nombres: nombres,
                    "Apellido Paterno": apPaterno,
                    "Apellido Materno": apMaterno,
                };
            });
            fileName = `CargaMasiva_Olva_${new Date().toISOString().slice(0, 10)}.xlsx`;
            sheetName = "InputData";
        }

        // --- 3. DINSIDES (.xlsx) ---
        else if (type === "dinsides") {
            const dinsidesList = list.filter((x) => x.courier.match(/dinsides/i));

            dataToExport = dinsidesList.map((x) => {
                // A. LIMPIEZA DE DISTRITO: "Lince (S/.10)" -> "Lince"
                let distLimpio = x.clientDistrict || "";
                if (distLimpio.includes("(")) {
                    distLimpio = distLimpio.split("(")[0].trim();
                }

                // B. FECHA FORMATO dd/mm/aaaa
                let fechaEntrega = "";
                if (x.shippingDate) {
                    // Buscamos patrones numéricos dia/mes (ej: 25/11)
                    const match = x.shippingDate.match(/(\d{2})\/(\d{2})/);
                    if (match) {
                        // Construimos: 25/11/2025
                        fechaEntrega = `${match[1]}/${match[2]}/${currentYearFull}`;
                    }
                }

                return {
                    CARGA: "CARGAR",
                    "TIPO DE VENTA (SELECCIONE SOLO DEL LISTADO)": "",
                    "NOMBRE DEL DESTINATARIO": x.clientName,
                    "TELEFONO DESTINATARIO 9 DIGITOS": x.clientPhone,
                    "DISTRITO (SELECCIONE SOLO DEL LISTADO)": distLimpio,
                    "DIRECCION DE ENTREGA": x.clientAddress || "",
                    "COORDENADAS DE LA DIRECCIÓN": "",
                    "FECHA DE ENTREGA (DIA/MES/AÑO)": fechaEntrega, // <--- FORMATO CORREGIDO
                    "DETALLE DEL PRODUCTO": "",
                    "MONTO A COBRAR (decimales se separan con punto . )": "0.00",
                    "FORMA DE PAGO": "",
                    OBSERVACION: x.clientRef || "",
                };
            });
            fileName = `CargaMasiva_Dinsides_${new Date().toISOString().slice(0, 10)}.xlsx`;
            sheetName = "PEDIDOS";
        }

        // --- 4. REPORTE GENERAL (.xlsx) ---
        else {
            const shortYear = currentYearFull.toString().slice(-2); // "25"
            dataToExport = list.map((x) => {
                let fechaClean = x.shippingDate || "";
                const dateMatch = fechaClean.match(/(\d{2})\/(\d{2})/);
                if (dateMatch)
                    fechaClean = `${dateMatch[1]}/${dateMatch[2]}/${shortYear}`;

                let colAgenciaDistrito = "",
                    colDireccionRef = "",
                    colDni = "";

                if (x.clientAgency) {
                    let parts = x.clientAgency.split(" | ");
                    if (parts.length < 2) parts = [x.clientAgency, ""];
                    colAgenciaDistrito = parts[0] || x.clientAgency;
                    colDireccionRef = parts[1] || "";
                    colDni = x.clientDni || "";
                } else {
                    colAgenciaDistrito = x.clientDistrict || "";
                    const dir = x.clientAddress || "";
                    const ref = x.clientRef ? ` (Ref: ${x.clientRef})` : "";
                    colDireccionRef = (dir + ref).trim();
                }

                return {
                    "Fecha Envío": fechaClean,
                    Courier: x.courier,
                    Cliente: x.clientName,
                    Teléfono: x.clientPhone,
                    "Agencia / Distrito": colAgenciaDistrito,
                    "Dirección / Ref": colDireccionRef,
                    DNI: colDni,
                    Estado: x.status || "PENDIENTE",
                };
            });
            fileName = `ReporteGeneral_${new Date().toISOString().slice(0, 10)}.xlsx`;
            sheetName = "Reporte";
        }

        // --- GENERACIÓN DEL ARCHIVO ---
        if (dataToExport.length === 0) {
            app.toggleLoading(false);
            return app.showToast(
                "⚠️ No hay envíos de este courier en la lista actual",
            );
        }

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        XLSX.writeFile(wb, fileName);

        app.toggleLoading(false);
        app.showToast(`Descarga exitosa: ${fileName}`);
    },

    // --- NUEVA LÓGICA DE PEDIDOS (Filtrado & Selección) ---
    loadOrders: async () => {
        const l = document.getElementById("orders-list");
        l.innerHTML =
            '<div class="text-center py-10 text-slate-400 flex flex-col items-center gap-2"><i data-lucide="loader" class="animate-spin w-6 h-6"></i> Cargando envíos...</div>';
        lucide.createIcons();

        try {
            const json = await api.getOrders();

            // AQUI APLICAMOS EL FILTRO DE PLAN
            // Revisar plan local (incluyendo 'Pro (Prueba)')
            const userPlan = state.user ? state.user.plan : "Gratis";
            const isFree = userPlan === "Gratis";

            let rawOrders =
                json.orders?.map((order) => {
                    const dataJson = order.dataJson || {};
                    return { ...dataJson, ...order };
                }) || [];

            // Si es gratis, NO CARGAR NADA en allOrders, pero guardar el total para el contador
            if (isFree) {
                state.allOrders = [];
                state.hasHiddenOrders = true;
                state.totalHiddenCount = rawOrders.length;
            } else {
                // Si es Pro/Empresa/Prueba, cargar todo
                state.allOrders = rawOrders;
                state.hasHiddenOrders = false;
                state.totalHiddenCount = 0;
            }

            state.selectedOrders.clear();

            // Actualizar contador en el aviso
            const hiddenCountEl = document.getElementById("hidden-count");
            if (hiddenCountEl) hiddenCountEl.innerText = state.totalHiddenCount;
        } catch (e) {
            state.allOrders = [];
            app.showToast("Error al cargar los pedidos", "error");
        }
        app.renderOrders();
    },

    // 1. ABRIR / CERRAR MENÚ DROPDOWN
    toggleDropdown: () => {
        const menu = document.getElementById("filter-dropdown-menu");
        const overlay = document.getElementById("dropdown-overlay");
        const chevron = document.getElementById("filter-chevron");

        if (menu.classList.contains("hidden")) {
            menu.classList.remove("hidden");
            overlay.classList.remove("hidden");
            chevron.style.transform = "rotate(180deg)";
        } else {
            app.closeDropdown();
        }
    },

    closeDropdown: () => {
        const menu = document.getElementById("filter-dropdown-menu");
        const overlay = document.getElementById("dropdown-overlay");
        const chevron = document.getElementById("filter-chevron");

        if (menu) menu.classList.add("hidden");
        if (overlay) overlay.classList.add("hidden");
        if (chevron) chevron.style.transform = "rotate(0deg)";
    },

    // 2. CAMBIAR FILTRO (Y MANTENER ESTILO COMPACTO)
    setFilterStatus: (status) => {
        state.filterStatus = status;

        const label = document.getElementById("filter-label-display");
        const btn = document.getElementById("filter-trigger-btn");

        const texts = {
            PENDIENTE: "Pendientes",
            ENVIADO: "Enviados",
            TODOS: "Todos",
        };
        if (label) label.innerText = texts[status];

        // ESTILO ULTRA COMPACTO (h-full hereda h-8, px-2.5, text-xs)
        btn.className =
            "h-full px-2.5 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm border transition active:scale-95 shrink-0 text-xs";

        // Asignar colores según estado
        if (status === "PENDIENTE") {
            btn.classList.add("bg-primary", "border-primary");
        } else if (status === "ENVIADO") {
            btn.classList.add("bg-secondary", "border-secondary");
        } else {
            btn.classList.add("bg-slate-700", "border-slate-500");
        }

        app.closeDropdown();
        app.onFilterChange(); // Ejecutar el filtro inmediatamente
    },

    // --- renderOrders: DISEÑO FINAL (HEADER PRO + WIDGET) ---

    renderOrders: () => {
        const l = document.getElementById("orders-list");
        const q = (
            document.getElementById("inp-search-orders").value || ""
        ).toLowerCase();
        const dSpec = document.getElementById("date-specific").value;

        // 1. FILTRADO
        const filtered = state.allOrders.filter((x) => {
            if (state.filterStatus !== "TODOS") {
                const currentStatus = x.status || "PENDIENTE";
                if (currentStatus !== state.filterStatus) return false;
            }
            const txt =
                `${x.clientName} ${x.clientPhone} ${x.clientDni || ""} ${x.clientDistrict || ""} ${x.clientAgency || ""} ${x.clientAddress || ""} ${x.clientRef || ""} ${x.courier} ${x.status || ""}`.toLowerCase();
            if (!txt.includes(q)) return false;

            if (dSpec) {
                const [year, month, day] = dSpec.split("-");
                const orderDate = (x.shippingDate || "").toString();
                if (
                    !orderDate.includes(`${year}-${month}-${day}`) &&
                    !orderDate.includes(`${day}/${month}/${year}`) &&
                    !orderDate.includes(`${day}/${month}`)
                )
                    return false;
            }
            return true;
        });

        state.visibleOrders = filtered;

        // 2. ACTUALIZAR WIDGET SIDEBAR
        const breakdownEl = document.getElementById("courier-breakdown-list");
        if (breakdownEl) {
            if (filtered.length === 0) {
                breakdownEl.innerHTML =
                    '<span class="text-xs text-slate-500 italic">Sin resultados</span>';
            } else {
                const counts = filtered.reduce((acc, order) => {
                    const c = (order.courier || "Otros").toUpperCase().trim();
                    acc[c] = (acc[c] || 0) + 1;
                    return acc;
                }, {});

                breakdownEl.innerHTML = Object.keys(counts)
                    .sort()
                    .map(
                        (key) => `
                <div class="flex justify-between items-center group/item">
                    <span class="text-xs font-bold text-slate-300 group-hover/item:text-white transition-colors truncate max-w-[70%]">${key}</span>
                    <span class="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">${counts[key]}</span>
                </div>
            `,
                    )
                    .join("");

                if (Object.keys(counts).length > 1) {
                    breakdownEl.innerHTML += `
                <div class="mt-1 pt-2 border-t border-white/5 flex justify-between items-center">
                    <span class="text-[10px] uppercase text-slate-500 font-bold">Total</span>
                    <span class="text-xs font-bold text-white">${filtered.length}</span>
                </div>`;
                }
            }
        }

        // 3. RENDERIZADO
        if (!filtered.length) {
            if (
                state.hasHiddenOrders &&
                state.filterStatus === "PENDIENTE" &&
                q === ""
            ) {
                l.innerHTML = "";
            } else if (state.filterStatus === "PENDIENTE" && q === "" && !dSpec) {
                l.innerHTML =
                    '<div class="text-center py-10 text-slate-500 flex flex-col items-center"><i data-lucide="check-circle" class="w-8 h-8 mb-2 text-green-500/50"></i><p>¡Todo al día!</p><p class="text-xs">No tienes envíos pendientes.</p></div>';
            } else {
                l.innerHTML =
                    '<div class="text-center py-10 text-slate-400">Sin resultados</div>';
            }
        } else {
            const groups = filtered.reduce((acc, order) => {
                const key = (order.courier || "OTROS").toUpperCase().trim();
                if (!acc[key]) acc[key] = [];
                acc[key].push(order);
                return acc;
            }, {});

            const sortedKeys = Object.keys(groups).sort();

            l.innerHTML = sortedKeys
                .map((courierName) => {
                    const ordersInGroup = groups[courierName];
                    const cardsHtml = ordersInGroup
                        .map((x) => {
                            const id = String(x.orderId || x.createdAt);
                            const isSel = state.selectedOrders.has(id);
                            const status = x.status || "PENDIENTE";
                            let badgeClass =
                                "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
                            if (status === "ENVIADO")
                                badgeClass =
                                    "bg-secondary/20 text-secondary border border-secondary/30";
                            if (status === "ELIMINADO")
                                badgeClass =
                                    "bg-red-500/20 text-red-400 border border-red-500/30";

                            return `
                <div class="bg-black/30 border ${isSel ? "border-primary ring-1 ring-primary bg-primary/10" : "border-white/10"} p-3 rounded-lg shadow-sm hover:border-white/20 transition group flex gap-3 items-start mb-2 last:mb-0">
                    <div class="pt-1">
                        <input type="checkbox" onchange="app.toggleOrderSelection('${id}')" ${isSel ? "checked" : ""} class="w-4 h-4 rounded border-slate-500 text-primary focus:ring-primary cursor-pointer bg-black/40">
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between font-bold text-slate-200">
                            <span class="truncate text-white">${escapeHtml(x.clientName)}</span>
                            <div class="flex items-center gap-2">
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded ${badgeClass}">${status}</span>
                                <button onclick="app.sendClientSummary('${id}')" class="text-secondary hover:text-white hover:bg-secondary/20 p-1 rounded-full transition" title="Enviar WhatsApp">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" class="w-4 h-4"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="text-xs text-slate-400 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 items-center">
                            <span class="flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3 text-primary"></i> ${escapeHtml(x.clientPhone)}</span>
                            <span class="flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3 text-primary"></i> ${escapeHtml(x.shippingDate)}</span>
                        </div>
                        <div class="text-xs text-slate-300 mt-2 font-medium border-t border-white/5 pt-2">
                            ${x.clientAgency
                                    ? `🏢 ${escapeHtml(x.clientAgency)}`
                                    : !x.clientAddress
                                        ? `🏢 Retiro en tienda`
                                        : `🏠 ${escapeHtml(x.clientDistrict)} - ${escapeHtml(x.clientAddress || "")}`
                                }
                        </div>
                    </div>
                </div>`;
                        })
                        .join("");

                    return `
            <div class="mb-4 relative">
                <div class="sticky top-0 z-30 backdrop-blur-xl bg-slate-950/80 border-y border-white/10 shadow-lg py-2.5 px-3 mb-3 flex items-center justify-between transition-all">
                    <div class="flex items-center gap-3">
                        <div class="w-1 h-5 bg-gradient-to-b from-primary to-purple-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                        <div class="flex items-center gap-2">
                            <div class="bg-white/5 p-1 rounded-md">
                                <i data-lucide="truck" class="w-3.5 h-3.5 text-slate-300"></i>
                            </div>
                            <h3 class="font-bold text-sm text-white tracking-wide shadow-black drop-shadow-md">
                                ${courierName}
                            </h3>
                        </div>
                    </div>
                    <div class="flex items-center">
                        <span class="text-[10px] font-bold bg-white/5 text-slate-300 px-2.5 py-1 rounded-lg border border-white/5 shadow-inner">
                            ${ordersInGroup.length} 
                            <span class="hidden sm:inline font-normal text-slate-300 ml-1">envíos</span>
                        </span>
                    </div>
                </div>
                <div class="flex flex-col gap-2 px-1">
                    ${cardsHtml}
                </div>
            </div>
            `;
                })
                .join("");
        }

        const warningEl = document.getElementById("plan-limit-warning");
        if (warningEl) {
            if (state.hasHiddenOrders) warningEl.classList.remove("hidden");
            else warningEl.classList.add("hidden");
        }

        lucide.createIcons();
    },

    toggleOrderSelection: (id) => {
        const strId = String(id);
        if (state.selectedOrders.has(strId)) state.selectedOrders.delete(strId);
        else state.selectedOrders.add(strId);
        app.renderOrders();
    },

    toggleAllSelection: () => {
        // Usamos SOLO los pedidos visibles (filtrados)
        const list = state.visibleOrders;

        // Si no hay nada en pantalla, no hacemos nada
        if (list.length === 0) return;

        const allSelected = list.every((x) =>
            state.selectedOrders.has(String(x.orderId || x.createdAt)),
        );

        if (allSelected) {
            // Si todos los visibles están marcados, los DESMARCAMOS
            list.forEach((x) =>
                state.selectedOrders.delete(String(x.orderId || x.createdAt)),
            );
        } else {
            // Si falta alguno, los MARCAMOS todos los visibles
            list.forEach((x) =>
                state.selectedOrders.add(String(x.orderId || x.createdAt)),
            );
        }

        app.renderOrders();
        app.updateSelectionUI();
    },

    deleteSelected: () => {
        if (state.selectedOrders.size === 0)
            return app.showToast("Selecciona al menos un envío");
        app.showModal(
            `¿Eliminar ${state.selectedOrders.size} envíos?`,
            async () => {
                app.toggleLoading(true);
                const ids = Array.from(state.selectedOrders);
                try {
                    await api.deleteOrders(ids);
                    app.showToast("Envíos eliminados");
                    app.loadOrders();
                } catch (e) {
                    app.showToast("Error al eliminar envíos", "error");
                }
                app.toggleLoading(false);
            },
        );
    },

    updateBatchStatus: () => {
        if (state.selectedOrders.size === 0)
            return app.showToast("Selecciona envíos");
        app.openStatusMenu();
    },

    exportExcel: () => {
        const list = state.visibleOrders;
        if (!list.length) return app.showToast("No hay datos para exportar");

        // 1. Analizar qué couriers hay en la lista visible
        const counts = { Shalom: 0, "Olva Courier": 0, Dinsides: 0 };

        list.forEach((o) => {
            // Normalizamos nombres para evitar errores de mayúsculas/minúsculas
            if (o.courier.match(/shalom/i)) counts["Shalom"]++;
            else if (o.courier.match(/olva/i)) counts["Olva Courier"]++;
            else if (o.courier.match(/dinsides/i)) counts["Dinsides"]++;
        });

        // 2. Generar botones dinámicos
        const container = document.getElementById("export-options");
        container.innerHTML = ""; // Limpiar anterior

        // Helper para crear botones bonito
        const createBtn = (name, count, colorClass, iconClass, type) => {
            if (count === 0) return "";
            return `
                    <button onclick="app.downloadFormat('${type}')" class="w-full flex items-center justify-between p-3 rounded-lg bg-slate-800 border border-white/5 hover:bg-slate-700 transition group">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full ${colorClass} bg-opacity-20 flex items-center justify-center border border-white/10">
                                <span class="font-bold text-xs">${iconClass}</span>
                            </div>
                            <div class="text-left">
                                <p class="text-sm font-bold text-white">Formato ${name}</p>
                                <p class="text-xs text-slate-500">${count} envíos listos para carga masiva</p>
                            </div>
                        </div>
                        <i data-lucide="download" class="w-4 h-4 text-slate-500 group-hover:text-white"></i>
                    </button>`;
        };

        container.innerHTML += createBtn(
            "Shalom",
            counts["Shalom"],
            "bg-blue-500 text-blue-400",
            "SH",
            "shalom",
        );
        container.innerHTML += createBtn(
            "Olva",
            counts["Olva Courier"],
            "bg-orange-500 text-orange-400",
            "OL",
            "olva",
        );
        container.innerHTML += createBtn(
            "Dinsides",
            counts["Dinsides"],
            "bg-purple-500 text-purple-400",
            "DS",
            "dinsides",
        );

        // 3. Mostrar Modal
        document.getElementById("modal-export").classList.remove("hidden");
        lucide.createIcons();
    },

    printLabels: () => {
        const targets =
            state.selectedOrders.size > 0
                ? state.allOrders.filter((x) =>
                    state.selectedOrders.has(String(x.orderId || x.createdAt)),
                )
                : state.visibleOrders;

        if (!targets.length) return app.showToast("Nada para imprimir");

        // UX: Preguntar al usuario el formato antes de proceder
        app.openModal(`
                    <div class="text-center">
                        <div class="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 text-primary mx-auto">
                            <i data-lucide="printer" class="w-8 h-8"></i>
                        </div>
                        <h3 class="text-xl font-bold text-white mb-2">Formato de Impresión</h3>
                        <p class="text-slate-400 text-sm mb-6">¿Cómo deseas organizar las etiquetas en la hoja?</p>

                        <div class="grid grid-cols-2 gap-4">
                            <button onclick="app.doPrint(app.tempTargets, 1)" class="p-4 rounded-xl border border-white/10 hover:border-primary hover:bg-primary/5 transition group">
                                <div class="flex flex-col items-center gap-2">
                                    <div class="w-full h-12 bg-slate-800 rounded border-2 border-dashed border-slate-600 flex flex-col p-1 gap-1">
                                        <div class="h-full w-full bg-slate-500 rounded-sm"></div>
                                    </div>
                                    <span class="text-xs font-bold text-white">1 Columna</span>
                                </div>
                            </button>

                            <button onclick="app.doPrint(app.tempTargets, 2)" class="p-4 rounded-xl border border-white/10 hover:border-primary hover:bg-primary/5 transition group">
                                <div class="flex flex-col items-center gap-2">
                                    <div class="w-full h-12 bg-slate-800 rounded border-2 border-dashed border-slate-600 flex grid grid-cols-2 p-1 gap-1">
                                        <div class="h-full bg-slate-500 rounded-sm"></div>
                                        <div class="h-full bg-slate-500 rounded-sm"></div>
                                    </div>
                                    <span class="text-xs font-bold text-white">2 Columnas</span>
                                </div>
                            </button>
                        </div>
                    </div>
                `);

        // Guardamos los targets temporalmente para que doPrint los use
        app.tempTargets = targets;
        if (window.lucide) lucide.createIcons();
    },

    doPrint: (list, cols = 2) => {
        if (!list.length) return;
        const area = document.getElementById("print-area");
        const shopName = state.config.merchantName || "Mi Tienda";
        const cardWidth = cols === 1 ? "98%" : "48%";
        const m = cols === 2 ? 1 : 2;

        // CORRECCIÓN: Usamos 'block' en el contenedor y 'inline-block' en las tarjetas.
        // Esto evita que el navegador móvil parta las tarjetas entre páginas.
        area.innerHTML = `
                    <div style="width: 100%; font-size: 0; /* Elimina espacios fantasma */">
                        ${list.map(x => {
                            const agencyParts = x.clientAgency ? x.clientAgency.split(' | ') : [];
                            const location = agencyParts[0] || '';
                            const address = agencyParts.slice(1).join(' | ');

                            let destLine1 = location;
                            let destLine2 = '';
                            console.log("coureier -", x.courier);
                            if (x.clientAgency && multiAddressCouriers.includes(x.courier)) { //}   (x.courier || '') === 'Shalom') {
                                const parts = location.split(' / ').map(s => s.trim()).filter(Boolean);
                                const last = parts.pop() || '';
                                destLine1 = parts.join(' / ');
                                destLine2 = last;
                            }

                            const isStore = (x.courier || '') === 'Retiro en tienda';

                            return `
                            <div style="
                                display: inline-block; 
                                width: ${cardWidth};
                                margin: 1%; 
                                vertical-align: top; 
                                border: 1px solid #000; 
                                padding: 10px; 
                                box-sizing: border-box; /* Asegura que el padding no rompa el ancho */
                                
                                /* PROPIEDADES ANTI-ROTURA PARA MÓVIL */
                                page-break-inside: avoid; 
                                break-inside: avoid; 
                                
                                font-family: 'Segoe UI', sans-serif; 
                                border-radius: 8px; 
                                background: white; 
                                font-size: ${12 * m}px;
                            ">
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #777; padding-bottom: 8px; margin-bottom: 8px;">
                                    <div style="font-size: ${8 * m}px; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Remitente</div>
                                    <div style="font-weight: bold; font-size: ${10 * m}px; color: #000;">${escapeHtml(shopName).substring(0, 20)}</div>
                                </div>
                                
                                <div style="margin-bottom: 8px;">
                                    <p style="margin: 0; font-size: ${7 * m}px; color: #666; font-weight: bold; text-transform: uppercase;">DESTINATARIO:</p>
                                    <h2 style="margin: 2px 0; font-size: ${12 * m}px; font-weight: 900; color: #000; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(x.clientName).toUpperCase()}</h2>
                                    ${x.clientDni ? `<p style="margin: 0; font-size: ${9 * m}px; color: #000;">N\u00B0DOC: ${escapeHtml(x.clientDni)}</p>` : ''}
                                    <p style="margin: 0; font-size: ${9 * m}px; color: #000;">Cel: ${escapeHtml(x.clientPhone)}</p>
                                </div>
                                
                                ${!isStore ? `
                                <div style="margin-bottom: 8px; min-height: 35px;">
                                    <p style="margin: 0; font-size: ${8 * m}px; color: #666; font-weight: bold; text-transform: uppercase;">DESTINO:</p>
                                    ${x.clientAgency ? `
                                    <p style="margin: 2px 0 0 0; font-size: ${9 * m}px; color: #000; line-height: 1.3;">
                                        ${escapeHtml(destLine1)}${destLine2 ? `<br><span style="font-size: ${11 * m}px; color: #000; font-weight: bold;">${escapeHtml(destLine2)}</span>` : ''}${address ? `<br>${escapeHtml(address)}` : ''}
                                    </p>` : `
                                    <p style="margin: 2px 0 0 0; font-size: ${9 * m}px; color: #000; line-height: 1.3;">
                                        ${escapeHtml(x.clientDistrict)}<br>${escapeHtml(x.clientAddress)}
                                    </p>
                                    ${x.clientRef ? `<p style="margin: 2px 0 0 0; font-size: ${8 * m}px; color: #555;">Ref: ${escapeHtml(x.clientRef)}</p>` : ''}`}
                                </div>` : `
                                <div style="margin-bottom: 8px; min-height: 35px;">
                                    <p style="margin: 0; font-size: ${8 * m}px; color: #666; font-weight: bold; text-transform: uppercase;">DESTINO:</p>
                                    <p style="margin: 2px 0 0 0; font-size: ${9 * m}px; color: #000;">Retiro en tienda</p>
                                </div>`}
                                
                                <div style="border-top: 1px solid #777; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; color: #000;">
                                    <span style="font-size: ${10 * m}px; font-weight: 800; text-transform: uppercase; background: #eee; padding: 2px 5px; border-radius: 4px;">${escapeHtml(x.courier)}</span>
                                    <span style="font-size: ${9 * m}px; font-weight: bold;">${escapeHtml(x.shippingDate || "PENDIENTE")}</span>
                                </div>
                            </div>
                            `;
                        }).join('')}
                    </div>
                `;
        window.print();
    },

    toggleConfigItem: (k, v) => {
        if (state.config[k].includes(v))
            state.config[k] = state.config[k].filter((i) => i !== v);
        else state.config[k].push(v);
        app.renderDashboard();
        app.checkConfigStatus(); // <--- IMPORTANTE: Revalida al tocar botones de courier/dias
    },

    renderDashboard: () => {
        document.getElementById("inp-store-name").value =
            state.config.merchantName || "";
        document.getElementById("inp-whatsapp").value = state.config.whatsapp || "";
        document.getElementById("inp-time").value = state.config.updateTime || "";

        // --- NUEVO: Renderizar el valor del gap ---
        document.getElementById("inp-gap").value =
            state.config.updateGap !== undefined ? state.config.updateGap : "";

        // Inputs con oninput para validación en tiempo real
        document.getElementById("inp-store-name").oninput = (e) =>
            app.updateConfigInput("merchantName", e.target.value);
        document.getElementById("inp-whatsapp").oninput = (e) =>
            app.updateConfigInput("whatsapp", e.target.value);

        // Renderizado de Botones (Igual que antes)
        document.getElementById("container-couriers").innerHTML = ALL_COURIERS.map(
            (c) =>
                `<div onclick="app.toggleConfigItem('couriers','${c}')" class="cursor-pointer bg-black/30 border border-white/10 rounded p-2 text-xs font-bold flex items-center gap-2 select-none ${state.config.couriers.includes(c) ? "border-primary text-primary bg-primary/10" : "text-slate-400 hover:bg-white/5"} transition"><div class="w-3 h-3 border rounded flex items-center justify-center ${state.config.couriers.includes(c) ? "bg-primary border-primary" : "border-slate-500"}">${state.config.couriers.includes(c) ? '<i data-lucide="check" class="w-2 h-2 text-white"></i>' : ""}</div>${c}</div>`,
        ).join("");
        document.getElementById("container-days").innerHTML = ALL_DAYS.map(
            (d) =>
                `<button onclick="app.toggleConfigItem('shippingDays','${d}')" class="px-3 py-1 rounded text-xs font-bold border transition ${state.config.shippingDays.includes(d) ? "bg-primary text-white border-primary shadow-neon" : "bg-black/30 text-slate-400 border-white/10 hover:bg-white/5"}">${d}</button>`,
        ).join("");

        lucide.createIcons();

        // Validar estado inicial al renderizar
        app.checkConfigStatus();
    },

    setTab: (t) => {
        // --- BLOQUEO DE SEGURIDAD UX ---
        if (t === "share") {
            const validation = app.validateConfig();
            if (!validation.isValid) {
                // Feedback UX: Listamos lo que falta
                const missing = validation.errors.join(", ");
                app.showToast(`⚠️ Falta configurar: ${missing}`);

                // Efecto visual de error (sacudida) en la pestaña config
                const configTab = document.getElementById("nav-config");
                configTab.classList.add("animate-pulse", "text-red-400");
                setTimeout(
                    () => configTab.classList.remove("animate-pulse", "text-red-400"),
                    1000,
                );

                // Forzamos volver a config
                app.setTab("config");
                return;
            }
        }
        // -------------------------------

        ["config", "share", "orders"].forEach((x) => {
            document.getElementById(`tab-${x}`).classList.add("hidden");
            // Restauramos clases base
            document.getElementById(`nav-${x}`).className =
                "nav-item p-3 rounded-lg text-sm font-bold text-left flex gap-3 items-center text-slate-400 hover:bg-white/5 hover:text-white transition whitespace-nowrap";
        });

        document.getElementById(`tab-${t}`).classList.remove("hidden");
        // Clase activa
        document.getElementById(`nav-${t}`).className =
            "nav-item p-3 rounded-lg text-sm font-bold bg-primary/10 text-primary border border-primary/20 text-left flex gap-3 items-center transition shadow-neon";

        if (t === "share") {
            // Actualizamos visualmente el texto usando la misma lógica
            document.getElementById("share-link").innerText = app.getShareUrl();
        }

        // Si entramos a config, chequeamos el estado visualmente
        if (t === "config") app.checkConfigStatus();
    },

    init: () => {
        // Ya no buscamos merchant en URL
        const u = JSON.parse(SafeStorage.getItem("app_current_user"));

        if (u && !api.isAuthenticated()) {
            app.logout();
            return;
        }

        // Ocultamos todas las vistas por defecto
        document
            .querySelectorAll('[id^="view-"]')
            .forEach((el) => el.classList.add("hidden"));

        if (u) {
            state.user = u;
            if (u.isAdmin) {
                // Si es Admin Maestro
                document.getElementById("view-admin").classList.remove("hidden");
                app.adminLoadUsers();
            } else {
                // Si es Emprendedor
                state.merchantId = u.uid;
                document.getElementById("view-dashboard").classList.remove("hidden");
                app.setTab("config");
                app.loadData();
            }
        } else {
            // Si no hay usuario, mostrar Login
            document.getElementById("view-auth").classList.remove("hidden");
        }
        lucide.createIcons();
    },
};
app.init();

window.app = app;
