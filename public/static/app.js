// ====================================
// DOM - Frontend Application Logic - COMPLETO
// ====================================

// Global state
const state = {
    token: localStorage.getItem('dom_token'),
    user: null,
    currentView: 'dashboard',
    currentMatter: null,
    matterTypes: [],
    notifications: []
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

// ====================================
// AUTHENTICATION
// ====================================

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');
    
    // Hide messages
    errorEl?.classList.add('hidden');
    successEl?.classList.add('hidden');
    
    try {
        const { data } = await api.post('/auth/login', { email, password });
        
        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('dom_token', data.token);
        
        showDashboard();
        
    } catch (error) {
        if (errorEl) {
            errorEl.textContent = error.response?.data?.error || 'Erro ao fazer login';
            errorEl.classList.remove('hidden');
        }
    }
});

// Forgot password
document.getElementById('forgotPasswordLink')?.addEventListener('click', async () => {
    const email = prompt('Digite seu email para recuperar a senha:');
    
    if (!email) {
        return;
    }
    
    const errorEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');
    
    // Hide messages
    errorEl?.classList.add('hidden');
    successEl?.classList.add('hidden');
    
    try {
        const { data } = await api.post('/auth/forgot-password', { email });
        
        if (successEl) {
            successEl.textContent = data.message + '\n\n' + (data.info || '');
            successEl.classList.remove('hidden');
        }
        
        alert(data.message + '\n\n' + (data.info || 'Entre em contato com o administrador do sistema.'));
        
    } catch (error) {
        if (errorEl) {
            errorEl.textContent = error.response?.data?.error || 'Erro ao processar solicitação';
            errorEl.classList.remove('hidden');
        }
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', logout);

function logout() {
    state.token = null;
    state.user = null;
    state.matterTypes = [];
    state.notifications = [];
    localStorage.removeItem('dom_token');
    
    // Limpar menus para evitar bug de persistência
    document.getElementById('secretariaMenu').classList.add('hidden');
    document.getElementById('semadMenu').classList.add('hidden');
    document.getElementById('adminMenu').classList.add('hidden');
    
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
        
        // Limpar todos os menus primeiro (corrige bug de persistência)
        document.getElementById('secretariaMenu').classList.add('hidden');
        document.getElementById('semadMenu').classList.add('hidden');
        document.getElementById('semadAdminMenu').classList.add('hidden');
        document.getElementById('adminMenu').classList.add('hidden');
        
        // Update UI with user info
        document.getElementById('userName').textContent = state.user.name;
        document.getElementById('userRole').textContent = getRoleName(state.user.role);
        
        // Show/hide menus based on role
        if (state.user.role === 'secretaria') {
            document.getElementById('secretariaMenu').classList.remove('hidden');
        }
        if (state.user.role === 'semad' || state.user.role === 'admin') {
            document.getElementById('semadMenu').classList.remove('hidden');
            document.getElementById('semadAdminMenu').classList.remove('hidden');
        }
        if (state.user.role === 'admin') {
            document.getElementById('adminMenu').classList.remove('hidden');
        }
        
        // Load matter types
        await loadMatterTypes();
        
        // Load notifications
        await loadNotifications();
        
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

// Load matter types
async function loadMatterTypes() {
    try {
        const { data } = await api.get('/matter-types');
        state.matterTypes = data.matterTypes;
    } catch (error) {
        console.error('Error loading matter types:', error);
    }
}

// Load notifications
async function loadNotifications() {
    try {
        // TODO: implementar rota de notificações
        // const { data } = await api.get('/notifications');
        // state.notifications = data.notifications.filter(n => !n.read);
        
        // Mock para teste
        state.notifications = [];
        updateNotificationBadge();
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.getElementById('notificationBadge');
    if (state.notifications.length > 0) {
        badge.textContent = state.notifications.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// Notification button click
document.getElementById('notificationBtn')?.addEventListener('click', () => {
    if (state.notifications.length > 0) {
        alert('Você tem ' + state.notifications.length + ' notificação(ões) pendente(s).\n\nMódulo de notificações será implementado em breve.');
    } else {
        alert('Nenhuma notificação pendente.');
    }
});

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

// ====================================
// NAVIGATION
// ====================================

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
    
    // Show loading
    content.innerHTML = `
        <div class="text-center py-12">
            <i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
            <p class="mt-4 text-gray-600">Carregando...</p>
        </div>
    `;
    
    // Load view content
    try {
        switch (view) {
            case 'dashboard':
                await loadDashboard(content);
                break;
            case 'myMatters':
                await loadMyMatters(content);
                break;
            case 'newMatter':
                loadNewMatterForm(content);
                break;
            case 'pendingReview':
                await loadPendingReview(content);
                break;
            case 'approved':
                await loadApprovedMatters(content);
                break;
            case 'search':
                loadPublicSearch(content);
                break;
            case 'editions':
                await loadEditions(content);
                break;
            case 'users':
                loadUsersManagement(content);
                break;
            case 'holidays':
                loadHolidaysManagement(content);
                break;
            case 'settings':
                loadSystemSettings(content);
                break;
            default:
                content.innerHTML = '<p class="text-gray-600">View em desenvolvimento...</p>';
        }
    } catch (error) {
        console.error('Error loading view:', error);
        content.innerHTML = `<p class="text-red-600">Erro ao carregar página: ${error.message}</p>`;
    }
}

// ====================================
// DASHBOARD
// ====================================

async function loadDashboard(container) {
    const { data: matters } = await api.get('/matters');
    
    const statusCounts = {
        draft: 0,
        submitted: 0,
        approved: 0,
        published: 0
    };
    
    matters.matters.forEach(m => {
        if (statusCounts[m.status] !== undefined) {
            statusCounts[m.status]++;
        }
    });
    
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-chart-line mr-2"></i>Dashboard
        </h2>
        
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm">Total de Matérias</p>
                        <p class="text-3xl font-bold text-gray-800 mt-2">${matters.matters.length}</p>
                    </div>
                    <i class="fas fa-file-alt text-blue-600 text-3xl"></i>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm">Rascunhos</p>
                        <p class="text-3xl font-bold text-gray-600 mt-2">${statusCounts.draft}</p>
                    </div>
                    <i class="fas fa-edit text-gray-600 text-3xl"></i>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm">Em Análise</p>
                        <p class="text-3xl font-bold text-yellow-600 mt-2">${statusCounts.submitted}</p>
                    </div>
                    <i class="fas fa-clock text-yellow-600 text-3xl"></i>
                </div>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-500 text-sm">Aprovadas</p>
                        <p class="text-3xl font-bold text-green-600 mt-2">${statusCounts.approved}</p>
                    </div>
                    <i class="fas fa-check-circle text-green-600 text-3xl"></i>
                </div>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow p-6">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">
                <i class="fas fa-history mr-2"></i>Atividades Recentes
            </h3>
            <div class="space-y-3">
                ${matters.matters.slice(0, 5).map(m => `
                    <div class="flex items-center justify-between py-2 border-b border-gray-100">
                        <div>
                            <p class="font-medium text-gray-800">${m.title}</p>
                            <p class="text-sm text-gray-500">${m.secretaria_acronym} - ${formatDate(m.created_at)}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(m.status)}">
                            ${getStatusName(m.status)}
                        </span>
                    </div>
                `).join('')}
                
                ${matters.matters.length === 0 ? '<p class="text-gray-500 text-center py-4">Nenhuma atividade recente</p>' : ''}
            </div>
        </div>
    `;
}

// ====================================
// MY MATTERS (SECRETARIA)
// ====================================

async function loadMyMatters(container) {
    const { data } = await api.get('/matters');
    
    // Get unique matter types from state for filter
    const matterTypesOptions = state.matterTypes.map(mt => 
        `<option value="${mt.id}">${mt.name}</option>`
    ).join('');
    
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-blue-700">
                <i class="fas fa-file-alt mr-2"></i>Minhas Matérias
                <span class="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full ml-2">Solicitante</span>
            </h2>
            <button 
                onclick="loadView('newMatter')"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
                <i class="fas fa-plus mr-2"></i>Nova Matéria
            </button>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b border-gray-200 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input 
                        type="text" 
                        id="filterMattersText"
                        class="px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Buscar por título..."
                        onkeyup="filterMattersList()"
                    >
                    
                    <select 
                        id="filterMattersType"
                        class="px-4 py-2 border border-gray-300 rounded-lg"
                        onchange="filterMattersList()"
                    >
                        <option value="">Todos os tipos</option>
                        ${matterTypesOptions}
                    </select>
                    
                    <select 
                        id="filterMattersStatus"
                        class="px-4 py-2 border border-gray-300 rounded-lg"
                        onchange="filterMattersList()"
                    >
                        <option value="">Todos os status</option>
                        <option value="draft">Rascunho</option>
                        <option value="submitted">Enviado</option>
                        <option value="under_review">Em Análise</option>
                        <option value="approved">Aprovado</option>
                        <option value="rejected">Rejeitado</option>
                        <option value="published">Publicado</option>
                    </select>
                    
                    <input 
                        type="date" 
                        id="filterMattersDate"
                        class="px-4 py-2 border border-gray-300 rounded-lg"
                        onchange="filterMattersList()"
                    >
                </div>
                
                <div class="flex justify-end">
                    <button 
                        onclick="clearMattersFilters()"
                        class="text-sm text-gray-600 hover:text-gray-800"
                    >
                        <i class="fas fa-times mr-1"></i>Limpar filtros
                    </button>
                </div>
            </div>
            
            <div id="mattersList" class="divide-y divide-gray-200">
                ${data.matters.map(matter => {
                    const matterTypeName = state.matterTypes.find(mt => mt.id === matter.matter_type_id)?.name || 'Sem tipo';
                    const priorityBadge = {
                        'urgent': '<span class="text-red-600 text-xs font-bold ml-2">URGENTE</span>',
                        'high': '<span class="text-orange-600 text-xs font-bold ml-2">ALTA</span>',
                        'normal': '',
                        'low': '<span class="text-gray-500 text-xs ml-2">Baixa</span>'
                    };
                    
                    return `
                    <div class="p-4 hover:bg-gray-50 matter-item" 
                         data-title="${matter.title.toLowerCase()}"
                         data-type="${matter.matter_type_id || ''}"
                         data-status="${matter.status}"
                         data-date="${matter.created_at ? matter.created_at.split('T')[0] : ''}">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h3 class="font-semibold text-gray-800">
                                    ${matter.title}
                                    ${priorityBadge[matter.priority || 'normal']}
                                </h3>
                                <p class="text-sm text-gray-500 mt-1">${matterTypeName}</p>
                                <p class="text-xs text-gray-400 mt-2">
                                    <i class="fas fa-calendar mr-1"></i>${formatDate(matter.created_at)}
                                </p>
                            </div>
                            <div class="flex items-center space-x-2 ml-4">
                                <span class="px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(matter.status)}">
                                    ${getStatusName(matter.status)}
                                </span>
                                <button 
                                    onclick="viewMatterDetails(${matter.id})"
                                    class="text-blue-600 hover:text-blue-800 p-2"
                                    title="Ver detalhes"
                                >
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${matter.status === 'draft' ? `
                                    <button 
                                        onclick="editMatter(${matter.id})"
                                        class="text-green-600 hover:text-green-800 p-2"
                                        title="Editar"
                                    >
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button 
                                        onclick="deleteMatter(${matter.id})"
                                        class="text-red-600 hover:text-red-800 p-2"
                                        title="Excluir"
                                    >
                                        <i class="fas fa-trash"></i>
                                    </button>
                                ` : ''}
                                ${matter.status === 'submitted' || matter.status === 'under_review' ? `
                                    <button 
                                        onclick="cancelSubmission(${matter.id})"
                                        class="text-orange-600 hover:text-orange-800 p-2"
                                        title="Cancelar envio"
                                    >
                                        <i class="fas fa-undo"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    `;
                }).join('')}
                
                ${data.matters.length === 0 ? `
                    <div class="p-8 text-center text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-4"></i>
                        <p>Nenhuma matéria encontrada</p>
                        <button 
                            onclick="loadView('newMatter')"
                            class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
                        >
                            Criar primeira matéria
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Filter matters list
function filterMattersList() {
    const textFilter = document.getElementById('filterMattersText')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('filterMattersType')?.value || '';
    const statusFilter = document.getElementById('filterMattersStatus')?.value || '';
    const dateFilter = document.getElementById('filterMattersDate')?.value || '';
    
    const items = document.querySelectorAll('.matter-item');
    
    items.forEach(item => {
        const title = item.dataset.title;
        const type = item.dataset.type;
        const status = item.dataset.status;
        const date = item.dataset.date;
        
        const matchesText = !textFilter || title.includes(textFilter);
        const matchesType = !typeFilter || type === typeFilter;
        const matchesStatus = !statusFilter || status === statusFilter;
        const matchesDate = !dateFilter || date === dateFilter;
        
        if (matchesText && matchesType && matchesStatus && matchesDate) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Clear all filters
function clearMattersFilters() {
    const textInput = document.getElementById('filterMattersText');
    const typeSelect = document.getElementById('filterMattersType');
    const statusSelect = document.getElementById('filterMattersStatus');
    const dateInput = document.getElementById('filterMattersDate');
    
    if (textInput) textInput.value = '';
    if (typeSelect) typeSelect.value = '';
    if (statusSelect) statusSelect.value = '';
    if (dateInput) dateInput.value = '';
    
    filterMattersList();
}

// Filter SEMAD matters list
function filterSemadList() {
    const textFilter = document.getElementById('filterSemadText')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('filterSemadType')?.value || '';
    const dateFilter = document.getElementById('filterSemadDate')?.value || '';
    
    const items = document.querySelectorAll('.semad-matter-item');
    
    items.forEach(item => {
        const title = item.dataset.title;
        const type = item.dataset.type;
        const date = item.dataset.date;
        
        const matchesText = !textFilter || title.includes(textFilter);
        const matchesType = !typeFilter || type === typeFilter;
        const matchesDate = !dateFilter || date === dateFilter;
        
        if (matchesText && matchesType && matchesDate) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Clear SEMAD filters
function clearSemadFilters() {
    const textInput = document.getElementById('filterSemadText');
    const typeSelect = document.getElementById('filterSemadType');
    const dateInput = document.getElementById('filterSemadDate');
    
    if (textInput) textInput.value = '';
    if (typeSelect) typeSelect.value = '';
    if (dateInput) dateInput.value = '';
    
    filterSemadList();
}

// View matter details
async function viewMatterDetails(id) {
    const content = document.getElementById('mainContent');
    
    try {
        const { data } = await api.get(`/matters/${id}`);
        const matter = data.matter;
        
        content.innerHTML = `
            <div class="mb-6">
                <button 
                    onclick="loadView('myMatters')"
                    class="text-blue-600 hover:text-blue-800"
                >
                    <i class="fas fa-arrow-left mr-2"></i>Voltar
                </button>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">${matter.title}</h2>
                        <p class="text-gray-600 mt-2">${matter.matter_type || 'Sem tipo'}</p>
                    </div>
                    <span class="px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(matter.status)}">
                        ${getStatusName(matter.status)}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                        <p class="text-sm text-gray-500">Secretaria</p>
                        <p class="font-medium">${matter.secretaria_name || '-'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Autor</p>
                        <p class="font-medium">${matter.author_name || '-'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Tipo</p>
                        <p class="font-medium">${state.matterTypes.find(mt => mt.id === matter.matter_type_id)?.name || 'Sem tipo'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Prioridade</p>
                        <p class="font-medium">${getPriorityName(matter.priority || 'normal')}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Criado em</p>
                        <p class="font-medium">${formatDate(matter.created_at)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Versão</p>
                        <p class="font-medium">v${matter.version}</p>
                    </div>
                    ${matter.publication_date ? `
                        <div>
                            <p class="text-sm text-gray-500">Data de Publicação</p>
                            <p class="font-medium">${new Date(matter.publication_date).toLocaleDateString('pt-BR')}</p>
                        </div>
                    ` : ''}
                    ${matter.submitted_by ? `
                        <div>
                            <p class="text-sm text-gray-500">Enviado por</p>
                            <p class="font-medium">${matter.submitter_name || 'ID: ' + matter.submitted_by}</p>
                        </div>
                    ` : ''}
                    ${matter.server_timestamp ? `
                        <div>
                            <p class="text-sm text-gray-500">Datador (Server Timestamp)</p>
                            <p class="font-medium">${formatDate(matter.server_timestamp)}</p>
                        </div>
                    ` : ''}
                </div>
                
                ${matter.summary ? `
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Resumo</h3>
                        <div class="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">${matter.summary}</div>
                    </div>
                ` : ''}
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">Conteúdo</h3>
                    <div class="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">${matter.content}</div>
                </div>
                
                ${matter.observations ? `
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Observações Internas</h3>
                        <div class="bg-yellow-50 p-4 rounded-lg whitespace-pre-wrap border border-yellow-200">${matter.observations}</div>
                    </div>
                ` : ''}
                
                ${matter.signature_hash ? `
                    <div class="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 class="text-lg font-semibold text-green-800 mb-2">
                            <i class="fas fa-shield-alt mr-2"></i>Assinatura Eletrônica
                        </h3>
                        <p class="text-sm text-gray-600 mb-2">Assinado por: ${matter.signed_by}</p>
                        <p class="text-xs text-gray-500 mb-2">Data: ${formatDate(matter.signed_at)}</p>
                        <p class="text-xs font-mono bg-white p-2 rounded border border-green-200 break-all">
                            ${matter.signature_hash}
                        </p>
                    </div>
                ` : ''}
                
                ${matter.status === 'rejected' && matter.rejection_reason ? `
                    <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h3 class="text-lg font-semibold text-red-800 mb-2">
                            <i class="fas fa-times-circle mr-2"></i>Motivo da Rejeição
                        </h3>
                        <p class="text-gray-700">${matter.rejection_reason}</p>
                    </div>
                ` : ''}
                
                ${matter.canceled_at && matter.cancelation_reason ? `
                    <div class="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                        <h3 class="text-lg font-semibold text-orange-800 mb-2">
                            <i class="fas fa-ban mr-2"></i>Cancelamento
                        </h3>
                        <p class="text-sm text-gray-600 mb-2">Cancelado em: ${formatDate(matter.canceled_at)}</p>
                        ${matter.canceler_name ? `<p class="text-sm text-gray-600 mb-2">Por: ${matter.canceler_name}</p>` : ''}
                        <p class="text-gray-700">Motivo: ${matter.cancelation_reason}</p>
                    </div>
                ` : ''}
                
                <div class="flex space-x-4">
                    ${matter.status === 'draft' ? `
                        <button 
                            onclick="editMatter(${matter.id})"
                            class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
                        >
                            <i class="fas fa-edit mr-2"></i>Editar
                        </button>
                        <button 
                            onclick="submitMatterForReview(${matter.id})"
                            class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
                        >
                            <i class="fas fa-paper-plane mr-2"></i>Enviar para Análise
                        </button>
                        <button 
                            onclick="deleteMatter(${matter.id})"
                            class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                        >
                            <i class="fas fa-trash mr-2"></i>Excluir
                        </button>
                    ` : ''}
                    
                    ${matter.status === 'submitted' || matter.status === 'under_review' ? `
                        <button 
                            onclick="cancelSubmission(${matter.id})"
                            class="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg"
                        >
                            <i class="fas fa-undo mr-2"></i>Cancelar Envio
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        content.innerHTML = `<p class="text-red-600">Erro ao carregar detalhes: ${error.message}</p>`;
    }
}

// ====================================
// NEW/EDIT MATTER FORM
// ====================================

function loadNewMatterForm(container, matterId = null) {
    const matterTypesOptions = state.matterTypes.map(mt => 
        `<option value="${mt.id}">${mt.name}</option>`
    ).join('');
    
    const todayDate = new Date().toISOString().split('T')[0];
    
    container.innerHTML = `
        <div class="mb-6">
            <button 
                onclick="loadView('myMatters')"
                class="text-blue-600 hover:text-blue-800 flex items-center"
            >
                <i class="fas fa-arrow-left mr-2"></i>Voltar
            </button>
        </div>
        
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-plus-circle mr-2"></i>${matterId ? 'Editar' : 'Nova'} Matéria
        </h2>
        
        <form id="matterForm" class="bg-white rounded-lg shadow p-6 space-y-6">
            <input type="hidden" id="matterId" value="${matterId || ''}">
            
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
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Tipo *</label>
                    <select 
                        id="matterTypeId"
                        required
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">Selecione o tipo</option>
                        ${matterTypesOptions}
                    </select>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Prioridade *</label>
                    <select 
                        id="matterPriority"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="normal" selected>Normal</option>
                        <option value="high">Alta</option>
                        <option value="urgent">Urgente</option>
                        <option value="low">Baixa</option>
                    </select>
                </div>
                
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
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Data de Publicação</label>
                <input 
                    type="date" 
                    id="matterPublicationDate"
                    min="${todayDate}"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                <p class="text-xs text-gray-500 mt-1">Deixe em branco para publicação imediata</p>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Resumo</label>
                <textarea 
                    id="matterSummary"
                    rows="2"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Resumo opcional da matéria"
                ></textarea>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Conteúdo *</label>
                <textarea 
                    id="matterContent"
                    required
                    rows="12"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Digite o conteúdo completo da matéria"
                ></textarea>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Observações</label>
                <textarea 
                    id="matterObservations"
                    rows="3"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Observações internas (não serão publicadas)"
                ></textarea>
            </div>
            
            <div class="flex flex-wrap gap-3">
                <button 
                    type="button"
                    onclick="saveMatterDraft()"
                    class="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg transition"
                >
                    <i class="fas fa-save mr-2"></i>Salvar Rascunho
                </button>
                
                <button 
                    type="button"
                    onclick="saveMatterAndSubmit()"
                    class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition"
                >
                    <i class="fas fa-paper-plane mr-2"></i>Salvar e Enviar
                </button>
                
                <button 
                    type="button"
                    onclick="loadView('myMatters')"
                    class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg transition"
                >
                    <i class="fas fa-times mr-2"></i>Cancelar
                </button>
            </div>
        </form>
    `;
    
    // Load matter data if editing
    if (matterId) {
        loadMatterForEdit(matterId);
    }
}

async function loadMatterForEdit(id) {
    try {
        const { data } = await api.get(`/matters/${id}`);
        const matter = data.matter;
        
        document.getElementById('matterTitle').value = matter.title;
        document.getElementById('matterTypeId').value = matter.matter_type_id || '';
        document.getElementById('matterPriority').value = matter.priority || 'normal';
        document.getElementById('matterPublicationDate').value = matter.publication_date || '';
        document.getElementById('matterLayout').value = matter.layout_columns;
        document.getElementById('matterSummary').value = matter.summary || '';
        document.getElementById('matterContent').value = matter.content;
        document.getElementById('matterObservations').value = matter.observations || '';
    } catch (error) {
        alert('Erro ao carregar matéria: ' + error.message);
        loadView('myMatters');
    }
}

async function saveMatterDraft() {
    await saveMatter(false);
}

async function saveMatterAndSubmit() {
    await saveMatter(true);
}

async function saveMatter(submitForReview) {
    const id = document.getElementById('matterId').value;
    const title = document.getElementById('matterTitle').value;
    const content = document.getElementById('matterContent').value;
    const summary = document.getElementById('matterSummary').value;
    const matter_type_id = parseInt(document.getElementById('matterTypeId').value);
    const priority = document.getElementById('matterPriority').value;
    const publication_date = document.getElementById('matterPublicationDate').value || null;
    const observations = document.getElementById('matterObservations').value;
    const layout_columns = parseInt(document.getElementById('matterLayout').value);
    
    if (!title || !content || !matter_type_id) {
        alert('Preencha todos os campos obrigatórios!');
        return;
    }
    
    try {
        if (id) {
            // Update existing
            await api.put(`/matters/${id}`, {
                title,
                content,
                summary,
                matter_type_id,
                priority,
                publication_date,
                observations,
                layout_columns
            });
            
            if (submitForReview) {
                await api.post(`/matters/${id}/submit`);
                alert('Matéria atualizada e enviada para análise com sucesso!');
            } else {
                alert('Matéria atualizada com sucesso!');
            }
        } else {
            // Create new
            const { data } = await api.post('/matters', {
                title,
                content,
                summary,
                matter_type_id,
                priority,
                publication_date,
                observations,
                layout_columns
            });
            
            if (submitForReview) {
                await api.post(`/matters/${data.matterId}/submit`);
                alert('Matéria criada e enviada para análise com sucesso!');
            } else {
                alert('Matéria salva como rascunho!');
            }
        }
        
        loadView('myMatters');
        
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao salvar matéria');
    }
}

async function editMatter(id) {
    const content = document.getElementById('mainContent');
    loadNewMatterForm(content, id);
}

async function deleteMatter(id) {
    if (!confirm('Tem certeza que deseja excluir esta matéria?\n\nEsta ação não pode ser desfeita e será registrada no log de auditoria.')) {
        return;
    }
    
    try {
        await api.delete(`/matters/${id}`);
        alert('Matéria excluída com sucesso!');
        loadView('myMatters');
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao excluir matéria');
    }
}

async function submitMatterForReview(id) {
    if (!confirm('Deseja enviar esta matéria para análise da SEMAD?')) {
        return;
    }
    
    try {
        await api.post(`/matters/${id}/submit`);
        alert('Matéria enviada para análise com sucesso!');
        loadView('myMatters');
    } catch (error) {
        alert('Erro ao enviar matéria: ' + error.message);
    }
}

async function cancelSubmission(id) {
    const reason = prompt('Digite o motivo do cancelamento:');
    
    if (!reason || reason.trim() === '') {
        alert('O motivo do cancelamento é obrigatório!');
        return;
    }
    
    try {
        await api.post(`/matters/${id}/cancel`, {
            cancelation_reason: reason
        });
        
        alert('Envio cancelado com sucesso!');
        loadView('myMatters');
    } catch (error) {
        alert('Erro ao cancelar envio: ' + (error.response?.data?.error || error.message));
    }
}

// ====================================
// PENDING REVIEW (SEMAD)
// ====================================

async function loadPendingReview(container) {
    const { data } = await api.get('/semad/pending');
    
    const matterTypesOptions = state.matterTypes.map(mt => 
        `<option value="${mt.id}">${mt.name}</option>`
    ).join('');
    
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-green-700 mb-6">
            <i class="fas fa-tasks mr-2"></i>Matérias Pendentes de Análise
            <span class="text-sm bg-green-100 text-green-800 px-3 py-1 rounded-full ml-2">Aprovador</span>
        </h2>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b border-gray-200 bg-green-50">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input 
                        type="text" 
                        id="filterSemadText"
                        class="px-4 py-2 border border-gray-300 rounded-lg"
                        placeholder="Buscar por título..."
                        onkeyup="filterSemadList()"
                    >
                    <select 
                        id="filterSemadType"
                        class="px-4 py-2 border border-gray-300 rounded-lg"
                        onchange="filterSemadList()"
                    >
                        <option value="">Todos os tipos</option>
                        ${matterTypesOptions}
                    </select>
                    <input 
                        type="date" 
                        id="filterSemadDate"
                        class="px-4 py-2 border border-gray-300 rounded-lg"
                        onchange="filterSemadList()"
                    >
                </div>
                <div class="flex justify-end mt-2">
                    <button 
                        onclick="clearSemadFilters()"
                        class="text-sm text-gray-600 hover:text-gray-800"
                    >
                        <i class="fas fa-times mr-1"></i>Limpar filtros
                    </button>
                </div>
            </div>
            
            <div class="divide-y divide-gray-200">
            ${data.matters.map(matter => {
                const matterTypeName = state.matterTypes.find(mt => mt.id === matter.matter_type_id)?.name || 'Sem tipo';
                return `
                <div class="p-4 hover:bg-gray-50 semad-matter-item"
                     data-title="${matter.title.toLowerCase()}"
                     data-type="${matter.matter_type_id || ''}"
                     data-date="${matter.submitted_at ? matter.submitted_at.split('T')[0] : ''}">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h3 class="font-semibold text-gray-800">${matter.title}</h3>
                            <p class="text-sm text-gray-500 mt-1">
                                <span class="font-medium text-green-600">${matterTypeName}</span> | ${matter.secretaria_acronym} - ${matter.author_name}
                            </p>
                            <p class="text-xs text-gray-400 mt-2">
                                Enviado em: ${formatDate(matter.submitted_at)}
                            </p>
                        </div>
                        <button 
                            onclick="reviewMatter(${matter.id})"
                            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm ml-4"
                        >
                            <i class="fas fa-eye mr-2"></i>Analisar
                        </button>
                    </div>
                </div>
            `).join('')}
            
            ${data.matters.length === 0 ? `
                <div class="p-8 text-center text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>Nenhuma matéria pendente de análise</p>
                </div>
            ` : ''}
        </div>
    `;
}

async function reviewMatter(id) {
    const content = document.getElementById('mainContent');
    
    try {
        const { data } = await api.get(`/matters/${id}`);
        const matter = data.matter;
        
        content.innerHTML = `
            <div class="mb-6">
                <button 
                    onclick="loadView('pendingReview')"
                    class="text-blue-600 hover:text-blue-800"
                >
                    <i class="fas fa-arrow-left mr-2"></i>Voltar
                </button>
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex justify-between items-start mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-800">${matter.title}</h2>
                        <p class="text-gray-600 mt-2">${matter.matter_type || 'Sem tipo'}</p>
                    </div>
                    <span class="px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(matter.status)}">
                        ${getStatusName(matter.status)}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                        <p class="text-sm text-gray-500">Secretaria</p>
                        <p class="font-medium">${matter.secretaria_name}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Autor</p>
                        <p class="font-medium">${matter.author_name}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Enviado em</p>
                        <p class="font-medium">${formatDate(matter.submitted_at)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Versão</p>
                        <p class="font-medium">v${matter.version}</p>
                    </div>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">Conteúdo</h3>
                    <div class="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap max-h-96 overflow-y-auto">${matter.content}</div>
                </div>
                
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Notas de Revisão</label>
                    <textarea 
                        id="reviewNotes"
                        rows="4"
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Adicione suas observações sobre a matéria..."
                    ></textarea>
                </div>
                
                <div class="flex space-x-4">
                    <button 
                        onclick="approveMatter(${matter.id})"
                        class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg"
                    >
                        <i class="fas fa-check mr-2"></i>Aprovar
                    </button>
                    <button 
                        onclick="rejectMatter(${matter.id})"
                        class="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
                    >
                        <i class="fas fa-times mr-2"></i>Rejeitar
                    </button>
                </div>
            </div>
        `;
        
    } catch (error) {
        content.innerHTML = `<p class="text-red-600">Erro ao carregar matéria: ${error.message}</p>`;
    }
}

async function approveMatter(id) {
    const notes = document.getElementById('reviewNotes').value;
    
    if (!confirm('Deseja aprovar esta matéria?')) {
        return;
    }
    
    try {
        const { data } = await api.post(`/semad/${id}/approve`, {
            review_notes: notes
        });
        
        alert(`Matéria aprovada com sucesso!\n\nAssinatura eletrônica: ${data.signature.substring(0, 16)}...`);
        loadView('pendingReview');
    } catch (error) {
        alert('Erro ao aprovar matéria: ' + (error.response?.data?.error || error.message));
    }
}

async function rejectMatter(id) {
    const reason = prompt('Digite o motivo da rejeição:');
    
    if (!reason || reason.trim() === '') {
        alert('O motivo da rejeição é obrigatório!');
        return;
    }
    
    try {
        await api.post(`/semad/${id}/reject`, {
            rejection_reason: reason
        });
        
        alert('Matéria rejeitada com sucesso!');
        loadView('pendingReview');
    } catch (error) {
        alert('Erro ao rejeitar matéria: ' + (error.response?.data?.error || error.message));
    }
}

// ====================================
// APPROVED MATTERS
// ====================================

async function loadApprovedMatters(container) {
    const { data } = await api.get('/matters?status=approved');
    
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-check-circle mr-2"></i>Matérias Aprovadas
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
                            <p class="text-xs text-gray-400 mt-2">
                                Aprovado em: ${formatDate(matter.approved_at)}
                            </p>
                        </div>
                        <button 
                            onclick="viewMatterDetails(${matter.id})"
                            class="text-blue-600 hover:text-blue-800 p-2 ml-4"
                            title="Ver detalhes"
                        >
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            `).join('')}
            
            ${data.matters.length === 0 ? `
                <div class="p-8 text-center text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>Nenhuma matéria aprovada</p>
                </div>
            ` : ''}
        </div>
    `;
}

// ====================================
// PUBLIC SEARCH
// ====================================

async function loadPublicSearch(container) {
    const matterTypesOptions = state.matterTypes.map(mt => 
        `<option value="${mt.id}">${mt.name}</option>`
    ).join('');
    
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-purple-700 mb-6">
            <i class="fas fa-search mr-2"></i>Pesquisa de Publicações
            <span class="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-full ml-2">Público</span>
        </h2>
        
        <div class="bg-white rounded-lg shadow p-6 mb-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input 
                    type="text" 
                    id="searchPublicText"
                    class="px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Buscar por título ou conteúdo..."
                >
                <select 
                    id="searchPublicType"
                    class="px-4 py-2 border border-gray-300 rounded-lg"
                >
                    <option value="">Todos os tipos</option>
                    ${matterTypesOptions}
                </select>
                <input 
                    type="date" 
                    id="searchPublicDateFrom"
                    class="px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Data inicial"
                >
                <input 
                    type="date" 
                    id="searchPublicDateTo"
                    class="px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Data final"
                >
            </div>
            <div class="flex gap-2">
                <button 
                    onclick="performPublicSearch()"
                    class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex-1"
                >
                    <i class="fas fa-search mr-2"></i>Buscar
                </button>
                <button 
                    onclick="clearPublicSearch()"
                    class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg"
                >
                    <i class="fas fa-times mr-2"></i>Limpar
                </button>
            </div>
        </div>
        
        <div id="publicSearchResults"></div>
    `;
}

async function performPublicSearch() {
    const text = document.getElementById('searchPublicText').value;
    const type = document.getElementById('searchPublicType').value;
    const dateFrom = document.getElementById('searchPublicDateFrom').value;
    const dateTo = document.getElementById('searchPublicDateTo').value;
    
    try {
        const params = new URLSearchParams();
        if (text) params.append('search', text);
        if (type) params.append('matter_type_id', type);
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);
        params.append('status', 'published');
        
        const { data } = await api.get(`/matters?${params.toString()}`);
        
        const resultsDiv = document.getElementById('publicSearchResults');
        
        if (data.matters.length === 0) {
            resultsDiv.innerHTML = `
                <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <i class="fas fa-inbox text-4xl mb-4"></i>
                    <p>Nenhuma publicação encontrada</p>
                </div>
            `;
            return;
        }
        
        resultsDiv.innerHTML = `
            <div class="bg-white rounded-lg shadow">
                <div class="p-4 border-b bg-gray-50">
                    <p class="text-sm text-gray-600">
                        <i class="fas fa-check-circle mr-2 text-green-600"></i>
                        Encontradas ${data.matters.length} publicação(ões)
                    </p>
                </div>
                <div class="divide-y divide-gray-200">
                    ${data.matters.map(matter => {
                        const matterTypeName = state.matterTypes.find(mt => mt.id === matter.matter_type_id)?.name || 'Sem tipo';
                        return `
                        <div class="p-4 hover:bg-gray-50">
                            <div class="flex justify-between items-start">
                                <div class="flex-1">
                                    <h3 class="font-semibold text-gray-800">${matter.title}</h3>
                                    <p class="text-sm text-purple-600 mt-1">${matterTypeName}</p>
                                    <p class="text-sm text-gray-500 mt-1">
                                        ${matter.secretaria_acronym || matter.secretaria_name}
                                    </p>
                                    <p class="text-xs text-gray-400 mt-2">
                                        Publicado em: ${formatDate(matter.published_at)}
                                    </p>
                                </div>
                                <button 
                                    onclick="viewPublicMatter(${matter.id})"
                                    class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm ml-4"
                                >
                                    <i class="fas fa-eye mr-2"></i>Ver
                                </button>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        alert('Erro ao buscar publicações: ' + (error.response?.data?.error || error.message));
    }
}

function clearPublicSearch() {
    document.getElementById('searchPublicText').value = '';
    document.getElementById('searchPublicType').value = '';
    document.getElementById('searchPublicDateFrom').value = '';
    document.getElementById('searchPublicDateTo').value = '';
    document.getElementById('publicSearchResults').innerHTML = '';
}

async function viewPublicMatter(id) {
    try {
        const { data } = await api.get(`/matters/${id}`);
        const matter = data.matter;
        const matterTypeName = state.matterTypes.find(mt => mt.id === matter.matter_type_id)?.name || 'Sem tipo';
        
        document.getElementById('publicSearchResults').innerHTML = `
            <div class="bg-white rounded-lg shadow p-6">
                <button 
                    onclick="loadView('publicSearch')"
                    class="text-purple-600 hover:text-purple-800 mb-4"
                >
                    <i class="fas fa-arrow-left mr-2"></i>Voltar aos resultados
                </button>
                
                <div class="mb-4">
                    <h2 class="text-2xl font-bold text-gray-800">${matter.title}</h2>
                    <p class="text-purple-600 mt-2">${matterTypeName}</p>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-6 pb-6 border-b">
                    <div>
                        <p class="text-sm text-gray-500">Secretaria</p>
                        <p class="font-medium">${matter.secretaria_name}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Publicado em</p>
                        <p class="font-medium">${formatDate(matter.published_at)}</p>
                    </div>
                </div>
                
                ${matter.summary ? `
                    <div class="mb-6">
                        <h3 class="text-lg font-semibold text-gray-800 mb-3">Resumo</h3>
                        <div class="bg-gray-50 p-4 rounded-lg">${matter.summary}</div>
                    </div>
                ` : ''}
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">Conteúdo</h3>
                    <div class="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">${matter.content}</div>
                </div>
                
                ${matter.signature_hash ? `
                    <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 class="text-lg font-semibold text-green-800 mb-2">
                            <i class="fas fa-shield-alt mr-2"></i>Assinatura Eletrônica
                        </h3>
                        <p class="text-sm text-gray-600 mb-2">Assinado por: ${matter.signed_by_name || 'Sistema'}</p>
                        <p class="text-xs text-gray-500 mb-2">Data: ${formatDate(matter.signed_at)}</p>
                        <p class="text-xs font-mono bg-white p-2 rounded border border-green-200 break-all">
                            ${matter.signature_hash}
                        </p>
                    </div>
                ` : ''}
            </div>
        `;
    } catch (error) {
        alert('Erro ao carregar matéria: ' + error.message);
    }
}

// ====================================
// ADMIN: USERS MANAGEMENT
// ====================================

function loadUsersManagement(container) {
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-users mr-2"></i>Gerenciamento de Usuários
        </h2>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-gray-600">
                <i class="fas fa-info-circle mr-2"></i>
                Módulo de gerenciamento de usuários em desenvolvimento
            </p>
        </div>
    `;
}

// ====================================
// ADMIN: HOLIDAYS MANAGEMENT
// ====================================

function loadHolidaysManagement(container) {
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-calendar-alt mr-2"></i>Gerenciamento de Feriados
        </h2>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-gray-600">
                <i class="fas fa-info-circle mr-2"></i>
                Módulo de gerenciamento de feriados em desenvolvimento
            </p>
        </div>
    `;
}

// ====================================
// ADMIN: SYSTEM SETTINGS
// ====================================

function loadSystemSettings(container) {
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-cog mr-2"></i>Configurações do Sistema
        </h2>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-gray-600">
                <i class="fas fa-info-circle mr-2"></i>
                Módulo de configurações do sistema em desenvolvimento
            </p>
        </div>
    `;
}

// ====================================
// HELPER FUNCTIONS
// ====================================

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

function getPriorityName(priority) {
    const priorities = {
        urgent: '🔴 Urgente',
        high: '🟠 Alta',
        normal: '🟢 Normal',
        low: '🔵 Baixa'
    };
    return priorities[priority] || priority;
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

// ====================================
// EDITIONS MANAGEMENT
// ====================================

async function loadEditions(container) {
    try {
        const { data } = await api.get('/editions');
        
        container.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-book mr-2"></i>Edições do Diário Oficial
                    </h2>
                    ${state.user.role === 'admin' || state.user.role === 'semad' ? `
                        <button onclick="showNewEditionModal()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">
                            <i class="fas fa-plus mr-2"></i>Nova Edição
                        </button>
                    ` : ''}
                </div>
                
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <div class="p-4 border-b border-gray-200 bg-gray-50">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <select id="filterEditionStatus" onchange="filterEditions()" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                                <option value="">Todos os status</option>
                                <option value="draft">Rascunho</option>
                                <option value="published">Publicado</option>
                                <option value="archived">Arquivado</option>
                            </select>
                            
                            <input type="number" id="filterEditionYear" placeholder="Filtrar por ano" onchange="filterEditions()" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            
                            <button onclick="clearEditionFilters()" class="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg transition">
                                <i class="fas fa-times mr-2"></i>Limpar filtros
                            </button>
                        </div>
                    </div>
                    
                    <div id="editionsTableContainer">
                        ${renderEditionsTable(data.editions)}
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading editions:', error);
        container.innerHTML = `<p class="text-red-600">Erro ao carregar edições: ${error.message}</p>`;
    }
}

function renderEditionsTable(editions) {
    if (!editions || editions.length === 0) {
        return `
            <div class="p-8 text-center text-gray-500">
                <i class="fas fa-book text-4xl mb-4"></i>
                <p>Nenhuma edição encontrada</p>
            </div>
        `;
    }
    
    return `
        <table class="w-full">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Edição</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ano</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matérias</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
                ${editions.map(edition => `
                    <tr class="hover:bg-gray-50 edition-row" data-status="${edition.status}" data-year="${edition.year}">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="font-semibold text-gray-900">${edition.edition_number}</span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-gray-700">
                            ${new Date(edition.edition_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-gray-700">
                            ${edition.year}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                ${edition.matter_count || 0} matéria(s)
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="${getEditionStatusColor(edition.status)} px-3 py-1 rounded-full text-sm font-medium">
                                ${getEditionStatusName(edition.status)}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button onclick="viewEdition(${edition.id})" class="text-blue-600 hover:text-blue-900" title="Ver detalhes">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${edition.status === 'draft' && (state.user.role === 'admin' || state.user.role === 'semad') ? `
                                <button onclick="editEdition(${edition.id})" class="text-green-600 hover:text-green-900" title="Editar">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="publishEdition(${edition.id})" class="text-purple-600 hover:text-purple-900" title="Publicar">
                                    <i class="fas fa-rocket"></i>
                                </button>
                                <button onclick="deleteEdition(${edition.id})" class="text-red-600 hover:text-red-900" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                            ${edition.status === 'published' && edition.pdf_url ? `
                                <a href="${edition.pdf_url}" target="_blank" class="text-indigo-600 hover:text-indigo-900" title="Download PDF">
                                    <i class="fas fa-file-pdf"></i>
                                </a>
                            ` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getEditionStatusName(status) {
    const statuses = {
        draft: 'Rascunho',
        published: 'Publicado',
        archived: 'Arquivado'
    };
    return statuses[status] || status;
}

function getEditionStatusColor(status) {
    const colors = {
        draft: 'bg-gray-100 text-gray-800',
        published: 'bg-green-100 text-green-800',
        archived: 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

function filterEditions() {
    const statusFilter = document.getElementById('filterEditionStatus').value;
    const yearFilter = document.getElementById('filterEditionYear').value;
    
    const rows = document.querySelectorAll('.edition-row');
    rows.forEach(row => {
        const matchesStatus = !statusFilter || row.dataset.status === statusFilter;
        const matchesYear = !yearFilter || row.dataset.year === yearFilter;
        
        row.style.display = (matchesStatus && matchesYear) ? '' : 'none';
    });
}

function clearEditionFilters() {
    document.getElementById('filterEditionStatus').value = '';
    document.getElementById('filterEditionYear').value = '';
    filterEditions();
}

async function showNewEditionModal() {
    const editionNumber = prompt('Número da edição (ex: 001/2025):');
    if (!editionNumber) return;
    
    const editionDate = prompt('Data da edição (YYYY-MM-DD):');
    if (!editionDate) return;
    
    const year = new Date(editionDate).getFullYear();
    
    try {
        await api.post('/editions', { edition_number: editionNumber, edition_date: editionDate, year });
        alert('Edição criada com sucesso!');
        loadView('editions');
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao criar edição');
    }
}

async function viewEdition(id) {
    try {
        const { data } = await api.get(`/editions/${id}`);
        
        const container = document.getElementById('mainContent');
        container.innerHTML = `
            <div class="mb-6">
                <button onclick="loadView('editions')" class="text-blue-600 hover:text-blue-800 mb-4">
                    <i class="fas fa-arrow-left mr-2"></i>Voltar para Edições
                </button>
                
                <div class="bg-white rounded-lg shadow-lg p-6">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h2 class="text-3xl font-bold text-gray-800 mb-2">
                                Edição ${data.edition_number}
                            </h2>
                            <p class="text-gray-600">Data: ${new Date(data.edition_date).toLocaleDateString('pt-BR')} • Ano: ${data.year}</p>
                            <span class="${getEditionStatusColor(data.status)} px-3 py-1 rounded-full text-sm font-medium mt-2 inline-block">
                                ${getEditionStatusName(data.status)}
                            </span>
                        </div>
                        
                        ${data.status === 'draft' && (state.user.role === 'admin' || state.user.role === 'semad') ? `
                            <div class="space-x-2">
                                <button onclick="addMatterToEdition(${data.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-plus mr-2"></i>Adicionar Matéria
                                </button>
                                <button onclick="publishEdition(${data.id})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-rocket mr-2"></i>Publicar Edição
                                </button>
                            </div>
                        ` : ''}
                        
                        ${data.status === 'published' && data.pdf_url ? `
                            <a href="${data.pdf_url}" target="_blank" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg inline-block">
                                <i class="fas fa-file-pdf mr-2"></i>Download PDF
                            </a>
                        ` : ''}
                    </div>
                    
                    <div class="border-t pt-6">
                        <h3 class="text-xl font-bold text-gray-800 mb-4">
                            Matérias da Edição (${data.matters.length})
                        </h3>
                        
                        ${data.matters.length === 0 ? `
                            <div class="text-center py-8 text-gray-500">
                                <i class="fas fa-inbox text-4xl mb-4"></i>
                                <p>Nenhuma matéria adicionada ainda</p>
                            </div>
                        ` : `
                            <div class="space-y-4">
                                ${data.matters.map(matter => `
                                    <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                        <div class="flex justify-between items-start">
                                            <div class="flex-1">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                                                        Ordem: ${matter.display_order}
                                                    </span>
                                                    <span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                                                        ${matter.secretaria_acronym}
                                                    </span>
                                                </div>
                                                <h4 class="font-semibold text-gray-900 mb-1">${matter.title}</h4>
                                                ${matter.summary ? `<p class="text-sm text-gray-600 mb-2">${matter.summary}</p>` : ''}
                                                <p class="text-xs text-gray-500">Autor: ${matter.author_name}</p>
                                            </div>
                                            
                                            ${data.status === 'draft' && (state.user.role === 'admin' || state.user.role === 'semad') ? `
                                                <button onclick="removeMatterFromEdition(${data.id}, ${matter.id})" class="text-red-600 hover:text-red-900 ml-4">
                                                    <i class="fas fa-times"></i>
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>
                    
                    ${data.status === 'published' ? `
                        <div class="border-t mt-6 pt-6">
                            <h3 class="text-xl font-bold text-gray-800 mb-4">Informações de Publicação</h3>
                            <div class="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p class="text-gray-600">Publicado por:</p>
                                    <p class="font-semibold">${data.published_by_name || '-'}</p>
                                </div>
                                <div>
                                    <p class="text-gray-600">Data de Publicação:</p>
                                    <p class="font-semibold">${formatDate(data.published_at)}</p>
                                </div>
                                <div>
                                    <p class="text-gray-600">Total de páginas:</p>
                                    <p class="font-semibold">${data.total_pages || '-'}</p>
                                </div>
                                <div>
                                    <p class="text-gray-600">Hash de validação:</p>
                                    <p class="font-mono text-xs">${data.pdf_hash ? data.pdf_hash.substring(0, 16) + '...' : '-'}</p>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao carregar edição');
    }
}

async function addMatterToEdition(editionId) {
    try {
        // Buscar matérias aprovadas disponíveis
        const { data } = await api.get('/matters?status=approved');
        
        if (data.matters.length === 0) {
            alert('Não há matérias aprovadas disponíveis para adicionar à edição.');
            return;
        }
        
        // Criar modal simples para seleção
        const matterOptions = data.matters.map(m => 
            `<option value="${m.id}">${m.title} (${m.secretaria_acronym})</option>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="addMatterModal">
                <div class="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Adicionar Matéria à Edição</h3>
                    
                    <select id="matterSelect" class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4" size="10">
                        ${matterOptions}
                    </select>
                    
                    <div class="flex justify-end space-x-2">
                        <button onclick="closeAddMatterModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                            Cancelar
                        </button>
                        <button onclick="confirmAddMatter(${editionId})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            Adicionar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao carregar matérias');
    }
}

function closeAddMatterModal() {
    document.getElementById('addMatterModal')?.remove();
}

async function confirmAddMatter(editionId) {
    const matterId = document.getElementById('matterSelect').value;
    
    if (!matterId) {
        alert('Selecione uma matéria');
        return;
    }
    
    try {
        await api.post(`/editions/${editionId}/add-matter`, { matter_id: parseInt(matterId) });
        alert('Matéria adicionada com sucesso!');
        closeAddMatterModal();
        viewEdition(editionId);
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao adicionar matéria');
    }
}

async function removeMatterFromEdition(editionId, matterId) {
    if (!confirm('Tem certeza que deseja remover esta matéria da edição?')) {
        return;
    }
    
    try {
        await api.delete(`/editions/${editionId}/remove-matter/${matterId}`);
        alert('Matéria removida com sucesso!');
        viewEdition(editionId);
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao remover matéria');
    }
}

async function publishEdition(id) {
    if (!confirm('Tem certeza que deseja PUBLICAR esta edição?\n\nApós a publicação, não será possível adicionar ou remover matérias.\n\nEsta ação irá:\n• Gerar o PDF da edição\n• Publicar todas as matérias\n• Disponibilizar no portal público')) {
        return;
    }
    
    try {
        const { data } = await api.post(`/editions/${id}/publish`);
        alert(`Edição publicada com sucesso!\n\nPDF gerado: ${data.total_pages} página(s)\nHash: ${data.pdf_hash.substring(0, 16)}...`);
        loadView('editions');
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao publicar edição');
    }
}

async function deleteEdition(id) {
    if (!confirm('Tem certeza que deseja EXCLUIR esta edição?\n\nAPENAS edições em rascunho podem ser excluídas.\n\nEsta ação não pode ser desfeita!')) {
        return;
    }
    
    try {
        await api.delete(`/editions/${id}`);
        alert('Edição excluída com sucesso!');
        loadView('editions');
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao excluir edição');
    }
}

// ====================================
// INITIALIZE APP
// ====================================

if (state.token) {
    showDashboard();
} else {
    showLogin();
}
