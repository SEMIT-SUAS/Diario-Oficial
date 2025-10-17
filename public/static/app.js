// ====================================
// DOM - Frontend Application Logic - COMPLETO
// ====================================

// Global state
const state = {
    token: localStorage.getItem('dom_token'),
    user: null,
    currentView: 'dashboard',
    currentMatter: null
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
    
    container.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-gray-800">
                <i class="fas fa-file-alt mr-2"></i>Minhas Matérias
            </h2>
            <button 
                onclick="loadView('newMatter')"
                class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
                <i class="fas fa-plus mr-2"></i>Nova Matéria
            </button>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
            <div class="p-4 border-b border-gray-200">
                <input 
                    type="text" 
                    id="filterMatters"
                    class="px-4 py-2 border border-gray-300 rounded-lg w-full md:w-64"
                    placeholder="Buscar matéria..."
                    onkeyup="filterMattersList()"
                >
            </div>
            
            <div id="mattersList" class="divide-y divide-gray-200">
                ${data.matters.map(matter => `
                    <div class="p-4 hover:bg-gray-50 matter-item" data-title="${matter.title.toLowerCase()}">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h3 class="font-semibold text-gray-800">${matter.title}</h3>
                                <p class="text-sm text-gray-500 mt-1">${matter.matter_type || 'Sem tipo'} - ${matter.category_name || 'Sem categoria'}</p>
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
                `).join('')}
                
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
    const filter = document.getElementById('filterMatters').value.toLowerCase();
    const items = document.querySelectorAll('.matter-item');
    
    items.forEach(item => {
        const title = item.dataset.title;
        if (title.includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
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
                        <p class="text-sm text-gray-500">Criado em</p>
                        <p class="font-medium">${formatDate(matter.created_at)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Versão</p>
                        <p class="font-medium">v${matter.version}</p>
                    </div>
                </div>
                
                <div class="mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-3">Conteúdo</h3>
                    <div class="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap">${matter.content}</div>
                </div>
                
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
    container.innerHTML = `
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
            
            <div class="grid grid-cols-2 gap-4">
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
                <label class="block text-sm font-medium text-gray-700 mb-2">Resumo</label>
                <textarea 
                    id="matterSummary"
                    rows="3"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Resumo opcional da matéria"
                ></textarea>
            </div>
            
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">Conteúdo *</label>
                <textarea 
                    id="matterContent"
                    required
                    rows="15"
                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Digite o conteúdo completo da matéria"
                ></textarea>
            </div>
            
            <div class="flex space-x-4">
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
                    <i class="fas fa-paper-plane mr-2"></i>Salvar e Enviar para Análise
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
        document.getElementById('matterType').value = matter.matter_type;
        document.getElementById('matterLayout').value = matter.layout_columns;
        document.getElementById('matterSummary').value = matter.summary || '';
        document.getElementById('matterContent').value = matter.content;
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
    const matter_type = document.getElementById('matterType').value;
    const layout_columns = parseInt(document.getElementById('matterLayout').value);
    
    if (!title || !content || !matter_type) {
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
                matter_type,
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
                matter_type,
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
    if (!confirm('Tem certeza que deseja excluir esta matéria?')) {
        return;
    }
    
    try {
        // TODO: Implementar rota DELETE no backend
        alert('Funcionalidade de exclusão será implementada no backend');
        loadView('myMatters');
    } catch (error) {
        alert('Erro ao excluir matéria: ' + error.message);
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
    if (!confirm('Deseja cancelar o envio e voltar esta matéria para rascunho?')) {
        return;
    }
    
    try {
        // TODO: Implementar rota no backend
        alert('Funcionalidade de cancelamento será implementada no backend');
        loadView('myMatters');
    } catch (error) {
        alert('Erro ao cancelar envio: ' + error.message);
    }
}

// ====================================
// PENDING REVIEW (SEMAD)
// ====================================

async function loadPendingReview(container) {
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

function loadPublicSearch(container) {
    container.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 mb-6">
            <i class="fas fa-search mr-2"></i>Pesquisa de Publicações
        </h2>
        
        <div class="bg-white rounded-lg shadow p-6">
            <p class="text-gray-600">
                <i class="fas fa-info-circle mr-2"></i>
                Módulo de pesquisa pública em desenvolvimento
            </p>
        </div>
    `;
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
// INITIALIZE APP
// ====================================

if (state.token) {
    showDashboard();
} else {
    showLogin();
}
