// ====================================
// DOM - Frontend Application Logic
// ====================================

// Global state
const state = {
    token: localStorage.getItem('dom_token'),
    user: null,
    currentView: 'dashboard'
};

// API client
const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add token to requests
api.interceptors.request.use(config => {
    if (state.token) {
        config.headers.Authorization = `Bearer ${state.token}`;
    }
    return config;
});

// Handle authentication errors
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            logout();
        }
        return Promise.reject(error);
    }
);

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    
    try {
        const { data } = await api.post('/auth/login', { email, password });
        
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('dom_token', data.token);
        
        showDashboard();
        
    } catch (error) {
        errorEl.textContent = error.response?.data?.error || 'Erro ao fazer login';
        errorEl.classList.remove('hidden');
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', logout);

function logout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('dom_token');
    showLogin();
}

// Show login screen
function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
}

// Show dashboard
async function showDashboard() {
    try {
        // Load user data
        if (!state.user) {
            const { data } = await api.get('/auth/me');
            state.user = data;
        }
        
        // Update UI with user info
        document.getElementById('userName').textContent = state.user.name;
        document.getElementById('userRole').textContent = getRoleName(state.user.role);
        
        // Show/hide menus based on role
        if (state.user.role === 'secretaria') {
            document.getElementById('secretariaMenu').classList.remove('hidden');
        }
        if (state.user.role === 'semad' || state.user.role === 'admin') {
            document.getElementById('semadMenu').classList.remove('hidden');
        }
        if (state.user.role === 'admin') {
            document.getElementById('adminMenu').classList.remove('hidden');
        }
        
        // Show dashboard screen
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        
        // Load dashboard view
        loadView('dashboard');
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        logout();
    }
}

// Get role display name
function getRoleName(role) {
    const roles = {
        admin: 'Administrador',
        semad: 'SEMAD',
        secretaria: 'Secretaria',
        publico: 'Público'
    };
    return roles[role] || role;
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.currentTarget.dataset.view;
        loadView(view);
    });
});

// Toggle sidebar on mobile
document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('hidden');
});

// Load view
async function loadView(view) {
    state.currentView = view;
    const content = document.getElementById('mainContent');
    
    // Highlight active menu
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('bg-blue-50', 'text-blue-600');
        if (link.dataset.view === view) {
            link.classList.add('bg-blue-50', 'text-blue-600');
        }
    });
    
    switch (view) {
        case 'dashboard':
            await loadDashboard(content);
            break;
        case 'myMatters':
            await loadMyMatters(content);
            break;
        case 'newMatter':
            await loadNewMatter(content);
            break;
        case 'pendingReview':
            await loadPendingReview(content);
            break;
        case 'approved':
            await loadApproved(content);
            break;
        case 'search':
            await loadSearch(content);
            break;
        default:
            content.innerHTML = '<p class="text-gray-600">View em desenvolvimento...</p>';
    }
}

// Load dashboard
async function loadDashboard(container) {
    try {
        container.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-chart-line mr-2"></i>Dashboard
            </h2>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm">Total de Matérias</p>
                            <p class="text-3xl font-bold text-gray-800 mt-2">-</p>
                        </div>
                        <i class="fas fa-file-alt text-blue-600 text-3xl"></i>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm">Pendentes</p>
                            <p class="text-3xl font-bold text-yellow-600 mt-2">-</p>
                        </div>
                        <i class="fas fa-clock text-yellow-600 text-3xl"></i>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm">Aprovadas</p>
                            <p class="text-3xl font-bold text-green-600 mt-2">-</p>
                        </div>
                        <i class="fas fa-check-circle text-green-600 text-3xl"></i>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm">Publicadas</p>
                            <p class="text-3xl font-bold text-blue-600 mt-2">-</p>
                        </div>
                        <i class="fas fa-newspaper text-blue-600 text-3xl"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Atividades Recentes</h3>
                <p class="text-gray-500">Carregando...</p>
            </div>
        `;
        
        if (state.user.role === 'semad' || state.user.role === 'admin') {
            const { data } = await api.get('/semad/dashboard');
            // Update dashboard with real data...
        }
        
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Erro ao carregar dashboard</p>';
    }
}

// Load my matters (Secretaria)
async function loadMyMatters(container) {
    try {
        const { data } = await api.get('/matters');
        
        container.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-file-alt mr-2"></i>Minhas Matérias
            </h2>
            
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="p-4 border-b border-gray-200 flex justify-between items-center">
                    <input 
                        type="text" 
                        id="filterMatters"
                        class="px-4 py-2 border border-gray-300 rounded-lg w-64"
                        placeholder="Buscar matéria..."
                    >
                    <button 
                        onclick="loadView('newMatter')"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                    >
                        <i class="fas fa-plus mr-2"></i>Nova Matéria
                    </button>
                </div>
                
                <div id="mattersList" class="divide-y divide-gray-200">
                    ${data.matters.map(matter => `
                        <div class="p-4 hover:bg-gray-50 cursor-pointer" onclick="viewMatter(${matter.id})">
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <h3 class="font-semibold text-gray-800">${matter.title}</h3>
                                    <p class="text-sm text-gray-500 mt-1">${matter.category_name || 'Sem categoria'}</p>
                                </div>
                                <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(matter.status)}">
                                    ${getStatusName(matter.status)}
                                </span>
                            </div>
                            <div class="mt-2 text-xs text-gray-500">
                                <i class="fas fa-calendar mr-1"></i>${formatDate(matter.created_at)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Erro ao carregar matérias</p>';
    }
}

// Load new matter form
function loadNewMatter(container) {
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-plus-circle mr-2"></i>Nova Matéria
        </h2>
        
        <form id="newMatterForm" class="bg-white rounded-lg shadow p-6 space-y-6">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Título *</label>
                <input 
                    type="text" 
                    id="matterTitle"
                    required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite o título da matéria"
                >
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                <input 
                    type="text" 
                    id="matterType"
                    required
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Decreto, Portaria, Edital"
                >
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Conteúdo *</label>
                <textarea 
                    id="matterContent"
                    required
                    rows="10"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite o conteúdo completo da matéria"
                ></textarea>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Resumo</label>
                <textarea 
                    id="matterSummary"
                    rows="3"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Resumo opcional da matéria"
                ></textarea>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Layout</label>
                    <select 
                        id="matterLayout"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="1">1 Coluna</option>
                        <option value="2" selected>2 Colunas</option>
                    </select>
                </div>
            </div>
            
            <div class="flex space-x-4">
                <button 
                    type="submit"
                    class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                >
                    <i class="fas fa-save mr-2"></i>Salvar Rascunho
                </button>
                
                <button 
                    type="button"
                    id="submitForReview"
                    class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
                >
                    <i class="fas fa-paper-plane mr-2"></i>Enviar para Análise
                </button>
            </div>
        </form>
    `;
    
    document.getElementById('newMatterForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveMatter(false);
    });
    
    document.getElementById('submitForReview').addEventListener('click', async () => {
        await saveMatter(true);
    });
}

// Save matter
async function saveMatter(submitForReview) {
    const title = document.getElementById('matterTitle').value;
    const content = document.getElementById('matterContent').value;
    const summary = document.getElementById('matterSummary').value;
    const matter_type = document.getElementById('matterType').value;
    const layout_columns = parseInt(document.getElementById('matterLayout').value);
    
    try {
        const { data } = await api.post('/matters', {
            title,
            content,
            summary,
            matter_type,
            layout_columns
        });
        
        if (submitForReview) {
            await api.post(`/matters/${data.matterId}/submit`);
            alert('Matéria enviada para análise com sucesso!');
        } else {
            alert('Matéria salva como rascunho!');
        }
        
        loadView('myMatters');
        
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao salvar matéria');
    }
}

// Load pending review (SEMAD)
async function loadPendingReview(container) {
    try {
        const { data } = await api.get('/semad/pending');
        
        container.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-tasks mr-2"></i>Matérias Pendentes de Análise
            </h2>
            
            <div class="bg-white rounded-lg shadow divide-y divide-gray-200">
                ${data.matters.map(matter => `
                    <div class="p-4 hover:bg-gray-50">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h3 class="font-semibold text-gray-800">${matter.title}</h3>
                                <p class="text-sm text-gray-500 mt-1">
                                    ${matter.secretaria_acronym} - ${matter.author_name}
                                </p>
                            </div>
                            <div class="flex space-x-2">
                                <button 
                                    onclick="reviewMatter(${matter.id})"
                                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                                >
                                    <i class="fas fa-eye mr-2"></i>Analisar
                                </button>
                            </div>
                        </div>
                        <div class="mt-2 text-xs text-gray-500">
                            Enviado em: ${formatDate(matter.submitted_at)}
                        </div>
                    </div>
                `).join('')}
                
                ${data.matters.length === 0 ? '<p class="p-4 text-gray-500 text-center">Nenhuma matéria pendente</p>' : ''}
            </div>
        `;
        
    } catch (error) {
        container.innerHTML = '<p class="text-red-600">Erro ao carregar matérias</p>';
    }
}

// Helper functions
function getStatusName(status) {
    const statuses = {
        draft: 'Rascunho',
        submitted: 'Enviado',
        under_review: 'Em Análise',
        approved: 'Aprovado',
        rejected: 'Rejeitado',
        published: 'Publicado',
        scheduled: 'Agendado',
        archived: 'Arquivado'
    };
    return statuses[status] || status;
}

function getStatusColor(status) {
    const colors = {
        draft: 'bg-gray-100 text-gray-800',
        submitted: 'bg-blue-100 text-blue-800',
        under_review: 'bg-yellow-100 text-yellow-800',
        approved: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        published: 'bg-purple-100 text-purple-800',
        scheduled: 'bg-indigo-100 text-indigo-800',
        archived: 'bg-gray-100 text-gray-600'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Initialize app
if (state.token) {
    showDashboard();
} else {
    showLogin();
}
