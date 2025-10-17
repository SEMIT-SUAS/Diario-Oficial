// ====================================
// DOM - Diário Oficial Municipal
// Main Application Entry Point
// ====================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { HonoContext } from './types';

// Import routes
import auth from './routes/auth';
import matters from './routes/matters';
import semad from './routes/semad';
import matterTypes from './routes/matter-types';

const app = new Hono<HonoContext>();

// Enable CORS for API routes
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// API Routes
app.route('/api/auth', auth);
app.route('/api/matters', matters);
app.route('/api/semad', semad);
app.route('/api/matter-types', matterTypes);

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'DOM - Diário Oficial Municipal'
  });
});

// Main page - Sistema completo com interface
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DOM - Diário Oficial Municipal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        .sidebar {
            transition: transform 0.3s ease-in-out;
        }
        @media (max-width: 768px) {
            .sidebar.hidden {
                transform: translateX(-100%);
            }
        }
    </style>
</head>
<body class="bg-gray-50">
    <div id="app">
        <!-- Login Screen -->
        <div id="loginScreen" class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 px-4">
            <div class="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
                <div class="text-center mb-8">
                    <div class="bg-blue-600 w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <i class="fas fa-newspaper text-white text-3xl"></i>
                    </div>
                    <h1 class="text-3xl font-bold text-gray-800">DOM</h1>
                    <p class="text-gray-600 mt-2">Diário Oficial Municipal</p>
                </div>
                
                <form id="loginForm" class="space-y-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-envelope mr-2"></i>Email
                        </label>
                        <input 
                            type="email" 
                            id="loginEmail" 
                            required
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="seu@email.gov.br"
                        >
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">
                            <i class="fas fa-lock mr-2"></i>Senha
                        </label>
                        <input 
                            type="password" 
                            id="loginPassword" 
                            required
                            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="••••••••"
                        >
                    </div>
                    
                    <button 
                        type="submit"
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200"
                    >
                        <i class="fas fa-sign-in-alt mr-2"></i>Entrar
                    </button>
                </form>
                
                <div id="loginError" class="mt-4 text-red-600 text-sm text-center hidden"></div>
                
                <div class="mt-8 text-center text-sm text-gray-600">
                    <p>Credenciais de teste:</p>
                    <p class="mt-1"><strong>Admin:</strong> admin@municipio.gov.br / admin123</p>
                    <p><strong>SEMAD:</strong> coordenador@semad.gov.br / semad123</p>
                    <p><strong>Secretaria:</strong> joao.silva@semed.gov.br / secretaria123</p>
                </div>
            </div>
        </div>
        
        <!-- Main Dashboard (hidden initially) -->
        <div id="dashboardScreen" class="hidden">
            <!-- Top Navigation Bar -->
            <nav class="bg-white shadow-lg border-b border-gray-200">
                <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
                    <div class="flex justify-between h-16">
                        <div class="flex items-center">
                            <button id="toggleSidebar" class="mr-4 text-gray-600 hover:text-gray-800 md:hidden">
                                <i class="fas fa-bars text-xl"></i>
                            </button>
                            <div class="flex items-center">
                                <div class="bg-blue-600 w-10 h-10 rounded-lg flex items-center justify-center">
                                    <i class="fas fa-newspaper text-white"></i>
                                </div>
                                <div class="ml-3">
                                    <h1 class="text-xl font-bold text-gray-800">DOM</h1>
                                    <p class="text-xs text-gray-500">Diário Oficial</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex items-center space-x-4">
                            <button class="text-gray-600 hover:text-gray-800 relative">
                                <i class="fas fa-bell text-xl"></i>
                                <span class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
                            </button>
                            
                            <div class="flex items-center space-x-3">
                                <div class="text-right hidden sm:block">
                                    <p id="userName" class="text-sm font-semibold text-gray-800"></p>
                                    <p id="userRole" class="text-xs text-gray-500"></p>
                                </div>
                                <button id="logoutBtn" class="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition">
                                    <i class="fas fa-sign-out-alt mr-2"></i>Sair
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>
            
            <div class="flex h-screen overflow-hidden">
                <!-- Sidebar -->
                <aside id="sidebar" class="sidebar bg-white w-64 border-r border-gray-200 overflow-y-auto">
                    <nav class="p-4 space-y-2">
                        <a href="#" data-view="dashboard" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                            <i class="fas fa-chart-line w-6"></i>
                            <span class="ml-3">Dashboard</span>
                        </a>
                        
                        <div id="secretariaMenu" class="hidden">
                            <a href="#" data-view="myMatters" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-file-alt w-6"></i>
                                <span class="ml-3">Minhas Matérias</span>
                            </a>
                            <a href="#" data-view="newMatter" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-plus-circle w-6"></i>
                                <span class="ml-3">Nova Matéria</span>
                            </a>
                        </div>
                        
                        <div id="semadMenu" class="hidden">
                            <a href="#" data-view="pendingReview" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-tasks w-6"></i>
                                <span class="ml-3">Pendentes de Análise</span>
                            </a>
                            <a href="#" data-view="approved" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-check-circle w-6"></i>
                                <span class="ml-3">Aprovadas</span>
                            </a>
                        </div>
                        
                        <a href="#" data-view="search" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                            <i class="fas fa-search w-6"></i>
                            <span class="ml-3">Pesquisar</span>
                        </a>
                        
                        <div id="adminMenu" class="hidden">
                            <a href="#" data-view="users" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-users w-6"></i>
                                <span class="ml-3">Usuários</span>
                            </a>
                            <a href="#" data-view="holidays" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-calendar-alt w-6"></i>
                                <span class="ml-3">Feriados</span>
                            </a>
                            <a href="#" data-view="settings" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-cog w-6"></i>
                                <span class="ml-3">Configurações</span>
                            </a>
                        </div>
                    </nav>
                </aside>
                
                <!-- Main Content -->
                <main class="flex-1 overflow-y-auto bg-gray-50 p-6">
                    <div id="mainContent">
                        <div class="text-center py-12">
                            <i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                            <p class="mt-4 text-gray-600">Carregando...</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="/static/app.js"></script>
</body>
</html>
  `);
});

// Public search page (sem autenticação)
app.get('/pesquisa', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pesquisa - DOM</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h1 class="text-3xl font-bold text-gray-800 mb-4">
                <i class="fas fa-search mr-3 text-blue-600"></i>
                Pesquisa de Publicações
            </h1>
            <p class="text-gray-600">Pesquise publicações do Diário Oficial Municipal</p>
        </div>
        
        <div class="bg-white rounded-lg shadow-lg p-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input 
                    type="text" 
                    id="searchQuery"
                    class="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Buscar por título ou conteúdo..."
                >
                
                <input 
                    type="date" 
                    id="searchDate"
                    class="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                
                <button 
                    id="searchBtn"
                    class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
                >
                    <i class="fas fa-search mr-2"></i>Pesquisar
                </button>
            </div>
            
            <div id="searchResults" class="space-y-4">
                <p class="text-gray-500 text-center py-8">Digite algo para pesquisar...</p>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="/static/search.js"></script>
</body>
</html>
  `);
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Rota não encontrada' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Application error:', err);
  return c.json({ error: 'Erro interno do servidor', details: err.message }, 500);
});

export default app;
