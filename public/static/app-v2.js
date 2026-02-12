// ====================================
// DOM - Frontend Application Logic - COMPLETO
// VERSÃO CORRIGIDA - Menu Secretaria funcionando
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
    
    // 🔍 DIAGNÓSTICO: Log do que Axios VAI enviar
    if (config.method === 'put' && config.url?.includes('/users/')) {
        console.log('🌐🌐🌐 AXIOS INTERCEPTOR - PUT /users/');
        console.log('📦 CONFIG.DATA (o que AXIOS vai enviar):', config.data);
        console.log('📦 TIPO:', typeof config.data);
        console.log('📦 JSON:', JSON.stringify(config.data));
        alert('🌐 AXIOS INTERCEPTOR: ' + JSON.stringify(config.data));
    }
    
    return config;
});

// Handle authentication errors
api.interceptors.response.use(
    response => response,
    error => {
        // Fazer logout APENAS em 401 do /auth/me, NÃO no /auth/login
        if (error.response?.status === 401 && error.config.url.includes('/auth/me')) {
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
    document.getElementById('secretariaMenu')?.classList.add('hidden');
    document.getElementById('semadMenu')?.classList.add('hidden');
    document.getElementById('adminMenu')?.classList.add('hidden');
    
    showLogin();
}

// Show login screen
function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('dashboardScreen').classList.add('hidden');
}

// Show dashboard - FUNÇÃO CORRIGIDA
async function showDashboard() {
    try {
        // Load user data
        if (!state.user) {
            const { data } = await api.get('/auth/me');
            state.user = data;
        }
        
        console.log('🟢 showDashboard chamado');
        console.log('👤 Usuário:', state.user);
        console.log('🎭 Role do usuário:', state.user.role);
        
        // Limpar todos os menus primeiro (corrige bug de persistência)
        const secretariaMenu = document.getElementById('secretariaMenu');
        const semadMenu = document.getElementById('semadMenu');
        const semadAdminMenu = document.getElementById('semadAdminMenu');
        const adminMenu = document.getElementById('adminMenu');
        
        console.log('🔍 Elementos encontrados:');
        console.log('- secretariaMenu:', secretariaMenu ? '✅ Existe' : '❌ Não existe');
        console.log('- semadMenu:', semadMenu ? '✅ Existe' : '❌ Não existe');
        console.log('- semadAdminMenu:', semadAdminMenu ? '✅ Existe' : '❌ Não existe');
        console.log('- adminMenu:', adminMenu ? '✅ Existe' : '❌ Não existe');
        
        // Adicionar hidden a todos
        [secretariaMenu, semadMenu, semadAdminMenu, adminMenu].forEach(menu => {
            if (menu) menu.classList.add('hidden');
        });
        
        // Update UI with user info
        document.getElementById('userName').textContent = state.user.name;
        document.getElementById('userRole').textContent = getRoleName(state.user.role);
        
        console.log('🎯 Role detectado para menu:', state.user.role);
        
        // Show/hide menus based on role - CORRIGIDO
        if (state.user.role === 'secretaria') {
            console.log('🔄 Mostrando menu Secretaria');
            if (secretariaMenu) {
                secretariaMenu.classList.remove('hidden');
                console.log('✅ Menu Secretaria REMOVIDO hidden');
            }
        }
        
        if (state.user.role === 'semad' || state.user.role === 'admin') {
            console.log('🔄 Mostrando menu SEMAD');
            if (semadMenu) semadMenu.classList.remove('hidden');
            if (semadAdminMenu) semadAdminMenu.classList.remove('hidden');
        }
        
        if (state.user.role === 'admin') {
            console.log('🔄 Mostrando menu Admin');
            if (adminMenu) adminMenu.classList.remove('hidden');
        }
        
        console.log('📊 Estado final dos menus:');
        console.log('- secretariaMenu tem hidden?', secretariaMenu?.classList.contains('hidden'));
        console.log('- semadMenu tem hidden?', semadMenu?.classList.contains('hidden'));
        console.log('- adminMenu tem hidden?', adminMenu?.classList.contains('hidden'));
        
        // Load matter types
        await loadMatterTypes();
        
        // Load notifications
        await loadNotifications();
        
        // Show dashboard screen
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboardScreen').classList.remove('hidden');
        
        // Load dashboard view
        loadView('dashboard');
        
        // 🚨 PATCH: Forçar verificação após 500ms para garantir
        setTimeout(forceMenuVisibilityCheck, 500);
        
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
        publicador: 'Publicador'
    };
    return roles[role] || role;
}

// ====================================
// NAVIGATION - FUNÇÃO CORRIGIDA
// ====================================

// Atualizar event listeners para navegação
function setupNavigationListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        // Remover listeners antigos para evitar duplicação
        link.removeEventListener('click', handleNavLinkClick);
        // Adicionar novo listener
        link.addEventListener('click', handleNavLinkClick);
    });
}

function handleNavLinkClick(e) {
    e.preventDefault();
    const view = e.currentTarget.dataset.view;
    loadView(view);
}

// Toggle sidebar on mobile
document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('hidden');
});

// Load view - FUNÇÃO ATUALIZADA
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
                await loadUsersManagement(content);
                break;
            case 'holidays':
                await loadHolidaysManagement(content);
                break;
            case 'secretarias':
                await loadSecretariasManagement(content);
                break;
            case 'settings':
                loadSystemSettings(content);
                break;
            case 'verification':
                await loadVerificationInterface(content);
                break;
            default:
                content.innerHTML = '<p class="text-gray-600">View em desenvolvimento...</p>';
        }
    } catch (error) {
        console.error('Error loading view:', error);
        content.innerHTML = `<p class="text-red-600">Erro ao carregar página: ${error.message}</p>`;
    }
    
    // 🚨 PATCH: Verificar visibilidade do menu após carregar view
    setTimeout(forceMenuVisibilityCheck, 100);
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
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-800">
                    <i class="fas fa-history mr-2"></i>Atividades Recentes
                </h3>
                ${matters.matters.length > 10 ? `
                    <button onclick="loadView('myMatters')" class="text-sm text-blue-600 hover:text-blue-800">
                        Ver todas (${matters.matters.length}) →
                    </button>
                ` : ''}
            </div>
            <div class="space-y-3">
                ${matters.matters.slice(0, 10).map(m => `
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
            <div class="flex space-x-2">
                <button 
                    onclick="exportMattersCSV()"
                    class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
                    title="Exportar para CSV"
                >
                    <i class="fas fa-file-csv mr-2"></i>CSV
                </button>
                <button 
                    onclick="exportMattersXLS()"
                    class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition"
                    title="Exportar para Excel"
                >
                    <i class="fas fa-file-excel mr-2"></i>XLS
                </button>
                <button 
                    onclick="loadView('newMatter')"
                    class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                >
                    <i class="fas fa-plus mr-2"></i>Nova Matéria
                </button>
            </div>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b border-gray-200 space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <input 
                        type="text" 
                        id="filterMattersText"
                        class="px-4 py-3 border border-gray-300 rounded-lg"
                        placeholder="Buscar por título..."
                        onkeyup="filterMattersList()"
                    >
                    
                    <select 
                        id="filterMattersSecretaria"
                        class="px-4 py-3 border border-gray-300 rounded-lg"
                        onchange="filterMattersList()"
                    >
                        <option value="">Todas as secretarias</option>
                    </select>
                    
                    <select 
                        id="filterMattersType"
                        class="px-4 py-3 border border-gray-300 rounded-lg"
                        onchange="filterMattersList()"
                    >
                        <option value="">Todos os tipos</option>
                        ${matterTypesOptions}
                    </select>
                    
                    <select 
                        id="filterMattersStatus"
                        class="px-4 py-3 border border-gray-300 rounded-lg"
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
                        class="px-4 py-3 border border-gray-300 rounded-lg"
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
                         data-secretaria="${matter.secretaria_id || ''}"
                         data-type="${matter.matter_type_id || ''}"
                         data-status="${matter.status}"
                         data-date="${matter.created_at ? matter.created_at.split('T')[0] : ''}">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h3 class="font-semibold text-gray-800">
                                    ${matter.title}
                                    ${priorityBadge[matter.priority || 'normal']}
                                </h3>
                                <div class="flex items-center gap-3 mt-2">
                                    <span class="text-sm text-blue-600 font-medium">
                                        <i class="fas fa-building mr-1"></i>${matter.secretaria_name || 'Sem secretaria'}
                                    </span>
                                    <span class="text-sm text-gray-500">
                                        <i class="fas fa-tag mr-1"></i>${matterTypeName}
                                    </span>
                                    <span class="text-xs ${matter.layout_columns === 2 ? 'text-purple-600' : 'text-gray-500'}">
                                        <i class="fas fa-columns mr-1"></i>${matter.layout_columns === 2 ? '2 Colunas' : '1 Coluna'}
                                    </span>
                                    ${matter.has_attachments ? '<span class="text-xs text-green-600"><i class="fas fa-paperclip mr-1"></i>Com anexo</span>' : ''}
                                </div>
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
    
    // Load secretarias for filter
    loadSecretariasFilter();
}

// Filter matters list
function filterMattersList() {
    const textFilter = document.getElementById('filterMattersText')?.value.toLowerCase() || '';
    const secretariaFilter = document.getElementById('filterMattersSecretaria')?.value || '';
    const typeFilter = document.getElementById('filterMattersType')?.value || '';
    const statusFilter = document.getElementById('filterMattersStatus')?.value || '';
    const dateFilter = document.getElementById('filterMattersDate')?.value || '';
    
    const items = document.querySelectorAll('.matter-item');
    
    items.forEach(item => {
        const title = item.dataset.title;
        const secretaria = item.dataset.secretaria;
        const type = item.dataset.type;
        const status = item.dataset.status;
        const date = item.dataset.date;
        
        const matchesText = !textFilter || title.includes(textFilter);
        const matchesSecretaria = !secretariaFilter || secretaria === secretariaFilter;
        const matchesType = !typeFilter || type === typeFilter;
        const matchesStatus = !statusFilter || status === statusFilter;
        const matchesDate = !dateFilter || date === dateFilter;
        
        if (matchesText && matchesSecretaria && matchesType && matchesStatus && matchesDate) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// Clear all filters
function clearMattersFilters() {
    const textInput = document.getElementById('filterMattersText');
    const secretariaSelect = document.getElementById('filterMattersSecretaria');
    const typeSelect = document.getElementById('filterMattersType');
    const statusSelect = document.getElementById('filterMattersStatus');
    const dateInput = document.getElementById('filterMattersDate');
    
    if (textInput) textInput.value = '';
    if (secretariaSelect) secretariaSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    if (statusSelect) statusSelect.value = '';
    if (dateInput) dateInput.value = '';
    
    filterMattersList();
}

// Load secretarias for filter dropdown
async function loadSecretariasFilter() {
    try {
        const { data } = await api.get('/secretarias');
        const select = document.getElementById('filterMattersSecretaria');
        if (select && data.secretarias) {
            data.secretarias.forEach(sec => {
                const option = document.createElement('option');
                option.value = sec.id;
                option.textContent = `${sec.acronym} - ${sec.name}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading secretarias for filter:', error);
    }
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


// ====================================
// VISUALIZAÇÃO DIRETA DE ARQUIVOS - COM DEBUG
// ====================================

/**
 * Visualiza um arquivo diretamente na mesma aba (modal)
 * @param {number} attachmentId - ID do anexo
 * @param {string} filename - Nome do arquivo
 */
async function viewAttachment(attachmentId, filename) {
    console.log('\n========== 👁️ VIEW ATTACHMENT ==========');
    console.log(`👁️ Visualizando anexo ID: ${attachmentId}`);
    console.log(`📄 Nome do arquivo: ${filename}`);
    
    try {
        // 1. VERIFICAR TOKEN
        const token = localStorage.getItem('dom_token');
        console.log(`🔑 Token no localStorage: ${token ? 'Presente' : 'AUSENTE'}`);
        
        if (!token) {
            console.error('❌ Token não encontrado no localStorage');
            alert('Sessão expirada. Faça login novamente.');
            logout();
            return;
        }
        
        console.log(`🔑 Token (primeiros 20 chars): ${token.substring(0, 20)}...`);
        console.log(`🔑 Tamanho do token: ${token.length} caracteres`);
        
        // 2. VERIFICAR TOKEN NO STATE
        console.log(`🔑 Token no state: ${state.token ? 'Presente' : 'AUSENTE'}`);
        
        // 3. VERIFICAR USUÁRIO
        console.log(`👤 Usuário atual:`, state.user);
        
        const url = `/api/matters/attachments/${attachmentId}/download?t=${Date.now()}`;
        console.log(`🌐 URL da requisição: ${url}`);
        
        // 4. TESTAR PRIMEIRO COM FETCH SIMPLES
        console.log('📤 Enviando requisição fetch com headers:');
        console.log('   - Authorization: Bearer [TOKEN]');
        console.log('   - Cache-Control: no-cache');
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Cache-Control': 'no-cache, no-store',
                'Pragma': 'no-cache'
            }
        });
        
        console.log(`📥 Status da resposta: ${response.status} ${response.statusText}`);
        console.log('📋 Headers da resposta:');
        response.headers.forEach((value, key) => {
            console.log(`   - ${key}: ${value}`);
        });
        
        if (!response.ok) {
            // Tentar ler o corpo do erro
            let errorMessage = `Erro ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                console.error('❌ Corpo do erro:', errorData);
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                // Não é JSON, ignorar
            }
            throw new Error(errorMessage);
        }
        
        // 5. VERIFICAR TIPO DO ARQUIVO
        const contentType = response.headers.get('content-type');
        console.log(`📄 Content-Type recebido: ${contentType}`);
        
        const ext = filename.split('.').pop().toLowerCase();
        console.log(`📁 Extensão do arquivo: ${ext}`);
        
        const isViewable = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'html', 'htm'].includes(ext);
        console.log(`👁️ Pode visualizar? ${isViewable ? 'SIM' : 'NÃO'}`);
        
        if (!isViewable) {
            if (confirm(`Este tipo de arquivo (${ext.toUpperCase()}) não pode ser visualizado diretamente no navegador.\n\nDeseja baixar o arquivo?`)) {
                downloadAttachment(attachmentId, filename);
            }
            return;
        }
        
        // 6. OBTER BLOB
        const blob = await response.blob();
        console.log(`📦 Blob recebido:`);
        console.log(`   - Tamanho: ${(blob.size / 1024).toFixed(2)} KB`);
        console.log(`   - Tipo: ${blob.type}`);
        console.log(`   - Size: ${blob.size} bytes`);
        
        if (blob.size === 0) {
            throw new Error('Arquivo vazio recebido do servidor');
        }
        
        // 7. CRIAR MODAL
        const modalId = `viewer-modal-${Date.now()}`;
        console.log(`🪟 Criando modal: ${modalId}`);
        
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'fixed inset-0 bg-black bg-opacity-90 z-[99999] flex items-center justify-center p-4';
        modal.style.backdropFilter = 'blur(5px)';
        
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden animate-fade-in">
                <div class="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <div class="flex items-center space-x-3">
                        <i class="fas fa-file-${getFileIcon(filename)} text-2xl"></i>
                        <div>
                            <h3 class="font-bold text-lg truncate max-w-2xl">${filename}</h3>
                            <p class="text-xs text-blue-100" id="file-info-${attachmentId}">
                                ${ext.toUpperCase()} • ${formatFileSize(blob.size)} • Carregado com sucesso
                            </p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="downloadAttachment(${attachmentId}, '${filename}')" 
                            class="p-2 hover:bg-blue-500 rounded-lg transition-colors" 
                            title="Download">
                            <i class="fas fa-download text-xl"></i>
                        </button>
                        <button onclick="closeAttachmentViewer('${modalId}')" 
                            class="p-2 hover:bg-red-500 rounded-lg transition-colors" 
                            title="Fechar">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                
                <div id="viewer-content-${attachmentId}" class="flex-1 bg-gray-100 p-4 overflow-auto relative">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="text-center">
                            <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                            <p class="mt-4 text-gray-600 font-medium">Carregando visualização...</p>
                        </div>
                    </div>
                </div>
                
                <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
                    <span>
                        <i class="fas fa-lock mr-1 text-green-600"></i>
                        Token enviado com sucesso
                    </span>
                    <span>
                        <button onclick="closeAttachmentViewer('${modalId}')" class="text-blue-600 hover:text-blue-800 font-medium">
                            Pressione ESC para fechar
                        </button>
                    </span>
                </div>
            </div>
            
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.2s ease-out;
                }
            </style>
        `;
        
        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';
        
        // 8. FECHAR COM ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeAttachmentViewer(modalId);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        // 9. CRIAR URL DO BLOB
        const blobUrl = URL.createObjectURL(blob);
        console.log(`🔗 Blob URL criada: ${blobUrl.substring(0, 30)}...`);
        
        // 10. RENDERIZAR CONTEÚDO
        const viewerContainer = document.getElementById(`viewer-content-${attachmentId}`);
        
        if (blob.type.includes('pdf') || ext === 'pdf') {
            console.log('📄 Renderizando PDF...');
            viewerContainer.innerHTML = `
                <iframe 
                    src="${blobUrl}#toolbar=0&navpanes=0&scrollbar=1"
                    class="w-full h-full border-0 rounded-lg shadow-lg"
                    style="min-height: 600px;"
                    title="${filename}"
                ></iframe>
                <div class="absolute bottom-8 right-8 flex space-x-2">
                    <a href="${blobUrl}" download="${filename}" 
                       class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
                        <i class="fas fa-download mr-2"></i> Download PDF
                    </a>
                </div>
            `;
        } else if (blob.type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
            console.log('🖼️ Renderizando imagem...');
            viewerContainer.innerHTML = `
                <div class="h-full flex items-center justify-center bg-gray-900">
                    <img 
                        src="${blobUrl}" 
                        alt="${filename}"
                        class="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                        style="max-height: calc(100vh - 200px);"
                        onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\'text-center text-red-600\'><i class=\'fas fa-exclamation-triangle text-4xl mb-4\'></i><p>Erro ao carregar imagem</p></div>';"
                    >
                </div>
                <div class="absolute bottom-8 right-8 flex space-x-2">
                    <a href="${blobUrl}" download="${filename}" 
                       class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
                        <i class="fas fa-download mr-2"></i> Download Imagem
                    </a>
                </div>
            `;
        } else if (blob.type.includes('text') || ['txt', 'csv', 'json', 'xml', 'html', 'htm', 'js', 'css'].includes(ext)) {
            console.log('📝 Renderizando texto...');
            try {
                const text = await blob.text();
                viewerContainer.innerHTML = `
                    <div class="h-full bg-white rounded-lg shadow-lg overflow-auto">
                        <pre class="p-6 font-mono text-sm whitespace-pre-wrap break-words">${escapeHtml(text)}</pre>
                    </div>
                    <div class="absolute bottom-8 right-8 flex space-x-2">
                        <a href="${blobUrl}" download="${filename}" 
                           class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
                            <i class="fas fa-download mr-2"></i> Download
                        </a>
                    </div>
                `;
            } catch (e) {
                console.error('Erro ao ler texto:', e);
                throw new Error('Erro ao ler arquivo de texto');
            }
        } else {
            console.log('📁 Tipo não visualizável, mostrando opção de download');
            viewerContainer.innerHTML = `
                <div class="h-full flex items-center justify-center">
                    <div class="text-center bg-white p-12 rounded-lg shadow-lg">
                        <i class="fas fa-file-${getFileIcon(filename)} text-6xl text-gray-400 mb-4"></i>
                        <h4 class="text-xl font-bold text-gray-800 mb-2">${filename}</h4>
                        <p class="text-gray-600 mb-2">Tipo: ${blob.type || 'Desconhecido'}</p>
                        <p class="text-gray-600 mb-6">Tamanho: ${formatFileSize(blob.size)}</p>
                        <p class="text-gray-500 mb-6">Este tipo de arquivo não pode ser visualizado diretamente.</p>
                        <a href="${blobUrl}" download="${filename}" 
                           class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg inline-flex items-center">
                            <i class="fas fa-download mr-2"></i> Baixar Arquivo
                        </a>
                    </div>
                </div>
            `;
        }
        
        console.log('✅ Visualização carregada com sucesso!');
        console.log('========== FIM VIEW ATTACHMENT ==========\n');
        
    } catch (error) {
        console.error('\n❌ ERRO NA VISUALIZAÇÃO:');
        console.error('   - Mensagem:', error.message);
        console.error('   - Stack:', error.stack);
        console.error('========== FIM COM ERRO ==========\n');
        
        // Remover modal se existir
        const existingModal = document.querySelector('[id^="viewer-modal-"]');
        if (existingModal) {
            existingModal.remove();
            document.body.style.overflow = 'auto';
        }
        
        // Mostrar erro e oferecer download
        if (confirm(`❌ Erro ao visualizar arquivo: ${error.message}\n\nDeseja tentar baixar o arquivo?`)) {
            downloadAttachment(attachmentId, filename);
        }
    }
}

/**
 * Fecha o visualizador de anexos
 * @param {string} modalId - ID do modal
 */
function closeAttachmentViewer(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.remove();
        document.body.style.overflow = 'auto';
        
        // Limpar URLs de blob
        const iframes = modal.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            if (iframe.src && iframe.src.startsWith('blob:')) {
                URL.revokeObjectURL(iframe.src);
            }
        });
        
        const images = modal.querySelectorAll('img');
        images.forEach(img => {
            if (img.src && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src);
            }
        });
        
        const links = modal.querySelectorAll('a[href^="blob:"]');
        links.forEach(link => {
            URL.revokeObjectURL(link.href);
        });
    }
}

/**
 * Função auxiliar para escapar HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// View matter details
// View matter details - FUNÇÃO CORRIGIDA
async function viewMatterDetails(id) {
    const content = document.getElementById('mainContent');
    
    try {
        const { data } = await api.get(`/matters/${id}`);
        
        // 🔍 DEBUG: Verificar estrutura dos dados recebidos
        console.log('📦 Dados recebidos da API:', data);
        
        // A API retorna o objeto da matéria diretamente, não dentro de { matter }
        const matter = data;
        
        if (!matter || !matter.id) {
            console.error('❌ Dados inválidos recebidos:', data);
            throw new Error('Dados da matéria inválidos');
        }
        
        console.log('✅ Matéria carregada:', matter.title);
        
        // Restante do código permanece o mesmo...
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
                        <p class="text-gray-600 mt-2">${matter.matter_type_name || matter.matter_type || 'Sem tipo'}</p>
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
                        <p class="font-medium">v${matter.version || 1}</p>
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
                
                <div id="attachmentsContainer" class="mb-6"></div>
                
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
                    
                    ${(matter.status === 'submitted' || matter.status === 'under_review') ? `
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
        
        // Carregar anexos
        loadMatterAttachments(id);
        
    } catch (err) {
        console.error('❌ Erro completo ao carregar detalhes:', err);
        content.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 class="text-lg font-bold text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>Erro ao carregar matéria
                </h3>
                <p class="text-red-700">${err.message}</p>
                <button onclick="loadView('myMatters')" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-arrow-left mr-2"></i>Voltar para lista
                </button>
            </div>
        `;
    }
}

// Carregar anexos de uma matéria
// Carregar anexos de uma matéria - FUNÇÃO CORRIGIDA
// Carregar anexos de uma matéria - COM BOTÃO DE VISUALIZAÇÃO
async function loadMatterAttachments(matterId) {
    const container = document.getElementById('attachmentsContainer');
    if (!container) return;
    
    try {
        const { data } = await api.get(`/matters/${matterId}/attachments`);
        console.log('📎 Dados de anexos:', data);
        
        // Verificar se os anexos estão diretamente no data ou em data.attachments
        const attachments = Array.isArray(data) ? data : (data.attachments || []);
        
        if (attachments.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = `
            <div class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 class="text-lg font-semibold text-blue-800 mb-3">
                    <i class="fas fa-paperclip mr-2"></i>Anexos (${attachments.length})
                </h3>
                <div class="space-y-2">
                    ${attachments.map(att => {
                        const ext = (att.original_name || att.filename).split('.').pop().toLowerCase();
                        const isViewable = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'html', 'htm'].includes(ext);
                        
                        return `
                        <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                            <div class="flex items-center space-x-3">
                                <i class="fas fa-file-${getFileIcon(att.original_name || att.filename)} text-blue-600 text-xl"></i>
                                <div>
                                    <p class="text-sm font-medium text-gray-800">${att.original_name || att.filename}</p>
                                    <p class="text-xs text-gray-500">
                                        ${formatFileSize(att.file_size)} • 
                                        Enviado por ${att.uploaded_by_name || 'ID: ' + att.uploaded_by} • 
                                        ${formatDate(att.uploaded_at || att.created_at)}
                                        ${isViewable ? ' • <span class="text-green-600"><i class="fas fa-eye"></i> Visualizável</span>' : ''}
                                    </p>
                                </div>
                            </div>
                            <div class="flex space-x-2">
                                ${isViewable ? `
                                <button 
                                    onclick="viewAttachment(${att.id}, '${att.original_name || att.filename}')"
                                    class="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition"
                                    title="Visualizar arquivo"
                                >
                                    <i class="fas fa-eye text-lg"></i>
                                </button>
                                ` : ''}
                                <button 
                                    onclick="downloadAttachment(${att.id}, '${att.original_name || att.filename}')"
                                    class="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 transition"
                                    title="Download"
                                >
                                    <i class="fas fa-download text-lg"></i>
                                </button>
                            </div>
                        </div>
                    `}).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar anexos:', error);
        container.innerHTML = '';
    }
}

// Função auxiliar para download de anexo
async function downloadAttachment(attachmentId, filename) {
    try {
        // CORREÇÃO: Adicionar /matters no caminho da URL
        const response = await fetch(`/api/matters/attachments/${attachmentId}/download`, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            console.error('❌ Erro na resposta do servidor:', response.status, response.statusText);
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || `Erro HTTP ${response.status}`);
        }
        
        // Tentar obter o blob
        const blob = await response.blob();
        
        if (!blob || blob.size === 0) {
            throw new Error('Arquivo vazio ou inválido');
        }
        
        console.log('📥 Download iniciado:', {
            filename: filename,
            size: (blob.size / 1024).toFixed(2) + ' KB',
            type: blob.type
        });
        
        // Criar URL para o blob
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Limpar URL após uso
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            console.log('✅ URL liberada da memória');
        }, 100);
        
    } catch (error) {
        console.error('❌ Erro ao baixar anexo:', error);
        alert('Erro ao baixar anexo: ' + error.message);
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
                <div 
                    id="matterContentEditor"
                    class="bg-white border border-gray-300 rounded-lg"
                    style="min-height: 300px;"
                ></div>
                <textarea 
                    id="matterContent"
                    class="hidden"
                    required
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
            
            <div class="border-t border-gray-200 pt-4">
                <div class="flex items-center space-x-2">
                    <input 
                        type="checkbox" 
                        id="hasAttachments"
                        onchange="toggleAttachmentsSection()"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    >
                    <label for="hasAttachments" class="text-sm font-medium text-gray-700">
                        Esta matéria possui anexos
                    </label>
                </div>
                
                <div id="attachmentsSection" style="display: none;" class="mt-4 p-4 bg-gray-50 rounded-lg">
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        <i class="fas fa-paperclip mr-1"></i>Upload de Anexos
                    </label>
                    
                    <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <input 
                            type="file" 
                            id="matterAttachments"
                            multiple
                            accept=".pdf,application/pdf"
                            class="hidden"
                            onchange="handleAttachmentSelection()"
                        >
                        <button 
                            type="button"
                            onclick="document.getElementById('matterAttachments').click()"
                            class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg transition"
                        >
                            <i class="fas fa-upload mr-2"></i>Escolher Arquivos
                        </button>
                        <p class="text-xs text-gray-500 mt-2">
                            Formatos aceito: PDF e application/pdf 
                        </p>
                    </div>
                    
                    <div id="selectedFilesList" class="mt-4 space-y-2"></div>
                </div>
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
    
    // Initialize Quill WYSIWYG editor
    const quillEditor = new Quill('#matterContentEditor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'indent': '-1'}, { 'indent': '+1' }],
                [{ 'align': [] }],
                ['link', 'blockquote', 'code-block'],
                ['clean']
            ]
        },
        placeholder: 'Digite o conteúdo completo da matéria...'
    });
    
    // Sync Quill content to hidden textarea
    quillEditor.on('text-change', function() {
        const html = quillEditor.root.innerHTML;
        document.getElementById('matterContent').value = html;
    });
    
    // Store editor instance globally for access in other functions
    window.currentQuillEditor = quillEditor;
    
    // Load matter data if editing
    if (matterId) {
        loadMatterForEdit(matterId);
    }
}

async function loadMatterForEdit(id) {
  try {
    console.log('📝 Carregando matéria para edição ID:', id);
    
    const token = localStorage.getItem('dom_token');
    console.log('🔍 Token presente?', token ? 'Sim' : 'Não');
    
    // Carregar matéria
    const response = await fetch(`/api/matters/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔍 Status da resposta:', response.status);
    
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}`);
    }
    
    const matter = await response.json();
    console.log('✅ Matéria carregada:', matter.title);
    
    // Preencher os campos do formulário
    const titleInput = document.getElementById('matterTitle');
    const typeSelect = document.getElementById('matterTypeId');
    const prioritySelect = document.getElementById('matterPriority');
    const publicationDateInput = document.getElementById('matterPublicationDate');
    const layoutSelect = document.getElementById('matterLayout');
    const summaryTextarea = document.getElementById('matterSummary');
    const contentTextarea = document.getElementById('matterContent');
    const observationsTextarea = document.getElementById('matterObservations');
    
    if (!titleInput) throw new Error('Campo title não encontrado no DOM');
    if (!typeSelect) throw new Error('Campo matterTypeId não encontrado no DOM');
    if (!contentTextarea) throw new Error('Campo matterContent não encontrado no DOM');
    
    titleInput.value = matter.title || '';
    typeSelect.value = matter.matter_type_id || '';
    prioritySelect.value = matter.priority || 'normal';
    
    // Formatar data de publicação se existir
    if (publicationDateInput && matter.publication_date) {
      const pubDate = new Date(matter.publication_date);
      publicationDateInput.value = pubDate.toISOString().split('T')[0];
    }
    
    layoutSelect.value = matter.layout_columns || '2';
    summaryTextarea.value = matter.summary || '';
    contentTextarea.value = matter.content || '';
    observationsTextarea.value = matter.observations || '';
    
    // Carregar conteúdo no editor Quill
    if (window.currentQuillEditor) {
      console.log('📄 Carregando conteúdo no editor Quill');
      window.currentQuillEditor.root.innerHTML = matter.content || '';
    }
    
    // 🆕 CARREGAR ANEXOS EXISTENTES
    await loadExistingAttachments(id);
    
    console.log('✅ Formulário preenchido com sucesso');
    
  } catch (error) {
    console.error('❌ Erro ao carregar matéria:', error);
    console.error('❌ Stack:', error.stack);
    
    alert(`Erro ao carregar matéria para edição:\n\n${error.message}\n\nVerifique o console para mais detalhes.`);
    loadView('myMatters');
  }
}

// 🆕 NOVA FUNÇÃO: Carregar anexos existentes
// Carregar anexos existentes - COM BOTÃO DE VISUALIZAÇÃO
async function loadExistingAttachments(matterId) {
    try {
        const token = localStorage.getItem('dom_token');
        const response = await fetch(`/api/matters/${matterId}/attachments`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.log('ℹ️ Matéria não possui anexos ou erro ao carregar');
            return;
        }
        
        const data = await response.json();
        const attachments = data.attachments || [];
        
        if (attachments.length > 0) {
            console.log(`📎 Encontrados ${attachments.length} anexos`);
            
            // Marcar checkbox de anexos
            const hasAttachmentsCheckbox = document.getElementById('hasAttachments');
            const attachmentsSection = document.getElementById('attachmentsSection');
            const selectedFilesList = document.getElementById('selectedFilesList');
            
            if (hasAttachmentsCheckbox) {
                hasAttachmentsCheckbox.checked = true;
            }
            
            if (attachmentsSection) {
                attachmentsSection.style.display = 'block';
            }
            
            if (selectedFilesList) {
                // Mostrar anexos existentes
                selectedFilesList.innerHTML = attachments.map(att => {
                    const ext = (att.original_name || att.filename).split('.').pop().toLowerCase();
                    const isViewable = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'html', 'htm'].includes(ext);
                    
                    return `
                    <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg existing-attachment hover:bg-gray-50 transition" data-id="${att.id}">
                        <div class="flex items-center space-x-3">
                            <i class="fas fa-file-${getFileIcon(att.original_name)} text-blue-600 text-xl"></i>
                            <div>
                                <p class="text-sm font-medium text-gray-800">${att.original_name}</p>
                                <p class="text-xs text-gray-500">
                                    ${formatFileSize(att.file_size)} • Enviado em ${formatDate(att.uploaded_at)}
                                    ${isViewable ? ' • <span class="text-green-600"><i class="fas fa-eye"></i> Visualizável</span>' : ''}
                                </p>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            ${isViewable ? `
                            <button 
                                type="button"
                                class="preview-attachment-btn text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition"
                                title="Visualizar"
                                data-id="${att.id}"
                                data-filename="${att.original_name}"
                            >
                                <i class="fas fa-eye text-lg"></i>
                            </button>
                            ` : ''}
                            <button 
                                type="button"
                                class="download-attachment-btn text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 transition"
                                title="Download"
                                data-id="${att.id}"
                                data-filename="${att.original_name}"
                            >
                                <i class="fas fa-download text-lg"></i>
                            </button>
                            <button 
                                type="button"
                                class="delete-attachment-btn text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition"
                                title="Remover"
                                data-id="${att.id}"
                                data-filename="${att.original_name}"
                            >
                                <i class="fas fa-trash text-lg"></i>
                            </button>
                        </div>
                    </div>
                `}).join('');
                
                // Adicionar event listeners depois de criar o HTML
                setTimeout(() => {
                    // Preview buttons
                    document.querySelectorAll('.preview-attachment-btn').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = this.dataset.id;
                            const filename = this.dataset.filename;
                            viewAttachment(id, filename);
                        });
                    });
                    
                    // Download buttons
                    document.querySelectorAll('.download-attachment-btn').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = this.dataset.id;
                            const filename = this.dataset.filename;
                            downloadAttachment(id, filename);
                        });
                    });
                    
                    // Delete buttons
                    document.querySelectorAll('.delete-attachment-btn').forEach(btn => {
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = this.dataset.id;
                            const filename = this.dataset.filename;
                            if (confirm(`Remover anexo "${filename}"?`)) {
                                deleteExistingAttachment(id, filename);
                            }
                        });
                    });
                }, 100);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar anexos existentes:', error);
    }
}


// 🆕 FUNÇÃO: Visualizar anexo - CORRIGIDA
async function previewAttachment(attachmentId, filename) {
  try {
    console.log(`👁️ Tentando visualizar anexo ID: ${attachmentId}`);
    
    // Usar a rota de download, mas em uma nova aba
    const token = localStorage.getItem('dom_token');
    const downloadUrl = `/api/matters/attachments/${attachmentId}/download`;
    
    console.log(`🔗 URL: ${downloadUrl}`);
    
    // Verificar se a rota existe
    const testResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      method: 'HEAD' // Apenas verifica se o endpoint existe
    });
    
    if (!testResponse.ok) {
      throw new Error(`Endpoint não acessível (${testResponse.status})`);
    }
    
    // Criar um iframe para visualizar o arquivo
    const viewerDiv = document.createElement('div');
    viewerDiv.id = 'attachmentViewer';
    viewerDiv.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    `;
    
    viewerDiv.innerHTML = `
      <div style="background: white; border-radius: 10px; width: 95%; height: 95%; max-width: 1200px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="padding: 15px 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #333;">${filename}</h3>
          <div>
            <button id="closeViewer" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-weight: 500;">
              <i class="fas fa-times"></i> Fechar
            </button>
          </div>
        </div>
        <div id="viewerContent" style="flex: 1; padding: 20px; overflow: auto; background: #fff;">
          <div style="text-align: center; padding: 50px;">
            <div class="spinner" style="display: inline-block; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p style="margin-top: 20px; color: #666;">Carregando arquivo...</p>
          </div>
        </div>
      </div>
      
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    
    document.body.appendChild(viewerDiv);
    document.body.style.overflow = 'hidden'; // Impede scroll na página principal
    
    // Fechar o visualizador
    document.getElementById('closeViewer').addEventListener('click', () => {
      document.body.removeChild(viewerDiv);
      document.body.style.overflow = 'auto';
    });
    
    // Fechar com ESC
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        const viewer = document.getElementById('attachmentViewer');
        if (viewer) {
          document.body.removeChild(viewer);
          document.body.style.overflow = 'auto';
        }
        document.removeEventListener('keydown', escHandler);
      }
    });
    
    // Tentar visualizar baseado no tipo de arquivo
    const ext = filename.split('.').pop().toLowerCase();
    const viewerContent = document.getElementById('viewerContent');
    
    // URLs com timestamp para evitar cache
    const urlWithTimestamp = `${downloadUrl}?t=${Date.now()}`;
    
    if (['pdf'].includes(ext)) {
      // Para PDF, usar iframe
      viewerContent.innerHTML = `
        <iframe 
          src="${urlWithTimestamp}"
          style="width: 100%; height: 100%; border: none;"
          title="${filename}"
        ></iframe>
        <div style="text-align: center; padding: 10px; background: #f8f9fa; border-top: 1px solid #ddd;">
          <p style="margin: 0; font-size: 14px; color: #666;">
            Se o PDF não aparecer, <a href="${downloadUrl}" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 500;">
              clique aqui para baixar
            </a>
          </p>
        </div>
      `;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
      // Para imagens, usar tag img
      viewerContent.innerHTML = `
        <div style="text-align: center; height: 100%; display: flex; align-items: center; justify-content: center; background: #f8f9fa;">
          <div>
            <img 
              src="${urlWithTimestamp}" 
              alt="${filename}" 
              style="max-width: 100%; max-height: 80vh; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 1px solid #ddd;"
              onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\"color: #ef4444; padding: 40px;\"><i class=\"fas fa-exclamation-triangle\" style=\"font-size: 48px; margin-bottom: 20px;\"></i><p>Não foi possível carregar a imagem.</p><a href=\"${downloadUrl}\" download=\"${filename}\" style=\"display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;\">Baixar Arquivo</a></div>';"
            >
            <div style="margin-top: 20px;">
              <a href="${downloadUrl}" download="${filename}" style="display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-size: 14px;">
                <i class="fas fa-download"></i> Baixar Imagem
              </a>
            </div>
          </div>
        </div>
      `;
    } else if (['txt', 'csv', 'json', 'xml', 'html', 'htm', 'js', 'css'].includes(ext)) {
      // Para arquivos de texto, usar fetch para ler o conteúdo
      try {
        const response = await fetch(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const text = await response.text();
          viewerContent.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; height: 100%; overflow: auto;">
              <div style="background: white; border: 1px solid #ddd; border-radius: 5px; padding: 20px; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: break-word;">
                ${escapeHtml(text)}
              </div>
              <div style="text-align: center; margin-top: 20px;">
                <a href="${downloadUrl}" download="${filename}" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">
                  <i class="fas fa-download"></i> Download
                </a>
              </div>
            </div>
          `;
        } else {
          throw new Error('Erro ao carregar arquivo');
        }
      } catch (error) {
        viewerContent.innerHTML = `
          <div style="text-align: center; padding: 50px; color: #666;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b; margin-bottom: 20px;"></i>
            <p>Arquivo de texto não pode ser visualizado diretamente.</p>
            <div style="margin-top: 20px;">
              <a href="${downloadUrl}" download="${filename}" style="display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px;">
                <i class="fas fa-download"></i> Baixar Arquivo
              </a>
            </div>
          </div>
        `;
      }
    } else {
      // Para outros tipos, mostrar opção de download
      viewerContent.innerHTML = `
        <div style="text-align: center; padding: 50px; color: #666;">
          <i class="fas fa-file" style="font-size: 48px; color: #6b7280; margin-bottom: 20px;"></i>
          <p style="font-size: 16px; margin-bottom: 10px;">Arquivo: <strong>${ext.toUpperCase()}</strong></p>
          <p>Este tipo de arquivo não pode ser visualizado no navegador.</p>
          <div style="margin-top: 30px;">
            <a href="${downloadUrl}" download="${filename}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 5px; text-decoration: none; font-weight: 500;">
              <i class="fas fa-download"></i> Baixar Arquivo
            </a>
          </div>
        </div>
      `;
    }
    
  } catch (error) {
    console.error('❌ Erro ao visualizar anexo:', error);
    
    // Mostrar modal de erro simples
    alert(`❌ Erro ao visualizar arquivo:\n\n${error.message}\n\nTente baixar o arquivo para visualizar localmente.`);
    
    // Remover visualizador se existir
    const viewer = document.getElementById('attachmentViewer');
    if (viewer) {
      document.body.removeChild(viewer);
      document.body.style.overflow = 'auto';
    }
  }
}

// Função auxiliar para escapar HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 🆕 FUNÇÃO: Excluir anexo existente

async function deleteExistingAttachment(attachmentId, filename) {
  if (!confirm(`Tem certeza que deseja remover o anexo "${filename}"?\n\nEsta ação não pode ser desfeita.`)) {
    return;
  }
  
  try {
    console.log(`🗑️ Tentando excluir anexo ID: ${attachmentId}`);
    
    // CORREÇÃO: Usar a rota correta
    const response = await fetch(`/api/matters/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📊 Status da resposta: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro na resposta: ${errorText}`);
      
      let errorMessage = `Erro HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // Não é JSON, usar texto puro
      }
      
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('✅ Resposta da exclusão:', result);
    
    // Remover elemento do DOM
    const attachmentElement = document.querySelector(`.existing-attachment[data-id="${attachmentId}"]`);
    if (attachmentElement) {
      attachmentElement.remove();
      console.log('✅ Elemento removido do DOM');
    }
    
    // Verificar se ainda existem anexos
    const remainingAttachments = document.querySelectorAll('.existing-attachment');
    if (remainingAttachments.length === 0) {
      // Desmarcar checkbox e esconder seção
      const hasAttachmentsCheckbox = document.getElementById('hasAttachments');
      const attachmentsSection = document.getElementById('attachmentsSection');
      const selectedFilesList = document.getElementById('selectedFilesList');
      
      if (hasAttachmentsCheckbox) {
        hasAttachmentsCheckbox.checked = false;
      }
      if (attachmentsSection) {
        attachmentsSection.style.display = 'none';
      }
      if (selectedFilesList) {
        selectedFilesList.innerHTML = '';
      }
    }
    
    alert('✅ Anexo removido com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro detalhado ao remover anexo:', error);
    alert(`❌ Erro ao remover anexo:\n\n${error.message}\n\nVerifique o console (F12) para mais detalhes.`);
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
        let matterId = id;
        
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
            
            matterId = id;
            
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
            
            matterId = data.matterId;
        }
        
        // Upload de novos anexos se houver
        const hasAttachments = document.getElementById('hasAttachments')?.checked;
        const attachmentsInput = document.getElementById('matterAttachments');
        
        if (hasAttachments && attachmentsInput && attachmentsInput.files.length > 0) {
            console.log(`📤 Fazendo upload de ${attachmentsInput.files.length} arquivo(s)`);
            
            const formData = new FormData();
            for (let i = 0; i < attachmentsInput.files.length; i++) {
                formData.append('attachments', attachmentsInput.files[i]);
            }
            
            try {
                const uploadResponse = await api.post(`/matters/${matterId}/attachments`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                
                console.log('✅ Upload de anexos concluído:', uploadResponse.data);
            } catch (uploadError) {
                console.error('❌ Erro ao fazer upload de anexos:', uploadError);
                alert('Matéria salva, mas houve erro ao fazer upload dos anexos');
            }
        }
        
        if (submitForReview) {
            await api.post(`/matters/${matterId}/submit`);
            alert('Matéria salva e enviada para análise com sucesso!');
        } else {
            alert('Matéria salva com sucesso!');
        }
        
        loadView('myMatters');
        
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao salvar matéria');
    }
}

// Toggle attachments section
function toggleAttachmentsSection() {
    const checkbox = document.getElementById('hasAttachments');
    const section = document.getElementById('attachmentsSection');
    
    if (checkbox.checked) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
        // Clear files when unchecked
        document.getElementById('matterAttachments').value = '';
        document.getElementById('selectedFilesList').innerHTML = '';
    }
}


// Handle attachment file selection
// Handle attachment file selection - APENAS PDF
function handleAttachmentSelection() {
    const input = document.getElementById('matterAttachments');
    const filesList = document.getElementById('selectedFilesList');
    const files = Array.from(input.files);
    
    if (files.length === 0) {
        filesList.innerHTML = '';
        return;
    }
    
    // Validar se são PDFs
    const invalidFiles = files.filter(f => {
        const isPDF = f.type === 'application/pdf' || 
                     f.name.toLowerCase().endsWith('.pdf');
        return !isPDF;
    });
    
    if (invalidFiles.length > 0) {
        alert(`❌ Apenas arquivos PDF são permitidos!\n\nOs seguintes arquivos NÃO são PDFs:\n${invalidFiles.map(f => f.name).join('\n')}`);
        input.value = '';
        filesList.innerHTML = '';
        return;
    }
    
    // Validate file sizes (10MB max per file)
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedFiles = files.filter(f => f.size > maxSize);
    
    if (oversizedFiles.length > 0) {
        alert(`❌ Os seguintes arquivos excedem o tamanho máximo de 10MB:\n${oversizedFiles.map(f => f.name).join('\n')}`);
        input.value = '';
        filesList.innerHTML = '';
        return;
    }
    
    // Display selected files
    filesList.innerHTML = files.map((file, index) => `
        <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
            <div class="flex items-center space-x-3">
                <i class="fas fa-file-pdf text-red-600 text-xl"></i>
                <div>
                    <p class="text-sm font-medium text-gray-800">${file.name}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(file.size)} • PDF</p>
                </div>
            </div>
            <button 
                type="button"
                onclick="removeAttachment(${index})"
                class="text-red-600 hover:text-red-800"
                title="Remover arquivo"
            >
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}


// Remove individual attachment
function removeAttachment(index) {
    const input = document.getElementById('matterAttachments');
    const dt = new DataTransfer();
    const files = Array.from(input.files);
    
    files.forEach((file, i) => {
        if (i !== index) {
            dt.items.add(file);
        }
    });
    
    input.files = dt.files;
    handleAttachmentSelection();
}

// Get file icon based on extension
// Get file icon based on extension - FUNÇÃO COMPLETA
function getFileIcon(filename) {
    if (!filename) return 'alt';
    
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        'pdf': 'pdf',
        // 'doc': 'word',
        // 'docx': 'word',
        // 'xls': 'excel',
        // 'xlsx': 'excel',
        // 'jpg': 'image',
        // 'jpeg': 'image',
        // 'png': 'image',
        // 'gif': 'image',
        // 'txt': 'alt',
        // 'zip': 'archive',
        // 'rar': 'archive',
        // '7z': 'archive'
    };
    return icons[ext] || 'alt';
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
    // Usar a rota /cancel que criamos
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
                `;
            }).join('')}
            
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
        console.log('🔍 reviewMatter chamado para ID:', id);
        
        const { data } = await api.get(`/matters/${id}`);
        console.log('📦 Dados recebidos da API:', data);
        
        // A API retorna o objeto diretamente, não dentro de { matter }
        const matter = data;
        
        if (!matter || !matter.title) {
            console.error('❌ Dados inválidos recebidos:', data);
            throw new Error('Dados da matéria inválidos');
        }
        
        console.log('✅ Matéria carregada:', matter.title);
        
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
                        <p class="text-gray-600 mt-2">${matter.matter_type_name || matter.matter_type || 'Sem tipo'}</p>
                    </div>
                    <span class="px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(matter.status)}">
                        ${getStatusName(matter.status)}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                        <p class="text-sm text-gray-500">Secretaria</p>
                        <p class="font-medium">${matter.secretaria_name || matter.secretaria_acronym || '-'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Autor</p>
                        <p class="font-medium">${matter.author_name || '-'}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Enviado em</p>
                        <p class="font-medium">${formatDate(matter.submitted_at)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Versão</p>
                        <p class="font-medium">v${matter.version || 1}</p>
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
        console.error('❌ Erro detalhado ao carregar matéria:', error);
        content.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-6">
                <h3 class="text-lg font-bold text-red-800 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>Erro ao carregar matéria
                </h3>
                <p class="text-red-700">${error.message}</p>
                <button onclick="loadView('pendingReview')" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-arrow-left mr-2"></i>Voltar para análise
                </button>
            </div>
        `;
    }
}

async function approveMatter(id) {
    const notes = document.getElementById('reviewNotes')?.value || '';
    
    if (!confirm('Deseja aprovar esta matéria?')) {
        return;
    }
    
    try {
        console.log('✅ Aprovando matéria ID:', id);
        
        const { data } = await api.post(`/semad/${id}/approve`, {
            review_notes: notes
        });
        
        console.log('📦 Resposta da aprovação:', data);
        
        alert(`Matéria aprovada com sucesso!${data.signature ? `\n\nAssinatura eletrônica: ${data.signature.substring(0, 16)}...` : ''}`);
        loadView('pendingReview');
    } catch (error) {
        console.error('❌ Erro ao aprovar matéria:', error);
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
        console.log('❌ Rejeitando matéria ID:', id);
        
        await api.post(`/semad/${id}/reject`, {
            rejection_reason: reason
        });
        
        alert('Matéria rejeitada com sucesso!');
        loadView('pendingReview');
    } catch (error) {
        console.error('❌ Erro ao rejeitar matéria:', error);
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

async function loadUsersManagement(container) {
    try {
        // Adicionar timestamp para evitar cache
        const { data } = await api.get(`/users?_t=${Date.now()}`);
        
        container.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-users mr-2"></i>Gerenciamento de Usuários
                    </h2>
                    <button onclick="showNewUserModal()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">
                        <i class="fas fa-plus mr-2"></i>Novo Usuário
                    </button>
                </div>
                
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Perfil</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Secretaria</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${data.users.map(user => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="font-medium text-gray-900">${user.name}</span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-gray-700">
                                        ${user.email}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="${getRoleBadgeColor(user.role)} px-3 py-1 rounded-full text-sm font-medium">
                                            ${getRoleName(user.role)}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-gray-700">
                                        ${user.secretaria_acronym || '-'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="${user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-3 py-1 rounded-full text-sm font-medium">
                                            ${user.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                        <button onclick="editUser(${user.id})" class="text-blue-600 hover:text-blue-900" title="Editar">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button onclick="resetUserPassword(${user.id})" class="text-green-600 hover:text-green-900" title="Resetar senha">
                                            <i class="fas fa-key"></i>
                                        </button>
                                        ${user.id !== state.user.id ? `
                                            <button onclick="toggleUserStatus(${user.id}, ${user.active})" class="text-yellow-600 hover:text-yellow-900" title="${user.active ? 'Desativar' : 'Ativar'}">
                                                <i class="fas fa-${user.active ? 'ban' : 'check'}"></i>
                                            </button>
                                            <button onclick="deleteUser(${user.id}, '${user.name}')" class="text-red-600 hover:text-red-900" title="Excluir usuário">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = `<p class="text-red-600">Erro ao carregar usuários: ${error.message}</p>`;
    }
}

function getRoleBadgeColor(role) {
    const colors = {
        admin: 'bg-purple-100 text-purple-800',
        semad: 'bg-green-100 text-green-800',
        secretaria: 'bg-blue-100 text-blue-800',
        publico: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
}

async function showNewUserModal() {
    // Buscar secretarias para o dropdown
    const { data: secretariasData } = await api.get('/secretarias');
    const secretarias = secretariasData.secretarias || [];
    
    const secretariasOptions = secretarias.map(s => 
        `<option value="${s.id}">${s.acronym} - ${s.name}</option>`
    ).join('');
    
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="userModal">
            <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Novo Usuário</h3>
                
                <form id="userForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                        <input type="text" id="newUserName" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                        <input type="email" id="newUserEmail" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">CPF (opcional)</label>
                        <input type="text" id="newUserCpf" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="000.000.000-00">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
                        <input type="password" id="newUserPassword" required minlength="6" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Mínimo 6 caracteres">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Perfil *</label>
                        <select id="newUserRole" required class="w-full px-4 py-2 border border-gray-300 rounded-lg" onchange="toggleSecretariaField()">
                            <option value="">Selecione...</option>
                            <option value="admin">Administrador</option>
                            <option value="semad">SEMAD</option>
                            <option value="secretaria">Secretaria</option>
                            <option value="publico">Público</option>
                        </select>
                    </div>
                    
                    <div id="newSecretariaField" style="display:none;">
                        <label class="block text-sm font-medium text-gray-700 mb-1">Secretaria *</label>
                        <select id="newUserSecretaria" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            <option value="">Selecione...</option>
                            ${secretariasOptions}
                        </select>
                    </div>
                    
                    <div class="flex justify-end space-x-2 mt-6">
                        <button type="button" onclick="closeUserModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                            Cancelar
                        </button>
                        <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            Criar Usuário
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Toggle secretaria field based on role
    window.toggleSecretariaField = function() {
        const role = document.getElementById('newUserRole').value;
        const secretariaField = document.getElementById('newSecretariaField');
        const secretariaSelect = document.getElementById('newUserSecretaria');
        
        if (role === 'secretaria') {
            secretariaField.style.display = 'block';
            secretariaSelect.required = true;
        } else {
            secretariaField.style.display = 'none';
            secretariaSelect.required = false;
            secretariaSelect.value = '';
        }
    };
    
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('newUserName');
        const emailInput = document.getElementById('newUserEmail');
        const cpfInput = document.getElementById('newUserCpf');
        const passwordInput = document.getElementById('newUserPassword');
        const roleInput = document.getElementById('newUserRole');
        const secretariaInput = document.getElementById('newUserSecretaria');
        
        console.log('Form elements:', {
            nameInput, emailInput, passwordInput, roleInput, secretariaInput
        });
        
        const role = roleInput?.value || '';
        const secretariaId = secretariaInput?.value || '';
        
        // Validação adicional
        if (role === 'secretaria' && !secretariaId) {
            alert('Por favor, selecione uma secretaria para usuários do tipo Secretaria');
            return;
        }
        
        const nameValue = nameInput?.value?.trim() || '';
        const emailValue = emailInput?.value?.trim() || '';
        const cpfValue = cpfInput?.value?.trim() || '';
        const passwordValue = passwordInput?.value || '';
        
        console.log('Form values:', {
            nameValue, emailValue, passwordValue, role, secretariaId
        });
        
        if (!nameValue || !emailValue || !passwordValue) {
            alert('Nome, email e senha são obrigatórios');
            console.error('Validation failed:', { nameValue, emailValue, passwordValue });
            return;
        }
        
        const userData = {
            name: nameValue.trim(),
            email: emailValue.trim(),
            cpf: (cpfValue && cpfValue.trim()) || null,
            password: passwordValue,
            role: role,
            secretaria_id: secretariaId ? parseInt(secretariaId) : null
        };
        
        try {
            await api.post('/users', userData);
            alert('Usuário criado com sucesso!');
            closeUserModal();
            loadView('users');
        } catch (error) {
            alert(error.response?.data?.error || 'Erro ao criar usuário');
        }
    });
}

function closeUserModal() {
    document.getElementById('userModal')?.remove();
}

async function editUser(id) {
    try {
        console.log('✅ FUNÇÃO EDITUSER DO APP-V2.JS CARREGADA!');
        alert('✅ Usando código NOVO (app-v2.js) - Nome e perfil serão enviados!');
        
        // Buscar secretarias para o select
        const { data: secretariasData } = await api.get('/secretarias');
        const secretarias = secretariasData.secretarias || [];
        
        const { data } = await api.get(`/users/${id}`);
        const user = data.user;
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="userModal">
                <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 max-h-screen overflow-y-auto">
                    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                        ✅ CÓDIGO ATUALIZADO - Versão app-v2.js carregada!
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Editar Usuário</h3>
                    
                    <form id="userForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                            <input type="text" id="userName" value="${user.name}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" id="userEmail" value="${user.email}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                            <input type="text" id="userCpf" value="${user.cpf || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="000.000.000-00">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                            <select id="userRole" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrador</option>
                                <option value="semad" ${user.role === 'semad' ? 'selected' : ''}>SEMAD (Coordenador)</option>
                                <option value="secretaria" ${user.role === 'secretaria' ? 'selected' : ''}>Secretaria</option>
                                <option value="publico" ${user.role === 'publico' ? 'selected' : ''}>Público</option>
                            </select>
                        </div>
                        
                        <div id="secretariaFieldContainer">
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                Secretaria 
                                ${user.role === 'secretaria' ? '<span class="text-red-500">*</span>' : ''}
                            </label>
                            <select id="userSecretaria" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                <option value="">-- Nenhuma --</option>
                                ${secretarias.map(s => `
                                    <option value="${s.id}" ${user.secretaria_id === s.id ? 'selected' : ''}>
                                        ${s.acronym} - ${s.name}
                                    </option>
                                `).join('')}
                            </select>
                            <p class="text-xs text-gray-500 mt-1" id="secretariaHelp">
                                ${user.role === 'secretaria' ? '⚠️ Obrigatório para perfil "Secretaria"' : 'Opcional para este perfil'}
                            </p>
                        </div>
                        
                        <div class="flex items-center">
                            <input type="checkbox" id="userActive" ${user.active ? 'checked' : ''} class="mr-2">
                            <label for="userActive" class="text-sm font-medium text-gray-700">Usuário Ativo</label>
                        </div>
                        
                        <div class="flex justify-end space-x-2 mt-6">
                            <button type="button" onclick="closeUserModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                                Cancelar
                            </button>
                            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                Salvar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Mostrar/esconder campo secretaria baseado no perfil
        const roleSelect = document.getElementById('userRole');
        const secretariaField = document.getElementById('secretariaFieldContainer');
        const secretariaSelect = document.getElementById('userSecretaria');
        const secretariaHelp = document.getElementById('secretariaHelp');
        const secretariaLabel = secretariaField.querySelector('label');
        
        function toggleSecretariaField() {
            const role = roleSelect.value;
            // Mostrar campo se: perfil é secretaria/semad OU usuário já tem secretaria associada
            if (role === 'secretaria' || role === 'semad' || user.secretaria_id) {
                secretariaField.style.display = 'block';
                
                // Tornar obrigatório apenas para perfil "secretaria"
                if (role === 'secretaria') {
                    secretariaSelect.required = true;
                    secretariaLabel.innerHTML = 'Secretaria <span class="text-red-500">*</span>';
                    secretariaHelp.innerHTML = '⚠️ Obrigatório para perfil "Secretaria"';
                    secretariaHelp.className = 'text-xs text-red-600 mt-1';
                } else {
                    secretariaSelect.required = false;
                    secretariaLabel.innerHTML = 'Secretaria';
                    secretariaHelp.innerHTML = 'Opcional para este perfil';
                    secretariaHelp.className = 'text-xs text-gray-500 mt-1';
                }
            } else {
                secretariaField.style.display = 'none';
                secretariaSelect.required = false;
            }
        }
        
        roleSelect.addEventListener('change', toggleSecretariaField);
        toggleSecretariaField();
        
        const formElement = document.getElementById('userForm');
        
        // 🔍 DIAGNÓSTICO: Verificar quantos listeners já existem
        const listenerCount = formElement.getEventListeners ? 
            (formElement.getEventListeners('submit')?.length || 0) : 
            'N/A (use Chrome DevTools para verificar)';
        console.log('⚠️ LISTENERS NO FORM:', listenerCount);
        
        // 🧹 LIMPAR qualquer listener anterior (medida drástica)
        const newForm = formElement.cloneNode(true);
        formElement.parentNode.replaceChild(newForm, formElement);
        
        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopImmediatePropagation(); // Bloquear outros handlers
            
            console.log('🎯 EVENT ORIGINAL:', e);
            console.log('🎯 TARGET:', e.target);
            console.log('🎯 CURRENT TARGET:', e.currentTarget);
            
            const nameElement = document.getElementById('userName');
            const roleElement = document.getElementById('userRole');
            const emailElement = document.getElementById('userEmail');
            const cpfElement = document.getElementById('userCpf');
            const secretariaElement = document.getElementById('userSecretaria');
            const activeElement = document.getElementById('userActive');
            
            console.log('📋 ELEMENTOS DO FORM:', {
                name: nameElement,
                role: roleElement,
                email: emailElement,
                cpf: cpfElement,
                secretaria: secretariaElement,
                active: activeElement
            });
            
            alert('🔥 SUBMIT V2! Nome: ' + nameElement?.value + ' | Role: ' + roleElement?.value);
            
            console.log('🚀 EDITUSER SUBMIT - Código app-v2.js executando!');
            console.log('📝 Nome elemento:', nameElement, 'Valor:', nameElement?.value);
            console.log('📝 Role elemento:', roleElement, 'Valor:', roleElement?.value);
            
            const role = roleElement.value;
            const secretariaValue = secretariaElement.value;
            
            // Validar secretaria para perfil "secretaria"
            if (role === 'secretaria' && !secretariaValue) {
                alert('Por favor, selecione uma secretaria para usuários do tipo "Secretaria"');
                return;
            }
            
            const userData = {
                name: nameElement.value,
                email: emailElement.value,
                cpf: cpfElement.value || null,
                role: role,
                secretaria_id: secretariaValue ? parseInt(secretariaValue) : null,
                active: activeElement.checked ? 1 : 0
            };
            
            alert('📤 ENVIANDO: ' + JSON.stringify(userData));
            console.log('📤 DADOS A ENVIAR:', JSON.stringify(userData, null, 2));
            
            // 🔍 Interceptar o que Axios VAI enviar
            console.log('🌐 ANTES do api.put - userData:', userData);
            
            try {
                const response = await api.put(`/users/${id}`, userData);
                console.log('✅ RESPONSE:', response);
                alert('Usuário atualizado com sucesso!');
                closeUserModal();
                loadView('users');
            } catch (error) {
                console.error('❌ ERRO:', error);
                alert(error.response?.data?.error || 'Erro ao atualizar usuário');
            }
        });
        
    } catch (error) {
        console.error('Error loading user:', error);
        alert('Erro ao carregar dados do usuário');
    }
}

async function resetUserPassword(id) {
    const newPassword = prompt('Digite a nova senha (mínimo 6 caracteres):');
    
    if (!newPassword || newPassword.length < 6) {
        alert('Senha deve ter pelo menos 6 caracteres');
        return;
    }
    
    if (!confirm('Confirma o reset da senha para este usuário?')) {
        return;
    }
    
    try {
        await api.put(`/users/${id}/reset-password`, { new_password: newPassword });
        alert('Senha resetada com sucesso!');
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao resetar senha');
    }
}

async function toggleUserStatus(id, currentStatus) {
    const action = currentStatus ? 'desativar' : 'ativar';
    
    if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) {
        return;
    }
    
    try {
        // Atualizar status ativo/inativo (não excluir)
        await api.put(`/users/${id}`, { active: currentStatus ? 0 : 1 });
        alert(`Usuário ${action === 'desativar' ? 'desativado' : 'ativado'} com sucesso!`);
        loadView('users');
    } catch (error) {
        alert(error.response?.data?.error || `Erro ao ${action} usuário`);
    }
}

async function deleteUser(id, userName) {
    if (!confirm(`⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente o usuário "${userName}"?\n\nEsta ação NÃO pode ser desfeita!`)) {
        return;
    }
    
    // Confirmação dupla para segurança
    if (!confirm(`Digite SIM para confirmar a exclusão do usuário "${userName}"`)) {
        return;
    }
    
    try {
        await api.delete(`/users/${id}`);
        alert(`Usuário "${userName}" excluído com sucesso!`);
        loadView('users');
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao excluir usuário');
    }
}

// ====================================
// ADMIN: HOLIDAYS MANAGEMENT
// ====================================

async function loadHolidaysManagement(container) {
    try {
        // Buscar feriados do banco - usar query direta ao DB pois não há rota específica
        const currentYear = new Date().getFullYear();
        
        container.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-calendar-alt mr-2"></i>Gerenciamento de Feriados
                    </h2>
                    <div class="flex space-x-2">
                        <select id="holidayYearFilter" class="px-4 py-2 border border-gray-300 rounded-lg" onchange="filterHolidaysByYear()">
                            <option value="">Todos os Anos</option>
                            <option value="${currentYear - 1}">${currentYear - 1}</option>
                            <option value="${currentYear}" selected>${currentYear}</option>
                            <option value="${currentYear + 1}">${currentYear + 1}</option>
                        </select>
                        <button onclick="showNewHolidayModal()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">
                            <i class="fas fa-plus mr-2"></i>Novo Feriado
                        </button>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow overflow-hidden">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorrente</th>
                                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody id="holidaysTableBody" class="bg-white divide-y divide-gray-200">
                            <tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Carregando...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        loadHolidaysTable(currentYear);
        
    } catch (error) {
        container.innerHTML = `<p class="text-red-600">Erro ao carregar módulo: ${error.message}</p>`;
    }
}

async function loadHolidaysTable(year = null) {
    try {
        // Buscar feriados da API
        const params = year ? `?year=${year}` : '';
        const { data } = await api.get(`/holidays${params}`);
        const holidays = data.holidays || [];
        
        const tbody = document.getElementById('holidaysTableBody');
        if (!tbody) return;
        
        const filteredHolidays = holidays;
    
        if (filteredHolidays.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Nenhum feriado encontrado</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredHolidays.map(holiday => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${new Date(holiday.date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">${holiday.name}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${holiday.type === 'national' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}">
                    ${holiday.type === 'national' ? 'Nacional' : 'Facultativo'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${holiday.is_recurring ? '<i class="fas fa-check text-green-600"></i> Sim' : '<i class="fas fa-times text-gray-400"></i> Não'}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="editHoliday(${holiday.id})" class="text-blue-600 hover:text-blue-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteHoliday(${holiday.id}, '${holiday.name}')" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading holidays:', error);
        const tbody = document.getElementById('holidaysTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-red-500">Erro ao carregar feriados</td></tr>';
        }
    }
}

function filterHolidaysByYear() {
    const year = document.getElementById('holidayYearFilter').value;
    loadHolidaysTable(year || null);
}

function showNewHolidayModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="holidayModal">
            <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Novo Feriado</h3>
                
                <form id="holidayForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                        <input type="text" id="holidayName" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                        <input type="date" id="holidayDate" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                        <select id="holidayType" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                            <option value="national">Nacional</option>
                            <option value="optional">Facultativo</option>
                            <option value="municipal">Municipal</option>
                        </select>
                    </div>
                    
                    <div class="flex items-center">
                        <input type="checkbox" id="holidayRecurring" class="mr-2">
                        <label class="text-sm text-gray-700">Feriado Recorrente (todo ano)</label>
                    </div>
                    
                    <div class="flex justify-end space-x-2 mt-6">
                        <button type="button" onclick="closeHolidayModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                            Cancelar
                        </button>
                        <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            Criar Feriado
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('holidayForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const holidayData = {
            name: document.getElementById('holidayName').value.trim(),
            date: document.getElementById('holidayDate').value,
            type: document.getElementById('holidayType').value,
            is_recurring: document.getElementById('holidayRecurring').checked
        };
        
        try {
            await api.post('/holidays', holidayData);
            alert('Feriado criado com sucesso!');
            closeHolidayModal();
            
            // Recarregar tabela
            const year = document.getElementById('holidayYearFilter')?.value;
            loadHolidaysTable(year || null);
        } catch (error) {
            alert(error.response?.data?.error || 'Erro ao criar feriado');
        }
    });
}

function closeHolidayModal() {
    document.getElementById('holidayModal')?.remove();
}

async function editHoliday(id) {
    try {
        // Buscar dados do feriado
        const { data } = await api.get(`/holidays/${id}`);
        const holiday = data.holiday;
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="holidayModal">
                <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Editar Feriado</h3>
                    
                    <form id="holidayEditForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                            <input type="text" id="holidayName" value="${holiday.name}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                            <input type="date" id="holidayDate" value="${holiday.date}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                            <select id="holidayType" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                                <option value="national" ${holiday.type === 'national' ? 'selected' : ''}>Nacional</option>
                                <option value="state" ${holiday.type === 'state' ? 'selected' : ''}>Estadual</option>
                                <option value="municipal" ${holiday.type === 'municipal' ? 'selected' : ''}>Municipal</option>
                                <option value="optional" ${holiday.type === 'optional' ? 'selected' : ''}>Facultativo</option>
                            </select>
                        </div>
                        
                        <div class="flex items-center">
                            <input type="checkbox" id="holidayRecurring" ${holiday.is_recurring ? 'checked' : ''} class="mr-2">
                            <label class="text-sm text-gray-700">Feriado Recorrente (todo ano)</label>
                        </div>
                        
                        <div class="flex justify-end space-x-2 mt-6">
                            <button type="button" onclick="closeHolidayModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                                Cancelar
                            </button>
                            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                Salvar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('holidayEditForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updatedData = {
                name: document.getElementById('holidayName').value.trim(),
                date: document.getElementById('holidayDate').value,
                type: document.getElementById('holidayType').value,
                is_recurring: document.getElementById('holidayRecurring').checked
            };
            
            try {
                await api.put(`/holidays/${id}`, updatedData);
                alert('Feriado atualizado com sucesso!');
                closeHolidayModal();
                
                // Recarregar tabela
                const year = document.getElementById('holidayYearFilter')?.value;
                loadHolidaysTable(year || null);
            } catch (error) {
                alert(error.response?.data?.error || 'Erro ao atualizar feriado');
            }
        });
        
    } catch (error) {
        alert('Erro ao carregar dados do feriado');
    }
}

async function deleteHoliday(id, name) {
    if (!confirm(`Tem certeza que deseja excluir o feriado "${name}"?`)) {
        return;
    }
    
    try {
        await api.delete(`/holidays/${id}`);
        alert('Feriado removido com sucesso!');
        
        // Recarregar tabela
        const year = document.getElementById('holidayYearFilter')?.value;
        loadHolidaysTable(year || null);
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao deletar feriado');
    }
}

// ====================================
// ADMIN: SECRETARIAS MANAGEMENT
// ====================================

async function loadSecretariasManagement(container) {
    try {
        const { data } = await api.get('/secretarias');
        const secretarias = data.secretarias || [];
        
        container.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-building mr-2"></i>Gerenciamento de Secretarias
                    </h2>
                    <button onclick="showNewSecretariaModal()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">
                        <i class="fas fa-plus mr-2"></i>Nova Secretaria
                    </button>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${secretarias.map(sec => `
                        <div class="bg-white rounded-lg shadow p-6">
                            <div class="flex justify-between items-start mb-4">
                                <div class="flex-1">
                                    <h3 class="text-lg font-bold text-gray-800">${sec.acronym}</h3>
                                    <p class="text-sm text-gray-600 mt-1">${sec.name}</p>
                                </div>
                                <div class="flex space-x-2">
                                    <button onclick="editSecretaria(${sec.id})" class="text-blue-600 hover:text-blue-800">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteSecretaria(${sec.id}, '${sec.acronym}')" class="text-red-600 hover:text-red-800">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                            
                            ${sec.responsible ? `<p class="text-sm text-gray-600 mb-2"><strong>Responsável:</strong> ${sec.responsible}</p>` : ''}
                            
                            <div class="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                                <div class="text-center">
                                    <p class="text-2xl font-bold text-blue-600">${sec.total_users || 0}</p>
                                    <p class="text-xs text-gray-500">Usuários</p>
                                </div>
                                <div class="text-center">
                                    <p class="text-2xl font-bold text-green-600">${sec.total_matters || 0}</p>
                                    <p class="text-xs text-gray-500">Matérias</p>
                                </div>
                            </div>
                            
                            ${sec.email || sec.phone ? `
                                <div class="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
                                    ${sec.email ? `<div><i class="fas fa-envelope mr-1"></i>${sec.email}</div>` : ''}
                                    ${sec.phone ? `<div class="mt-1"><i class="fas fa-phone mr-1"></i>${sec.phone}</div>` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
    } catch (error) {
        container.innerHTML = `<p class="text-red-600">Erro ao carregar secretarias: ${error.message}</p>`;
    }
}

function showNewSecretariaModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="secretariaModal">
            <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Nova Secretaria</h3>
                
                <form id="secretariaForm" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Sigla/Acrônimo *</label>
                        <input type="text" id="secAcronym" required maxlength="10" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Ex: SEMED">
                        <p class="text-xs text-gray-500 mt-1">Máximo 10 caracteres, será convertido para maiúsculas</p>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                        <input type="text" id="secName" required class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Ex: Secretaria Municipal de Educação">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Responsável (opcional)</label>
                        <input type="text" id="secResponsible" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Nome do responsável">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email de Contato</label>
                        <input type="email" id="secEmail" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="contato@secretaria.gov.br">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Telefone de Contato</label>
                        <input type="tel" id="secPhone" class="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="(98) 3214-5678">
                    </div>
                    
                    <div class="flex justify-end space-x-2 mt-6">
                        <button type="button" onclick="closeSecretariaModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                            Cancelar
                        </button>
                        <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            Criar Secretaria
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('secretariaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const secData = {
            acronym: document.getElementById('secAcronym').value.trim().toUpperCase(),
            name: document.getElementById('secName').value.trim(),
            responsible: document.getElementById('secResponsible').value.trim() || null,
            email: document.getElementById('secEmail').value.trim() || null,
            phone: document.getElementById('secPhone').value.trim() || null
        };
        
        try {
            await api.post('/secretarias', secData);
            alert('Secretaria criada com sucesso!');
            closeSecretariaModal();
            loadView('secretarias');
        } catch (error) {
            alert(error.response?.data?.error || 'Erro ao criar secretaria');
        }
    });
}

function closeSecretariaModal() {
    document.getElementById('secretariaModal')?.remove();
}

async function editSecretaria(id) {
    try {
        const { data } = await api.get(`/secretarias/${id}`);
        const sec = data.secretaria;
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="secretariaModal">
                <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Editar Secretaria</h3>
                    
                    <form id="secretariaForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Sigla/Acrônimo *</label>
                            <input type="text" id="secAcronym" value="${sec.acronym}" required maxlength="10" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                            <input type="text" id="secName" value="${sec.name}" required class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                            <input type="text" id="secResponsible" value="${sec.responsible || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email de Contato</label>
                            <input type="email" id="secEmail" value="${sec.email || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Telefone de Contato</label>
                            <input type="tel" id="secPhone" value="${sec.phone || ''}" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        </div>
                        
                        <div class="flex justify-end space-x-2 mt-6">
                            <button type="button" onclick="closeSecretariaModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                                Cancelar
                            </button>
                            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                Salvar Alterações
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('secretariaForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const secData = {
                acronym: document.getElementById('secAcronym').value.trim().toUpperCase(),
                name: document.getElementById('secName').value.trim(),
                responsible: document.getElementById('secResponsible').value.trim() || null,
                email: document.getElementById('secEmail').value.trim() || null,
                phone: document.getElementById('secPhone').value.trim() || null
            };
            
            try {
                await api.put(`/secretarias/${id}`, secData);
                alert('Secretaria atualizada com sucesso!');
                closeSecretariaModal();
                loadView('secretarias');
            } catch (error) {
                alert(error.response?.data?.error || 'Erro ao atualizar secretaria');
            }
        });
        
    } catch (error) {
        alert('Erro ao carregar dados da secretaria');
    }
}

async function deleteSecretaria(id, acronym) {
    if (!confirm(`Tem certeza que deseja excluir a secretaria "${acronym}"?\n\nATENÇÃO: Esta ação não pode ser desfeita!`)) {
        return;
    }
    
    try {
        await api.delete(`/secretarias/${id}`);
        alert('Secretaria excluída com sucesso!');
        loadView('secretarias');
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao excluir secretaria');
    }
}

// ====================================
// ADMIN: SYSTEM SETTINGS
// ====================================

async function loadSystemSettings(container) {
    try {
        const { data: settingsData } = await api.get('/settings');
        let settings = settingsData.settings || [];
        
        // Se receber array, converter para formato esperado
        if (Array.isArray(settings)) {
            const grouped = {};
            settings.forEach(s => {
                const category = s.key.split('_')[0] || 'general'; // Usar prefixo da key como categoria
                if (!grouped[category]) grouped[category] = {};
                grouped[category][s.key] = s;
            });
            settings = grouped;
        }
        
        container.innerHTML = `
            <h2 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-cog mr-2"></i>Configurações do Sistema
            </h2>
            
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <div class="mb-4 flex justify-between items-center">
                    <h3 class="text-lg font-semibold text-gray-800">
                        <i class="fas fa-image text-blue-600 mr-2"></i>Logo da Prefeitura
                    </h3>
                </div>
                
                <div class="flex items-start space-x-6">
                    <div id="logoPreview" class="border-2 border-dashed border-gray-300 rounded-lg p-4 w-48 h-48 flex items-center justify-center">
                        <span class="text-gray-400">Nenhum logo</span>
                    </div>
                    
                    <div class="flex-1">
                        <p class="text-sm text-gray-600 mb-4">
                            Faça upload do brasão ou logo da prefeitura que será exibido nos PDFs do Diário Oficial (cabeçalho e rodapé).
                        </p>
                        <input type="file" id="logoFile" accept="image/*" class="hidden">
                        <button onclick="document.getElementById('logoFile').click()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-upload mr-2"></i>Upload Logo
                        </button>
                        <p class="text-xs text-gray-500 mt-2">Formatos aceitos: PNG, JPG, SVG (máx. 2MB)</p>
                    </div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6" id="settingsGrid">
                ${generateSettingsCards(settings)}
            </div>
            
            <div class="bg-white rounded-lg shadow p-6">
                <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-semibold text-gray-800">
                            <i class="fas fa-check-circle text-green-600 mr-2"></i>Status do Sistema
                        </h3>
                        <p class="text-sm text-gray-600 mt-1">Todas as configurações estão operacionais</p>
                    </div>
                    <button onclick="saveAllSettings()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg">
                        <i class="fas fa-save mr-2"></i>Salvar Todas
                    </button>
                </div>
            </div>
        `;
        
        // Carregar logo atual
        loadCurrentLogo();
        
        // Setup logo upload
        document.getElementById('logoFile').addEventListener('change', handleLogoUpload);
        
    } catch (error) {
        console.error('Error loading settings:', error);
        container.innerHTML = `<p class="text-red-600">Erro ao carregar configurações</p>`;
    }
}

function generateSettingsCards(settings) {
    // Agrupar configurações por prefixo da key
    const categoryNames = {
        expediente: { name: 'EXPEDIENTE (Última Página)', icon: 'id-card', color: 'indigo' },
        diario: { name: 'Cabeçalho do Diário', icon: 'newspaper', color: 'purple' },
        prefeitura: { name: 'Dados da Prefeitura', icon: 'building', color: 'blue' },
        dom: { name: 'Diário Oficial (Geral)', icon: 'book', color: 'cyan' },
        edicao: { name: 'Edições e Numeração', icon: 'hashtag', color: 'indigo' },
        pdf: { name: 'Configurações de PDF', icon: 'file-pdf', color: 'red' },
        assinatura: { name: 'Assinatura Digital', icon: 'signature', color: 'green' },
        prazos: { name: 'Prazos', icon: 'clock', color: 'orange' },
        notif: { name: 'Notificações', icon: 'bell', color: 'yellow' },
        acesso: { name: 'Acesso Público', icon: 'globe', color: 'teal' },
        auditoria: { name: 'Auditoria', icon: 'shield-alt', color: 'gray' },
        backup: { name: 'Backup', icon: 'database', color: 'cyan' },
        interface: { name: 'Interface', icon: 'palette', color: 'pink' }
    };
    
    // Agrupar por categoria
    const grouped = {};
    Object.keys(settings).forEach(cat => {
        const catSettings = settings[cat];
        Object.keys(catSettings).forEach(key => {
            const prefix = key.split('_')[0];
            if (!grouped[prefix]) grouped[prefix] = {};
            grouped[prefix][key] = catSettings[key];
        });
    });
    
    return Object.keys(categoryNames).map(category => {
        const catSettings = grouped[category] || {};
        const catInfo = categoryNames[category];
        const keys = Object.keys(catSettings);
        
        if (keys.length === 0) return '';
        
        return `
            <div class="bg-white rounded-lg shadow p-6">
                <h4 class="font-semibold text-gray-800 mb-4">
                    <i class="fas fa-${catInfo.icon} text-${catInfo.color}-600 mr-2"></i>${catInfo.name}
                </h4>
                <div class="space-y-3">
                    ${keys.map(key => generateSettingField(category, key, catSettings[key])).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function generateSettingField(category, key, setting) {
    const id = `setting_${category}_${key}`;
    let value = setting.value;
    const description = setting.description || key;
    
    if (key === 'logo_url') return ''; // Logo é tratado separadamente
    
    // Parse JSON values
    try {
        value = JSON.parse(value);
    } catch (e) {
        // Keep as string if not JSON
    }
    
    // Detectar tipo automaticamente se não especificado
    const valueType = setting.value_type || (typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string');
    
    if (valueType === 'boolean' || value === true || value === false || value === 'true' || value === 'false') {
        const isChecked = value === true || value === 'true';
        return `
            <div class="flex items-center justify-between py-2">
                <div class="flex-1">
                    <label class="text-sm font-medium text-gray-700">${description}</label>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''} class="sr-only peer" data-key="${key}">
                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        `;
    } else if (valueType === 'number' || !isNaN(Number(value))) {
        return `
            <div class="py-1">
                <label class="text-sm font-medium text-gray-700 block mb-1">${description}</label>
                <input type="number" id="${id}" value="${value}" data-key="${key}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            </div>
        `;
    } else {
        return `
            <div class="py-1">
                <label class="text-sm font-medium text-gray-700 block mb-1">${description}</label>
                <input type="text" id="${id}" value="${value || ''}" data-key="${key}" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
            </div>
        `;
    }
}

async function loadCurrentLogo() {
    try {
        const { data } = await api.get('/settings/logo');
        if (data.logo_url) {
            document.getElementById('logoPreview').innerHTML = `
                <img src="${data.logo_url}" alt="Logo" class="max-w-full max-h-full object-contain">
            `;
        }
    } catch (error) {
        console.log('No logo found');
    }
}

async function handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
        alert('Arquivo muito grande! Máximo 2MB');
        return;
    }
    
    const formData = new FormData();
    formData.append('logo', file);
    
    try {
        await api.post('/settings/logo/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Logo atualizado com sucesso!');
        loadCurrentLogo();
    } catch (error) {
        alert('Erro ao fazer upload do logo: ' + (error.response?.data?.error || error.message));
    }
}

async function saveAllSettings() {
    const updates = [];
    const inputs = document.querySelectorAll('[data-key]');
    
    inputs.forEach(input => {
        const key = input.dataset.key;
        let value;
        
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = parseFloat(input.value) || 0;
        } else {
            value = input.value;
        }
        
        updates.push({ key, value });
    });
    
    if (updates.length === 0) {
        alert('Nenhuma configuração para salvar');
        return;
    }
    
    try {
        const { data } = await api.post('/settings/bulk', { settings: updates });
        alert(data.message || 'Configurações salvas com sucesso!');
        
        // Recarregar para mostrar valores atualizados
        loadView('settings');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Erro ao salvar configurações: ' + (error.response?.data?.error || error.message));
    }
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

// Estado de paginação
const paginationState = {
    editions: { page: 1, perPage: 20, total: 0 },
    matters: { page: 1, perPage: 20, total: 0 }
};

async function loadEditions(container, page = 1) {
    try {
        paginationState.editions.page = page;
        const { data } = await api.get('/editions');
        
        // Aplicar paginação no frontend
        const startIndex = (page - 1) * paginationState.editions.perPage;
        const endIndex = startIndex + paginationState.editions.perPage;
        const paginatedEditions = data.editions.slice(startIndex, endIndex);
        paginationState.editions.total = data.editions.length;
        
        container.innerHTML = `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-book mr-2"></i>Edições do Diário Oficial
                    </h2>
                    <div class="flex space-x-2">
                        <button onclick="exportEditionsCSV()" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition" title="Exportar para CSV">
                            <i class="fas fa-file-csv mr-2"></i>CSV
                        </button>
                        <button onclick="exportEditionsXLS()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition" title="Exportar para Excel">
                            <i class="fas fa-file-excel mr-2"></i>XLS
                        </button>
                        ${state.user.role === 'admin' || state.user.role === 'semad' ? `
                            <button onclick="showNewEditionModal()" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg transition">
                                <i class="fas fa-plus mr-2"></i>Nova Edição
                            </button>
                        ` : ''}
                    </div>
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
                        ${renderEditionsTable(paginatedEditions)}
                    </div>
                    
                    ${renderPagination('editions', paginationState.editions)}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading editions:', error);
        container.innerHTML = `<p class="text-red-600">Erro ao carregar edições: ${error.message}</p>`;
    }
}

function renderPagination(type, state) {
    const totalPages = Math.ceil(state.total / state.perPage);
    
    if (totalPages <= 1) return '';
    
    const currentPage = state.page;
    const showPages = 5; // Mostrar 5 botões de página
    
    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);
    
    if (endPage - startPage < showPages - 1) {
        startPage = Math.max(1, endPage - showPages + 1);
    }
    
    let buttons = '';
    
    // Botão Anterior
    if (currentPage > 1) {
        buttons += `
            <button onclick="loadEditions(document.getElementById('mainContent'), ${currentPage - 1})" 
                class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                <i class="fas fa-chevron-left mr-2"></i>Anterior
            </button>
        `;
    }
    
    // Primeira página
    if (startPage > 1) {
        buttons += `
            <button onclick="loadEditions(document.getElementById('mainContent'), 1)" 
                class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                1
            </button>
        `;
        if (startPage > 2) {
            buttons += `<span class="px-2">...</span>`;
        }
    }
    
    // Páginas do meio
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        buttons += `
            <button onclick="loadEditions(document.getElementById('mainContent'), ${i})" 
                class="px-4 py-2 ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'} border border-gray-300 rounded-lg hover:bg-blue-700 hover:text-white transition">
                ${i}
            </button>
        `;
    }
    
    // Última página
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            buttons += `<span class="px-2">...</span>`;
        }
        buttons += `
            <button onclick="loadEditions(document.getElementById('mainContent'), ${totalPages})" 
                class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                ${totalPages}
            </button>
        `;
    }
    
    // Botão Próximo
    if (currentPage < totalPages) {
        buttons += `
            <button onclick="loadEditions(document.getElementById('mainContent'), ${currentPage + 1})" 
                class="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                Próximo<i class="fas fa-chevron-right ml-2"></i>
            </button>
        `;
    }
    
    return `
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <div class="text-sm text-gray-600">
                Mostrando ${((currentPage - 1) * state.perPage) + 1} a ${Math.min(currentPage * state.perPage, state.total)} de ${state.total} edições
            </div>
            <div class="flex space-x-2">
                ${buttons}
            </div>
        </div>
    `;
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
                            <div class="flex items-center gap-2">
                                <span class="font-semibold text-gray-900">${edition.edition_number}</span>
                                ${edition.is_supplemental ? '<span class="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full font-medium">SUPLEMENTAR</span>' : ''}
                            </div>
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
                                <button onclick="previewEditionPDF(${edition.id})" class="text-teal-600 hover:text-teal-900" title="Pré-visualizar">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button onclick="publishEdition(${edition.id})" class="text-purple-600 hover:text-purple-900" title="Publicar">
                                    <i class="fas fa-rocket"></i>
                                </button>
                                <button onclick="deleteEdition(${edition.id})" class="text-red-600 hover:text-red-900" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                            ${edition.status === 'published' ? `
                                <button onclick="downloadEditionPDF(${edition.id}, '${edition.edition_number}', ${edition.year})" class="text-indigo-600 hover:text-indigo-900" title="Download PDF">
                                    <i class="fas fa-download"></i>
                                </button>
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
    const modal = document.createElement('div');
    modal.id = 'newEditionModal';
    modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-2xl p-8 max-w-lg w-full mx-4">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-bold text-gray-800">
                    <i class="fas fa-plus-circle text-blue-600 mr-2"></i>
                    Nova Edição
                </h3>
                <button onclick="closeNewEditionModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="newEditionForm" class="space-y-6">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p class="text-sm text-blue-800">
                        <i class="fas fa-info-circle mr-2"></i>
                        <strong>Data e Número Automáticos!</strong><br>
                        Se você deixar os campos vazios, o sistema irá:
                        <ul class="mt-2 ml-6 list-disc">
                            <li>Usar a data de hoje</li>
                            <li>Gerar o próximo número sequencial do ano</li>
                        </ul>
                    </p>
                </div>
                
                <div>
                    <label class="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" id="isSupplemental" class="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500">
                        <div>
                            <span class="text-sm font-medium text-gray-700">Edição Suplementar</span>
                            <p class="text-xs text-gray-500">Edições extras fora da numeração normal (001-A/2025, 002-A/2025, etc.)</p>
                        </div>
                    </label>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Número da Edição <span class="text-gray-400">(opcional)</span>
                    </label>
                    <input 
                        type="text" 
                        id="editionNumber" 
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: 001/2025 ou deixe vazio para auto"
                    >
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">
                        Data da Edição <span class="text-gray-400">(opcional)</span>
                    </label>
                    <input 
                        type="date" 
                        id="editionDate" 
                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Deixe vazio para usar hoje"
                    >
                </div>
                
                <div class="flex space-x-3 pt-4">
                    <button 
                        type="submit"
                        class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
                    >
                        <i class="fas fa-check mr-2"></i>Criar Edição
                    </button>
                    <button 
                        type="button"
                        onclick="closeNewEditionModal()"
                        class="px-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 rounded-lg transition"
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('newEditionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const editionNumber = document.getElementById('editionNumber').value.trim() || null;
        const editionDate = document.getElementById('editionDate').value || null;
        const isSupplemental = document.getElementById('isSupplemental').checked;
        
        // Extrair ano da data se fornecida, senão usar ano atual
        const year = editionDate ? new Date(editionDate).getFullYear() : new Date().getFullYear();
        
        try {
            const { data } = await api.post('/editions', { 
                edition_number: editionNumber, 
                edition_date: editionDate,
                year,
                is_supplemental: isSupplemental
            });
            
            alert(`${data.message}\n\nEdição: ${data.edition.edition_number}\nData: ${data.edition.edition_date}`);
            closeNewEditionModal();
            loadView('editions');
        } catch (error) {
            alert(error.response?.data?.error || 'Erro ao criar edição');
        }
    });
}

function closeNewEditionModal() {
    document.getElementById('newEditionModal')?.remove();
}

async function editEdition(id) {
    try {
        const { data } = await api.get(`/editions/${id}`);
        const edition = data; // API retorna diretamente
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="editEditionModal">
                <div class="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-bold text-gray-800">
                            <i class="fas fa-edit text-blue-600 mr-2"></i>
                            Editar Edição
                        </h3>
                        <button onclick="closeEditEditionModal()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <form id="editEditionForm" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Número da Edição *
                            </label>
                            <input 
                                type="text" 
                                id="editEditionNumber" 
                                value="${edition.edition_number}"
                                required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Data da Edição *
                            </label>
                            <input 
                                type="date" 
                                id="editEditionDate" 
                                value="${edition.edition_date}"
                                required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">
                                Ano *
                            </label>
                            <input 
                                type="number" 
                                id="editEditionYear" 
                                value="${edition.year}"
                                required
                                class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                        </div>
                        
                        <div class="flex space-x-2 pt-4">
                            <button 
                                type="submit"
                                class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
                            >
                                <i class="fas fa-save mr-2"></i>Salvar
                            </button>
                            <button 
                                type="button"
                                onclick="closeEditEditionModal()"
                                class="px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-2 rounded-lg transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('editEditionForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updatedData = {
                edition_number: document.getElementById('editEditionNumber').value.trim(),
                edition_date: document.getElementById('editEditionDate').value,
                year: parseInt(document.getElementById('editEditionYear').value)
            };
            
            try {
                const response = await api.put(`/editions/${id}`, updatedData);
                console.log('✅ Resposta da atualização:', response.data);
                alert('Edição atualizada com sucesso!');
                closeEditEditionModal();
                loadView('editions');
            } catch (error) {
                console.error('❌ Erro na atualização:', error);
                alert(error.response?.data?.error || 'Erro ao atualizar edição');
            }
        });
        
    } catch (error) {
        console.error('Error loading edition for edit:', error);
        alert('Erro ao carregar dados da edição');
    }
}

function closeEditEditionModal() {
    document.getElementById('editEditionModal')?.remove();
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
                                <button onclick="autoBuildEdition(${data.id})" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg" title="Montar diário automaticamente com todas as matérias aprovadas">
                                    <i class="fas fa-magic mr-2"></i>Montar Automaticamente
                                </button>
                                <button onclick="addMatterToEdition(${data.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-plus mr-2"></i>Adicionar Matéria
                                </button>
                                <button onclick="previewEditionPDF(${data.id})" class="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-eye mr-2"></i>Pré-visualizar
                                </button>
                                <button onclick="publishEdition(${data.id})" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-rocket mr-2"></i>Publicar Edição
                                </button>
                            </div>
                        ` : ''}
                        
                        ${data.status === 'published' ? `
                            <div class="space-x-2">
                                <button onclick="downloadEditionPDF(${data.id}, '${data.edition_number}', ${data.year})" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-file-pdf mr-2"></i>Download PDF/HTML
                                </button>
                                <button onclick="loadView('verification')" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg">
                                    <i class="fas fa-shield-alt mr-2"></i>Verificar Autenticidade
                                </button>
                            </div>
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
        
        // Criar modal com CHECKBOXES para seleção múltipla
        const matterCheckboxes = data.matters.map(m => `
            <div class="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                <label class="flex items-start cursor-pointer">
                    <input type="checkbox" value="${m.id}" class="matter-checkbox mt-1 mr-3 w-4 h-4">
                    <div class="flex-1">
                        <div class="font-semibold text-gray-800">${m.title}</div>
                        <div class="text-sm text-gray-600">${m.secretaria_acronym} - ${m.matter_type_name || 'N/A'}</div>
                    </div>
                </label>
            </div>
        `).join('');
        
        const modal = document.createElement('div');
        modal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="addMatterModal">
                <div class="bg-white rounded-lg shadow-xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
                    <h3 class="text-xl font-bold text-gray-800 mb-4">
                        <i class="fas fa-plus-circle text-blue-600 mr-2"></i>
                        Adicionar Matérias à Edição
                    </h3>
                    
                    <div class="mb-4">
                        <button onclick="toggleAllMatters(true)" class="text-sm text-blue-600 hover:text-blue-800 mr-3">
                            <i class="fas fa-check-square mr-1"></i>Selecionar Todas
                        </button>
                        <button onclick="toggleAllMatters(false)" class="text-sm text-gray-600 hover:text-gray-800">
                            <i class="fas fa-square mr-1"></i>Desmarcar Todas
                        </button>
                        <span id="selectedCount" class="ml-4 text-sm font-semibold text-gray-700">0 selecionadas</span>
                    </div>
                    
                    <div class="flex-1 overflow-y-auto space-y-2 mb-4" style="max-height: 400px;">
                        ${matterCheckboxes}
                    </div>
                    
                    <div class="flex justify-end space-x-2 pt-4 border-t">
                        <button onclick="closeAddMatterModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">
                            <i class="fas fa-times mr-2"></i>Cancelar
                        </button>
                        <button onclick="confirmAddMatters(${editionId})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
                            <i class="fas fa-plus mr-2"></i>Adicionar Selecionadas
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Adicionar event listeners para contar selecionados
        document.querySelectorAll('.matter-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedCount);
        });
        
        updateSelectedCount();
        
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao carregar matérias');
    }
}

function toggleAllMatters(select) {
    document.querySelectorAll('.matter-checkbox').forEach(checkbox => {
        checkbox.checked = select;
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const selected = document.querySelectorAll('.matter-checkbox:checked').length;
    const counter = document.getElementById('selectedCount');
    if (counter) {
        counter.textContent = `${selected} selecionada${selected !== 1 ? 's' : ''}`;
        counter.className = selected > 0 
            ? 'ml-4 text-sm font-semibold text-blue-600' 
            : 'ml-4 text-sm font-semibold text-gray-700';
    }
}

function closeAddMatterModal() {
    document.getElementById('addMatterModal')?.remove();
}

async function confirmAddMatters(editionId) {
    const selectedCheckboxes = document.querySelectorAll('.matter-checkbox:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('Selecione pelo menos uma matéria');
        return;
    }
    
    const matterIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
    
    try {
        const { data } = await api.post(`/editions/${editionId}/add-matters`, { matter_ids: matterIds });
        
        let message = `${data.results.added.length} matéria(s) adicionada(s) com sucesso!`;
        if (data.results.skipped.length > 0) {
            message += `\n\n${data.results.skipped.length} matéria(s) ignorada(s):\n`;
            data.results.skipped.forEach(s => {
                message += `• ID ${s.id}: ${s.reason}\n`;
            });
        }
        
        alert(message);
        closeAddMatterModal();
        viewEdition(editionId);
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao adicionar matérias');
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

async function autoBuildEdition(id) {
    if (!confirm('Montar Diário Automaticamente?\n\nEsta ação irá:\n• Buscar TODAS as matérias aprovadas\n• Organizar por SECRETARIA (alfabética)\n• Organizar por TIPO dentro de cada secretaria\n• Adicionar automaticamente à edição\n\nMatérias já adicionadas serão REMOVIDAS primeiro.\n\nDeseja continuar?')) {
        return;
    }
    
    try {
        const { data } = await api.post(`/editions/${id}/auto-build`);
        alert(`✅ Diário montado automaticamente!\n\n${data.matters_added} matérias adicionadas\n\nOrganização:\n${data.matters.map((m, i) => `${i+1}. [${m.secretaria}] ${m.type}: ${m.title.substring(0, 40)}...`).join('\n')}`);
        loadView('editionDetail', id);
    } catch (error) {
        alert(error.response?.data?.error || 'Erro ao montar diário automaticamente');
    }
}

async function publishEdition(id) {
    if (!confirm('Tem certeza que deseja PUBLICAR esta edição?\n\nApós a publicação, não será possível adicionar ou remover matérias.\n\nEsta ação irá:\n• Gerar o PDF da edição\n• Publicar todas as matérias\n• Disponibilizar no portal público')) {
        return;
    }
    
    try {
        const { data } = await api.post(`/editions/${id}/publish`);
        
        // 📥 BAIXAR PDF AUTOMATICAMENTE após publicar
        const downloadSuccess = await downloadEditionPDF(id, data.edition_number, data.year);
        
        // Mensagem de sucesso (ajustada conforme download)
        if (downloadSuccess) {
            alert(`✅ Edição publicada com sucesso!\n\n📊 PDF gerado: ${data.total_pages} página(s)\n🔐 Hash: ${data.pdf_hash.substring(0, 16)}...\n\n📥 O arquivo foi baixado automaticamente!`);
        } else {
            alert(`✅ Edição publicada com sucesso!\n\n📊 PDF gerado: ${data.total_pages} página(s)\n🔐 Hash: ${data.pdf_hash.substring(0, 16)}...\n\n⚠️ Houve um problema ao baixar automaticamente.\n\nVocê pode baixar manualmente clicando no botão de download na lista de edições.`);
        }
        
        // Force reload of editions view
        await loadView('editions');
    } catch (error) {
        console.error('Erro ao publicar edição:', error);
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
// VERIFICAÇÃO DE AUTENTICIDADE
// ====================================

async function loadVerificationInterface(container) {
    container.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <div class="mb-6">
                <h2 class="text-3xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-shield-alt text-purple-600 mr-3"></i>
                    Verificação de Autenticidade
                </h2>
                <p class="text-gray-600">Verifique a autenticidade e integridade de edições e assinaturas eletrônicas do Diário Oficial</p>
            </div>
            
            <!-- Verificar Edição -->
            <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-book text-blue-600 mr-2"></i>
                    Verificar Edição do Diário
                </h3>
                <p class="text-sm text-gray-600 mb-4">Informe o número e ano da edição, junto com o hash de validação para verificar a autenticidade.</p>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input type="text" id="verifyEditionNumber" placeholder="Ex: 001/2025" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <input type="number" id="verifyEditionYear" placeholder="Ano (Ex: 2025)" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500">
                    <input type="text" id="verifyEditionHash" placeholder="Hash de validação" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 md:col-span-3">
                </div>
                
                <button onclick="verifyEdition()" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg transition">
                    <i class="fas fa-check-circle mr-2"></i>Verificar Edição
                </button>
                
                <div id="editionVerificationResult" class="mt-4"></div>
            </div>
            
            <!-- Verificar Assinatura de Matéria -->
            <div class="bg-white rounded-lg shadow-lg p-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-signature text-green-600 mr-2"></i>
                    Verificar Assinatura Eletrônica
                </h3>
                <p class="text-sm text-gray-600 mb-4">Informe o ID da matéria e o hash da assinatura para verificar a autenticidade.</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input type="number" id="verifyMatterId" placeholder="ID da Matéria" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                    <input type="text" id="verifySignatureHash" placeholder="Hash da Assinatura" class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500">
                </div>
                
                <button onclick="verifyMatterSignature()" class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition">
                    <i class="fas fa-check-circle mr-2"></i>Verificar Assinatura
                </button>
                
                <div id="signatureVerificationResult" class="mt-4"></div>
            </div>
            
            <!-- Como obter os hashes -->
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
                <h4 class="font-bold text-blue-900 mb-2">
                    <i class="fas fa-info-circle mr-2"></i>Como obter os hashes?
                </h4>
                <ul class="text-sm text-blue-800 space-y-1">
                    <li><strong>Hash da Edição:</strong> Encontrado no rodapé do PDF publicado do Diário Oficial</li>
                    <li><strong>Hash da Assinatura:</strong> Presente no cabeçalho de cada matéria publicada</li>
                    <li><strong>ID da Matéria:</strong> Número de identificação único da matéria no sistema</li>
                </ul>
            </div>
        </div>
    `;
}

async function verifyEdition() {
    const editionNumber = document.getElementById('verifyEditionNumber').value.trim();
    const year = document.getElementById('verifyEditionYear').value;
    const hash = document.getElementById('verifyEditionHash').value.trim();
    const resultDiv = document.getElementById('editionVerificationResult');
    
    if (!editionNumber || !year || !hash) {
        resultDiv.innerHTML = `
            <div class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                Preencha todos os campos
            </div>
        `;
        return;
    }
    
    resultDiv.innerHTML = `
        <div class="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-3 rounded-lg">
            <i class="fas fa-spinner fa-spin mr-2"></i>Verificando...
        </div>
    `;
    
    try {
        const { data } = await api.post('/verification/edition', {
            edition_number: editionNumber,
            year: parseInt(year),
            hash: hash
        });
        
        if (data.valid) {
            resultDiv.innerHTML = `
                <div class="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-check-circle text-2xl mr-3"></i>
                        <div>
                            <p class="font-bold text-lg">${data.message}</p>
                            <p class="text-sm">Edição ${data.edition.edition_number} - ${data.edition.year}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-sm mt-3 pt-3 border-t border-green-200">
                        <div>
                            <p class="font-semibold">Data de Publicação:</p>
                            <p>${new Date(data.edition.published_at).toLocaleString('pt-BR')}</p>
                        </div>
                        <div>
                            <p class="font-semibold">Total de Matérias:</p>
                            <p>${data.edition.matter_count}</p>
                        </div>
                        <div>
                            <p class="font-semibold">Total de Páginas:</p>
                            <p>${data.edition.total_pages}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                    <div class="flex items-center">
                        <i class="fas fa-times-circle text-2xl mr-3"></i>
                        <div>
                            <p class="font-bold text-lg">${data.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                ${error.response?.data?.error || 'Erro ao verificar edição'}
            </div>
        `;
    }
}

async function verifyMatterSignature() {
    const matterId = document.getElementById('verifyMatterId').value;
    const signatureHash = document.getElementById('verifySignatureHash').value.trim();
    const resultDiv = document.getElementById('signatureVerificationResult');
    
    if (!matterId || !signatureHash) {
        resultDiv.innerHTML = `
            <div class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                Preencha todos os campos
            </div>
        `;
        return;
    }
    
    resultDiv.innerHTML = `
        <div class="bg-gray-100 border border-gray-300 text-gray-800 px-4 py-3 rounded-lg">
            <i class="fas fa-spinner fa-spin mr-2"></i>Verificando...
        </div>
    `;
    
    try {
        const { data } = await api.post('/verification/matter-signature', {
            matter_id: parseInt(matterId),
            signature_hash: signatureHash
        });
        
        if (data.valid) {
            resultDiv.innerHTML = `
                <div class="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg">
                    <div class="flex items-center mb-3">
                        <i class="fas fa-check-circle text-2xl mr-3"></i>
                        <div>
                            <p class="font-bold text-lg">${data.message}</p>
                            <p class="text-sm">${data.matter.title}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-sm mt-3 pt-3 border-t border-green-200">
                        <div>
                            <p class="font-semibold">Tipo:</p>
                            <p>${data.matter.matter_type}</p>
                        </div>
                        <div>
                            <p class="font-semibold">Secretaria:</p>
                            <p>${data.matter.secretaria}</p>
                        </div>
                        <div>
                            <p class="font-semibold">Assinado por:</p>
                            <p>${data.matter.signed_by}</p>
                        </div>
                        <div>
                            <p class="font-semibold">Data:</p>
                            <p>${new Date(data.matter.signed_at).toLocaleString('pt-BR')}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                    <div class="flex items-center">
                        <i class="fas fa-times-circle text-2xl mr-3"></i>
                        <div>
                            <p class="font-bold text-lg">${data.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="bg-red-100 border border-red-300 text-red-800 px-4 py-3 rounded-lg">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                ${error.response?.data?.error || 'Erro ao verificar assinatura'}
            </div>
        `;
    }
}

// ====================================
// DOWNLOAD E EXPORTAÇÃO
// ====================================

/**
 * Pré-visualização de edição - CORRIGIDA
 * Usa a rota correta baseada no status da edição
 */
async function previewEditionPDF(editionId) {
    try {
        console.log(`👁️ Abrindo pré-visualização da edição ${editionId}`);
        
        // PRIMEIRO: Buscar dados da edição para saber o status
        const token = localStorage.getItem('dom_token');
        
        const response = await fetch(`/api/editions/${editionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao buscar edição: ${response.status}`);
        }
        
        const edition = await response.json();
        console.log('📦 Dados da edição:', edition);
        
        // DECISÃO: Qual URL usar baseado no status
        let url;
        
        if (edition.status === 'published') {
            // Edição publicada: usa rota pública
            url = `/api/editions/${editionId}/preview`;
            console.log('🌐 Edição PUBLICADA - usando rota pública:', url);
        } else {
            // Edição em rascunho: usa rota autenticada
            url = `/api/editions/${editionId}/preview/draft`;
            console.log('🔒 Edição RASCUNHO - usando rota autenticada:', url);
        }
        
        // Abrir em nova aba
        const newWindow = window.open(url, '_blank');
        
        if (!newWindow) {
            alert('⚠️ Por favor, permita pop-ups para visualizar a edição.\n\nOu clique com botão direito no botão de pré-visualização e escolha "Abrir em nova aba".');
        }
        
    } catch (error) {
        console.error('❌ Erro na pré-visualização:', error);
        alert('❌ Erro ao abrir pré-visualização:\n\n' + error.message);
    }
}


/**
 * Download do PDF/HTML da edição - CORRIGIDA
 * Usa a rota correta baseada no status
 */
async function downloadEditionPDF(editionId, editionNumber = null, year = null) {
    try {
        // Buscar dados da edição se não fornecidos
        if (!editionNumber || !year) {
            console.log(`🔍 Buscando dados da edição ${editionId}...`);
            
            const token = localStorage.getItem('dom_token');
            const response = await fetch(`/api/editions/${editionId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro ao buscar edição: ${response.status}`);
            }
            
            const edition = await response.json();
            
            if (!edition || !edition.edition_number) {
                console.error('❌ Dados inválidos da edição:', edition);
                throw new Error('Dados da edição inválidos');
            }
            
            editionNumber = edition.edition_number;
            year = edition.year;
            
            console.log(`✅ Dados obtidos: ${editionNumber}/${year}`);
        }
        
        console.log(`📥 Iniciando download da edição ${editionNumber}/${year}`);
        
        // DECISÃO: Qual URL usar baseado no status
        // Para download, sempre usamos a rota pública /pdf
        // (que só funciona para edições publicadas)
        const url = `/api/editions/${editionId}/pdf`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            
            // Mensagem mais amigável para edições não publicadas
            if (response.status === 404) {
                throw new Error('Esta edição ainda não foi publicada. O download só está disponível após a publicação.');
            }
            
            const errorMsg = errorData?.error || `Erro HTTP ${response.status}`;
            throw new Error(errorMsg);
        }
        
        // Detectar tipo de conteúdo
        const contentType = response.headers.get('content-type');
        const contentDisposition = response.headers.get('content-disposition');
        const isPDF = contentType && contentType.includes('pdf');
        const isHTML = contentType && contentType.includes('html');
        const extension = isPDF ? 'pdf' : 'html';
        
        console.log(`📄 Tipo de arquivo: ${extension.toUpperCase()}`);
        console.log(`📎 Content-Type: ${contentType}`);
        
        // Obter o nome do arquivo do Content-Disposition ou gerar um
        let filename = `diario-oficial-${editionNumber.replace(/\//g, '-')}-${year}.${extension}`;
        
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) {
                filename = match[1];
            }
        }
        
        console.log(`💾 Nome do arquivo: ${filename}`);
        
        const blob = await response.blob();
        console.log(`💾 Tamanho do arquivo: ${(blob.size / 1024).toFixed(2)} KB`);
        
        // Verificar se o blob não está vazio
        if (blob.size === 0) {
            throw new Error('Arquivo vazio recebido do servidor');
        }
        
        const urlBlob = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlBlob;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Limpar URL após um tempo
        setTimeout(() => {
            window.URL.revokeObjectURL(urlBlob);
            console.log('✅ URL liberada da memória');
        }, 100);
        
        console.log('✅ Download iniciado com sucesso!');
        
        // Informar ao usuário sobre HTML (se aplicável)
        if (!isPDF) {
            setTimeout(() => {
                alert('📄 Arquivo HTML baixado com sucesso!\n\nPara converter em PDF:\n1. Abra o arquivo no navegador\n2. Use Ctrl+P ou Cmd+P\n3. Escolha "Salvar como PDF"');
            }, 1000);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro no download:', error);
        console.error('❌ Stack:', error.stack);
        
        alert(`❌ ${error.message}`);
        return false;
    }
}

async function exportMattersCSV() {
    try {
        const response = await fetch('/api/export/matters/csv', {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao exportar CSV');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `materias_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        alert('Erro ao exportar CSV: ' + error.message);
    }
}

async function exportMattersXLS() {
    try {
        const response = await fetch('/api/export/matters/xls', {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao exportar XLS');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `materias_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        alert('Erro ao exportar XLS: ' + error.message);
    }
}

async function exportEditionsCSV() {
    try {
        const response = await fetch('/api/export/editions/csv', {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao exportar CSV');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edicoes_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        alert('Erro ao exportar CSV: ' + error.message);
    }
}

async function exportEditionsXLS() {
    try {
        const response = await fetch('/api/export/editions/xls', {
            headers: {
                'Authorization': `Bearer ${state.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Erro ao exportar XLS');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edicoes_${new Date().toISOString().split('T')[0]}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        alert('Erro ao exportar XLS: ' + error.message);
    }
}

// ====================================
// 🚨 FUNÇÕES CORRETIVAS PARA MENU SECRETARIA
// ====================================

// Função para verificar e forçar visibilidade do menu
function forceMenuVisibilityCheck() {
    console.log('🔍 Verificando visibilidade dos menus...');
    
    const secretariaMenu = document.getElementById('secretariaMenu');
    const semadMenu = document.getElementById('semadMenu');
    const adminMenu = document.getElementById('adminMenu');
    const userRoleElement = document.getElementById('userRole');
    
    if (!userRoleElement) {
        console.log('❌ Elemento userRole não encontrado');
        return;
    }
    
    const userRoleText = userRoleElement.textContent.toLowerCase();
    
    // 🚨 CORREÇÃO ESPECÍFICA PARA SECRETARIA
    if (userRoleText.includes('secretaria') && secretariaMenu) {
        console.log('🚨 CORREÇÃO APLICADA: Mostrando menu Secretaria');
        secretariaMenu.classList.remove('hidden');
    }
    
    // Verificar outros menus também
    if (userRoleText.includes('semad') && semadMenu) {
        semadMenu.classList.remove('hidden');
    }
    
    if (userRoleText.includes('admin') && adminMenu) {
        adminMenu.classList.remove('hidden');
    }
    
    // Debug: verificar estado atual
    console.log('📊 Estado após correção:');
    console.log('- secretariaMenu hidden?', secretariaMenu?.classList.contains('hidden'));
    console.log('- semadMenu hidden?', semadMenu?.classList.contains('hidden'));
    console.log('- adminMenu hidden?', adminMenu?.classList.contains('hidden'));
}

// PATCH: Monitorar DOM e corrigir menu periodicamente
function startMenuMonitor() {
    console.log('🚀 Iniciando monitor de menu...');
    
    // Executar verificação inicial após 1 segundo
    setTimeout(forceMenuVisibilityCheck, 1000);
    
    // Executar periodicamente a cada 3 segundos (apenas durante 30 segundos)
    let attempts = 0;
    const maxAttempts = 10;
    
    const intervalId = setInterval(() => {
        attempts++;
        console.log(`🔄 Verificação de menu #${attempts}`);
        forceMenuVisibilityCheck();
        
        if (attempts >= maxAttempts) {
            console.log('✅ Monitor de menu concluído');
            clearInterval(intervalId);
        }
    }, 3000);
    
    // Armazenar interval ID para limpeza no logout
    window.menuMonitorInterval = intervalId;
}

// Atualizar função logout para limpar interval
const originalLogoutFunction = window.logout;
window.logout = function() {
    // Limpar interval do monitor
    if (window.menuMonitorInterval) {
        clearInterval(window.menuMonitorInterval);
        window.menuMonitorInterval = null;
    }
    
    // Chamar função original
    originalLogoutFunction();
};

// ====================================
// INITIALIZE APP - ATUALIZADO
// ====================================

if (state.token) {
    console.log('🎬 Inicializando app com token existente');
    showDashboard().then(() => {
        // Iniciar monitor após carregar dashboard
        setTimeout(startMenuMonitor, 1500);
    });
} else {
    console.log('🔒 Nenhum token encontrado, mostrando login');
    showLogin();
}

// Configurar listeners de navegação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM completamente carregado');
    
    // Configurar navegação
    setupNavigationListeners();
    
    // Se já estivermos na dashboard, verificar menus imediatamente
    const dashboardScreen = document.getElementById('dashboardScreen');
    if (dashboardScreen && !dashboardScreen.classList.contains('hidden')) {
        console.log('🏠 Dashboard já visível - verificando menus');
        forceMenuVisibilityCheck();
        startMenuMonitor();
    }
});

// ====================================
// FUNÇÕES GLOBAIS EXPORTADAS (para uso no HTML)
// ====================================

// Exportar funções necessárias para uso em atributos onclick no HTML
window.loadView = loadView;
window.viewMatterDetails = viewMatterDetails;
window.editMatter = editMatter;
window.deleteMatter = deleteMatter;
window.submitMatterForReview = submitMatterForReview;
window.cancelSubmission = cancelSubmission;
window.reviewMatter = reviewMatter;
window.approveMatter = approveMatter;
window.rejectMatter = rejectMatter;
window.viewPublicMatter = viewPublicMatter;
window.verifyEdition = verifyEdition;
window.verifyMatterSignature = verifyMatterSignature;
window.exportMattersCSV = exportMattersCSV;
window.exportMattersXLS = exportMattersXLS;
window.exportEditionsCSV = exportEditionsCSV;
window.exportEditionsXLS = exportEditionsXLS;
window.filterMattersList = filterMattersList;
window.clearMattersFilters = clearMattersFilters;
window.filterSemadList = filterSemadList;
window.clearSemadFilters = clearSemadFilters;
window.forceMenuVisibilityCheck = forceMenuVisibilityCheck;
window.viewAttachment = viewAttachment;