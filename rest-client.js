const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const SafeStorage = {
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) { }
    },
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return null;
        }
    },
    removeItem(key) {
        try {
            localStorage.removeItem(key);
        } catch (e) { }
    },
};

class APIClient {
    constructor() {
        this.tokenKey = "latam5s_auth_token";
    }

    setToken(token) {
        SafeStorage.setItem(this.tokenKey, token);
    }

    getToken() {
        return SafeStorage.getItem(this.tokenKey);
    }

    clearToken() {
        SafeStorage.removeItem(this.tokenKey);
    }

    getTokenPayload() {
        const token = this.getToken();
        if (!token) return null;
        try {
            const base64Url = token.split(".")[1];
            const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split("")
                    .map(function (c) {
                        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join(""),
            );
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }

    isAuthenticated() {
        const payload = this.getTokenPayload();
        if (!payload) return false;
        if (!payload.exp) return true;
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    }

    needsRenewal(thresholdMinutes = 5) {
        const payload = this.getTokenPayload();
        if (!payload) return true;
        if (!payload.exp) return false;
        const now = Math.floor(Date.now() / 1000);
        return payload.exp - now < thresholdMinutes * 60;
    }

    async request(path, options = {}) {
        const url = `${API_BASE_URL}${path}`;
        const headers = {
            "Content-Type": "application/json",
            ...options.headers,
        };

        const token = this.getToken();
        if (token && !options.noAuth) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(30000),
                ...options,
                headers,
            });

            if (!response.ok) {
                const error = await response
                    .json()
                    .catch(() => ({ detail: "Unknown error" }));
                throw { status: response.status, ...error };
            }

            return response.json();
        } catch (error) {
            if (error.name === "TimeoutError") {
                throw { detail: "Request timed out after 30 seconds" };
            }
            throw error;
        }
    }

    // --- Auth ---
    async login(phone, password) {
        const data = await this.request("/legacy/auth/login", {
            method: "POST",
            body: JSON.stringify({ phone, password }),
            noAuth: true,
        });
        if (data.accessToken) {
            this.setToken(data.accessToken);
        }
        return data;
    }

    async getGuestToken(merchantId) {
        const path = `/legacy/auth/guest/${merchantId}`;
        const data = await this.request(path, {
            method: "POST",
            noAuth: true,
        });
        return data.accessToken;
    }

    // --- Merchants & Config ---
    async getMerchantConfig() {
        return this.request("/legacy/config");
    }

    async saveMerchantConfig(configData, lastUpdated = new Date().toISOString()) {
        return this.request("/legacy/config", {
            method: configData.isNewConfig ? "POST" : "PUT",
            body: JSON.stringify({
                dataJson: configData,
                lastUpdated: lastUpdated,
            }),
        });
    }

    async getMerchantStatus() {
        return this.request("/legacy/merchant");
    }

    async updatePassword(newPassword) {
        return this.request("/legacy/merchant/password", {
            method: "PATCH",
            body: JSON.stringify({ newPassword }),
        });
    }

    async updateUserPlan(plan) {
        return this.request("/legacy/merchant/userPlan", {
            method: "PATCH",
            body: JSON.stringify({ plan }),
        });
    }

    async startTrial() {
        return this.request("/legacy/merchant/trial", {
            method: "POST",
        });
    }

    // --- Orders ---
    async getOrders() {
        return this.request("/legacy/orders");
    }

    async getOrder(orderId) {
        return this.request(`/legacy/orders/${orderId}`);
    }

    async createOrder(orderData, useAnonymous = false) {
        const options = {
            method: "POST",
            body: JSON.stringify({
                dataJson: orderData,
            }),
        };

        if (useAnonymous) {
            // In anonymous mode, we assume the token is already set or we fetch a new one.
            // If orderData contains merchantId or if we have it in state, we could use it.
            return this.request("/legacy/orders", { ...options, noAuth: false });
        }

        return this.request("/legacy/orders", options);
    }

    async updateOrdersStatus(orderIds, newStatus) {
        return this.request("/legacy/orders/status", {
            method: "PATCH",
            body: JSON.stringify({ orderIds, newStatus }),
        });
    }

    async deleteOrders(orderIds) {
        return this.request("/legacy/orders/delete", {
            method: "PATCH",
            body: JSON.stringify({ orderIds }),
        });
    }

    // --- Admin ---
    async getAllMerchants() {
        return this.request("/legacy/merchant/all");
    }

    async createMerchant(merchantData) {
        return this.request("/legacy/merchant", {
            method: "POST",
            body: JSON.stringify(merchantData),
        });
    }

    async adminUpdatePassword(uid, newPassword) {
        return this.request(`/legacy/merchant/${uid}/password`, {
            method: "PATCH",
            body: JSON.stringify({ newPassword }),
        });
    }

    async adminUpdateUserPlan(uid, plan) {
        return this.request(`/legacy/merchant/${uid}/plan`, {
            method: "PATCH",
            body: JSON.stringify({ plan }),
        });
    }
}

export const api = new APIClient();
export default api;
