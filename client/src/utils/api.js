const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiClient {
    constructor() {
        this.baseURL = API_BASE_URL;
    }

    getAuthHeader() {
        const token = localStorage.getItem('token');
        return token ? { Authorization: `Bearer ${token}` } : {};
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...this.getAuthHeader(),
                ...options.headers,
            },
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async login(credentials) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials),
        });
    }

    // Transactions
    async getTransactions(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/transactions?${params}`);
    }

    async createTransaction(transaction) {
        return this.request('/transactions', {
            method: 'POST',
            body: JSON.stringify(transaction),
        });
    }

    async updateTransaction(id, updates) {
        return this.request(`/transactions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteTransaction(id) {
        return this.request(`/transactions/${id}`, {
            method: 'DELETE',
        });
    }

    async getTransactionStats(filters = {}) {
        const params = new URLSearchParams(filters);
        return this.request(`/transactions/stats?${params}`);
    }

    // Categories
    async getCategories() {
        return this.request('/categories');
    }

    async createCategory(category) {
        return this.request('/categories', {
            method: 'POST',
            body: JSON.stringify(category),
        });
    }

    async updateCategory(id, updates) {
        return this.request(`/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteCategory(id) {
        return this.request(`/categories/${id}`, {
            method: 'DELETE',
        });
    }

    // Budgets
    async getBudgets() {
        return this.request('/budgets');
    }

    async saveBudget(budget) {
        return this.request('/budgets', {
            method: 'POST',
            body: JSON.stringify(budget),
        });
    }

    async deleteBudget(id) {
        return this.request(`/budgets/${id}`, {
            method: 'DELETE',
        });
    }

    // Recurring Transactions
    async getRecurringTransactions() {
        return this.request('/recurring');
    }

    async createRecurringTransaction(recurring) {
        return this.request('/recurring', {
            method: 'POST',
            body: JSON.stringify(recurring),
        });
    }

    async updateRecurringTransaction(id, updates) {
        return this.request(`/recurring/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteRecurringTransaction(id) {
        return this.request(`/recurring/${id}`, {
            method: 'DELETE',
        });
    }

    async processRecurringTransactions() {
        return this.request('/recurring/process', {
            method: 'POST',
        });
    }

    // Reports
    async getMonthlyReport(year, month) {
        return this.request(`/reports/monthly?year=${year}&month=${month}`);
    }

    async getYearlyReport(year) {
        return this.request(`/reports/yearly?year=${year}`);
    }

    async exportTransactions(filters = {}) {
        const params = new URLSearchParams(filters);
        const url = `${this.baseURL}/reports/export?${params}`;
        const token = localStorage.getItem('token');

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
}

export default new ApiClient();
