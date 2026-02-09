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
import editions from './routes/editions';
import users from './routes/users';
import verification from './routes/verification';
import exportRoutes from './routes/export';
import secretarias from './routes/secretarias';
import settings from './routes/settings';
import holidays from './routes/holidays';
import portal from './routes/portal';

const app = new Hono<HonoContext>();

// Enable CORS for API routes
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public/' }));

// Serve favicon - return empty 204 to avoid 404 error
app.get('/favicon.ico', (c) => {
  // Retornar SVG embutido simples
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#2563eb"/>
    <text x="50" y="70" font-family="Arial" font-size="60" font-weight="bold" fill="white" text-anchor="middle">D</text>
  </svg>`;
  return c.body(svg, 200, { 'Content-Type': 'image/svg+xml' });
});

// API Routes
app.route('/api/auth', auth);
app.route('/api/matters', matters);
app.route('/api/semad', semad);
app.route('/api/matter-types', matterTypes);
app.route('/api/editions', editions);
app.route('/api/users', users);
app.route('/api/verification', verification);
app.route('/api/export', exportRoutes);
app.route('/api/secretarias', secretarias);
app.route('/api/settings', settings);
app.route('/api/holidays', holidays);
app.route('/api/portal', portal);

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'DOM - Diário Oficial Municipal'
  });
});

// Public verification page (no login required) - PÁGINA PÚBLICA
app.get('/verificar', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificar Autenticidade - DOM</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        
        /* WebGL Canvas Background */
        #webgl-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
        }
        
        .verify-container {
            position: relative;
            z-index: 1;
        }
        
        .verify-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .result-valid {
            animation: slideIn 0.5s ease-out;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    </style>
</head>
<body class="bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 min-h-screen">
    <!-- WebGL Canvas -->
    <canvas id="webgl-background"></canvas>
    
    <!-- Navbar -->
    <nav class="verify-container bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg border-b border-white border-opacity-20 py-4">
        <div class="max-w-7xl mx-auto px-4 flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <i class="fas fa-shield-alt text-white text-3xl"></i>
                <div>
                    <h1 class="text-white text-xl font-bold">Verificação de Autenticidade</h1>
                    <p class="text-blue-200 text-sm">Diário Oficial Municipal - São Luís/MA</p>
                </div>
            </div>
            <div class="flex space-x-4">
                <a href="https://www.saoluis.ma.gov.br" target="_blank" class="text-white hover:text-blue-200 transition">
                    <i class="fas fa-home mr-2"></i>Portal da Prefeitura
                </a>
                <a href="/" class="text-white hover:text-blue-200 transition">
                    <i class="fas fa-sign-in-alt mr-2"></i>Área Restrita
                </a>
            </div>
        </div>
    </nav>
    
    <!-- Main Content -->
    <div class="verify-container max-w-5xl mx-auto px-4 py-12">
        <!-- Hero Section -->
        <div class="text-center mb-12">
            <div class="inline-block bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-full p-6 mb-6">
                <i class="fas fa-certificate text-white text-6xl"></i>
            </div>
            <h2 class="text-4xl font-bold text-white mb-4">Verifique a Autenticidade</h2>
            <p class="text-blue-200 text-lg max-w-2xl mx-auto">
                Valide documentos oficiais usando os hashes de segurança. 
                Garantimos a integridade e autenticidade de todas as publicações.
            </p>
        </div>
        
        <!-- Verification Cards -->
        <div class="grid md:grid-cols-2 gap-8 mb-12">
            <!-- Verificar Edição -->
            <div class="verify-card rounded-2xl p-8">
                <div class="flex items-center mb-6">
                    <div class="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full p-4 mr-4">
                        <i class="fas fa-book text-white text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-bold text-gray-800">Verificar Edição</h3>
                        <p class="text-gray-600 text-sm">Valide uma edição completa do diário</p>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <input 
                        type="text" 
                        id="editionNumber" 
                        placeholder="Nº da Edição (ex: 001/2025)" 
                        class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
                    >
                    <input 
                        type="number" 
                        id="editionYear" 
                        placeholder="Ano (ex: 2025)" 
                        class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
                    >
                    <input 
                        type="text" 
                        id="editionHash" 
                        placeholder="Hash de Validação" 
                        class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none transition"
                    >
                    <button 
                        onclick="verifyEdition()" 
                        class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-105"
                    >
                        <i class="fas fa-check-circle mr-2"></i>Verificar Edição
                    </button>
                </div>
                
                <div id="editionResult" class="mt-6"></div>
            </div>
            
            <!-- Verificar Assinatura -->
            <div class="verify-card rounded-2xl p-8">
                <div class="flex items-center mb-6">
                    <div class="bg-gradient-to-br from-green-500 to-teal-600 rounded-full p-4 mr-4">
                        <i class="fas fa-signature text-white text-2xl"></i>
                    </div>
                    <div>
                        <h3 class="text-2xl font-bold text-gray-800">Verificar Assinatura</h3>
                        <p class="text-gray-600 text-sm">Valide uma assinatura eletrônica</p>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <input 
                        type="number" 
                        id="matterId" 
                        placeholder="ID da Matéria" 
                        class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition"
                    >
                    <input 
                        type="text" 
                        id="signatureHash" 
                        placeholder="Hash da Assinatura" 
                        class="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition"
                    >
                    <button 
                        onclick="verifySignature()" 
                        class="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold py-3 rounded-lg transition transform hover:scale-105"
                    >
                        <i class="fas fa-check-circle mr-2"></i>Verificar Assinatura
                    </button>
                </div>
                
                <div id="signatureResult" class="mt-6"></div>
            </div>
        </div>
        
        <!-- Info Box -->
        <div class="verify-card rounded-2xl p-8">
            <h4 class="text-xl font-bold text-gray-800 mb-4 flex items-center">
                <i class="fas fa-info-circle text-blue-600 mr-3"></i>
                Como obter os códigos de verificação?
            </h4>
            <div class="grid md:grid-cols-2 gap-6">
                <div>
                    <h5 class="font-bold text-gray-700 mb-2">Hash da Edição</h5>
                    <ul class="text-gray-600 text-sm space-y-1">
                        <li><i class="fas fa-arrow-right text-blue-500 mr-2"></i>Encontrado no rodapé do PDF publicado</li>
                        <li><i class="fas fa-arrow-right text-blue-500 mr-2"></i>Código alfanumérico de 64 caracteres</li>
                        <li><i class="fas fa-arrow-right text-blue-500 mr-2"></i>Valida toda a edição do diário</li>
                    </ul>
                </div>
                <div>
                    <h5 class="font-bold text-gray-700 mb-2">Hash da Assinatura</h5>
                    <ul class="text-gray-600 text-sm space-y-1">
                        <li><i class="fas fa-arrow-right text-green-500 mr-2"></i>Presente no cabeçalho de cada matéria</li>
                        <li><i class="fas fa-arrow-right text-green-500 mr-2"></i>Validação eletrônica individual</li>
                        <li><i class="fas fa-arrow-right text-green-500 mr-2"></i>Garante integridade do documento</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Footer -->
    <footer class="verify-container text-center py-8 text-white text-sm mt-12">
        <p class="mb-2">© 2025 Prefeitura Municipal de São Luís - MA</p>
        <p class="text-blue-200">Sistema Oficial de Publicações | Todos os direitos reservados</p>
    </footer>
    
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="/static/webgl-init.js"></script>
    <script>
        async function verifyEdition() {
            const editionNumber = document.getElementById('editionNumber').value.trim();
            const year = document.getElementById('editionYear').value;
            const hash = document.getElementById('editionHash').value.trim();
            const resultDiv = document.getElementById('editionResult');
            
            if (!editionNumber || !year || !hash) {
                resultDiv.innerHTML = \`
                    <div class="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg">
                        <i class="fas fa-exclamation-triangle mr-2"></i>Preencha todos os campos
                    </div>
                \`;
                return;
            }
            
            resultDiv.innerHTML = \`
                <div class="bg-gray-100 border-2 border-gray-300 text-gray-800 px-4 py-3 rounded-lg">
                    <i class="fas fa-spinner fa-spin mr-2"></i>Verificando...
                </div>
            \`;
            
            try {
                const { data } = await axios.post('/api/verification/edition', {
                    edition_number: editionNumber,
                    year: parseInt(year),
                    hash: hash
                });
                
                if (data.valid) {
                    resultDiv.innerHTML = \`
                        <div class="result-valid bg-green-100 border-2 border-green-300 text-green-800 px-4 py-4 rounded-lg">
                            <div class="flex items-start mb-3">
                                <i class="fas fa-check-circle text-3xl mr-3 mt-1"></i>
                                <div>
                                    <p class="font-bold text-lg">\${data.message}</p>
                                    <p class="text-sm mt-1">Edição \${data.edition.edition_number} - \${data.edition.year}</p>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 text-sm mt-3 pt-3 border-t border-green-200">
                                <div>
                                    <p class="font-semibold">Publicado em:</p>
                                    <p>\${new Date(data.edition.published_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                                <div>
                                    <p class="font-semibold">Total de Matérias:</p>
                                    <p>\${data.edition.matter_count}</p>
                                </div>
                            </div>
                        </div>
                    \`;
                } else {
                    resultDiv.innerHTML = \`
                        <div class="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-4 rounded-lg">
                            <div class="flex items-start">
                                <i class="fas fa-times-circle text-3xl mr-3 mt-1"></i>
                                <div>
                                    <p class="font-bold text-lg">\${data.message}</p>
                                    <p class="text-sm mt-1">O documento pode ter sido adulterado</p>
                                </div>
                            </div>
                        </div>
                    \`;
                }
            } catch (error) {
                resultDiv.innerHTML = \`
                    <div class="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        \${error.response?.data?.error || 'Erro ao verificar edição'}
                    </div>
                \`;
            }
        }
        
        async function verifySignature() {
            const matterId = document.getElementById('matterId').value;
            const signatureHash = document.getElementById('signatureHash').value.trim();
            const resultDiv = document.getElementById('signatureResult');
            
            if (!matterId || !signatureHash) {
                resultDiv.innerHTML = \`
                    <div class="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg">
                        <i class="fas fa-exclamation-triangle mr-2"></i>Preencha todos os campos
                    </div>
                \`;
                return;
            }
            
            resultDiv.innerHTML = \`
                <div class="bg-gray-100 border-2 border-gray-300 text-gray-800 px-4 py-3 rounded-lg">
                    <i class="fas fa-spinner fa-spin mr-2"></i>Verificando...
                </div>
            \`;
            
            try {
                const { data } = await axios.post('/api/verification/matter-signature', {
                    matter_id: parseInt(matterId),
                    signature_hash: signatureHash
                });
                
                if (data.valid) {
                    resultDiv.innerHTML = \`
                        <div class="result-valid bg-green-100 border-2 border-green-300 text-green-800 px-4 py-4 rounded-lg">
                            <div class="flex items-start mb-3">
                                <i class="fas fa-check-circle text-3xl mr-3 mt-1"></i>
                                <div>
                                    <p class="font-bold text-lg">\${data.message}</p>
                                    <p class="text-sm mt-1">\${data.matter.title}</p>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-3 text-sm mt-3 pt-3 border-t border-green-200">
                                <div>
                                    <p class="font-semibold">Secretaria:</p>
                                    <p>\${data.matter.secretaria}</p>
                                </div>
                                <div>
                                    <p class="font-semibold">Assinado por:</p>
                                    <p>\${data.matter.signed_by}</p>
                                </div>
                            </div>
                        </div>
                    \`;
                } else {
                    resultDiv.innerHTML = \`
                        <div class="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-4 rounded-lg">
                            <div class="flex items-start">
                                <i class="fas fa-times-circle text-3xl mr-3 mt-1"></i>
                                <div>
                                    <p class="font-bold text-lg">\${data.message}</p>
                                    <p class="text-sm mt-1">A assinatura pode ser inválida</p>
                                </div>
                            </div>
                        </div>
                    \`;
                }
            } catch (error) {
                resultDiv.innerHTML = \`
                    <div class="bg-red-100 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg">
                        <i class="fas fa-exclamation-triangle mr-2"></i>
                        \${error.response?.data?.error || 'Erro ao verificar assinatura'}
                    </div>
                \`;
            }
        }
    </script>
</body>
</html>
  `);
});

// Main page - Sistema completo com interface
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>DOM - Diário Oficial Municipal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    
    <!-- Quill.js for WYSIWYG editing -->
    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
    <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
    <style>
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
        }
        .sidebar {
            transition: transform 0.3s ease-in-out;
        }
        @media (max-width: 768px) {
            .sidebar.hidden {
                transform: translateX(-100%);
            }
        }
        
        /* WebGL Canvas Background */
        #webgl-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
        }
        
        .login-container {
            position: relative;
            z-index: 10;
        }
        
        .login-card {
            backdrop-filter: blur(10px);
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .logo-pulse {
            animation: pulse 2s ease-in-out infinite;
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .footer-link {
            color: white;
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }
        
        .footer-link:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }
    </style>
</head>
<body class="bg-gray-50">
    <div id="app">
        <!-- Login Screen with WebGL Background -->
        <div id="loginScreen" class="min-h-screen flex flex-col items-center justify-center px-4">
            <!-- WebGL Canvas -->
            <canvas id="webgl-background"></canvas>
            
            <!-- Login Card -->
            <div class="login-container login-card rounded-2xl shadow-2xl p-8 w-full max-w-md">
                <div class="text-center mb-8">
                    <div class="bg-gradient-to-br from-blue-600 to-purple-600 w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center logo-pulse shadow-lg">
                        <i class="fas fa-newspaper text-white text-4xl"></i>
                    </div>
                    <h1 class="text-4xl font-bold gradient-text mb-2">DOM</h1>
                    <p class="text-gray-600 text-lg">Diário Oficial Municipal</p>
                    <p class="text-gray-500 text-sm mt-1">São Luís - MA</p>
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
                    
                    <div class="text-center mt-3">
                        <button 
                            type="button"
                            id="forgotPasswordLink"
                            class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            Esqueceu a senha?
                        </button>
                    </div>
                </form>
                
                <div id="loginError" class="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm text-center rounded-lg hidden"></div>
                <div id="loginSuccess" class="mt-4 p-3 bg-green-50 border border-green-200 text-green-600 text-sm text-center rounded-lg hidden"></div>
                
            </div>
            
            <!-- Footer with Prefeitura Link -->
            <div class="login-container mt-8 text-center space-y-4">
                <!-- Link Portal Público -->
                <a href="/portal" class="footer-link inline-flex items-center space-x-2 text-white font-bold text-lg bg-blue-600 bg-opacity-20 px-6 py-3 rounded-lg hover:bg-opacity-30 transition">
                    <i class="fas fa-book-open"></i>
                    <span>Portal do Diário Oficial</span>
                    <i class="fas fa-arrow-right text-sm"></i>
                </a>
                
                <!-- Link Verificar Autenticidade (PÚBLICO) -->
                <a href="/verificar" class="footer-link inline-flex items-center space-x-2 text-white font-bold text-lg bg-purple-600 bg-opacity-20 px-6 py-3 rounded-lg hover:bg-opacity-30 transition">
                    <i class="fas fa-shield-alt"></i>
                    <span>Verificar Autenticidade do Diário</span>
                    <i class="fas fa-arrow-right text-sm"></i>
                </a>
                
                <div class="flex justify-center space-x-6">
                    <a href="https://www.saoluis.ma.gov.br" target="_blank" rel="noopener noreferrer" class="footer-link inline-flex items-center space-x-2 text-white font-medium hover:text-blue-200 transition">
                        <i class="fas fa-landmark"></i>
                        <span>Portal da Prefeitura</span>
                        <i class="fas fa-external-link-alt text-sm"></i>
                    </a>
                </div>
                
                <p class="text-white text-sm opacity-80">
                    © 2026 Prefeitura Municipal de São Luís - MA
                </p>
            </div>
        </div>
        
        <!-- Main Dashboard (hidden initially) -->
        <div id="dashboardScreen" class="hidden">
            <!-- Top Navigation Bar - FIXED -->
            <nav class="bg-white shadow-lg border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
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
                            <a href="/portal" target="_blank" class="text-blue-600 hover:text-blue-800 font-medium transition">
                                <i class="fas fa-book-open mr-2"></i>Portal Público
                            </a>
                            
                            <button id="notificationBtn" class="text-gray-600 hover:text-gray-800 relative">
                                <i class="fas fa-bell text-xl"></i>
                                <span id="notificationBadge" class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center hidden">0</span>
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
            
            <div class="flex h-screen overflow-hidden pt-16">
                <!-- Sidebar - FIXED -->
                <aside id="sidebar" class="sidebar bg-white w-64 border-r border-gray-200 overflow-y-auto fixed left-0 top-16 bottom-0">
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
                        
                        <div id="semadAdminMenu" class="hidden">
                            <a href="#" data-view="editions" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-book w-6"></i>
                                <span class="ml-3">Edições do Diário</span>
                            </a>
                        </div>
                        
                        <div id="adminMenu" class="hidden">
                            <a href="#" data-view="verification" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-shield-alt w-6"></i>
                                <span class="ml-3">Verificar Autenticidade</span>
                            </a>
                            <a href="#" data-view="users" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-users w-6"></i>
                                <span class="ml-3">Usuários</span>
                            </a>
                            <a href="#" data-view="secretarias" class="nav-link flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition">
                                <i class="fas fa-building w-6"></i>
                                <span class="ml-3">Secretarias</span>
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
                <main class="flex-1 overflow-y-auto bg-gray-50 p-6 ml-64">
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

    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="/static/webgl-init.js"></script>
    <script src="/static/app-v2.js"></script>
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

// Public portal page - Dashboard público com WebGL
app.get('/portal', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portal do Diário Oficial - São Luís</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            margin: 0;
            overflow-x: hidden;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        
        /* WebGL Canvas Background */
        #webgl-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
        }
        
        .portal-container {
            position: relative;
            z-index: 1;
        }
        
        .portal-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .hover-lift {
            transition: all 0.3s ease;
        }
        
        .hover-lift:hover {
            transform: translateY(-8px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }
        
        .gradient-text {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
    </style>
</head>
<body class="bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 min-h-screen">
    <!-- WebGL Canvas -->
    <canvas id="webgl-background"></canvas>
    
    <!-- Navbar -->
    <nav class="portal-container bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg border-b border-white border-opacity-20 py-4">
        <div class="max-w-7xl mx-auto px-4 flex justify-between items-center">
            <div class="flex items-center space-x-3">
                <i class="fas fa-newspaper text-white text-3xl"></i>
                <div>
                    <h1 class="text-white text-xl font-bold">Portal do Diário Oficial</h1>
                    <p class="text-blue-200 text-sm">São Luís - MA</p>
                </div>
            </div>
            <div class="flex space-x-4">
                <a href="/portal" class="text-white hover:text-blue-200 transition">
                    <i class="fas fa-home mr-2"></i>Início
                </a>
                <a href="/verificar" class="text-white hover:text-blue-200 transition">
                    <i class="fas fa-shield-alt mr-2"></i>Verificar
                </a>
                <a href="/" class="text-white hover:text-blue-200 transition">
                    <i class="fas fa-sign-in-alt mr-2"></i>Área Restrita
                </a>
            </div>
        </div>
    </nav>
    
    <!-- Main Content -->
    <div class="portal-container max-w-7xl mx-auto px-4 py-12">
        <!-- Hero Section -->
        <div class="text-center mb-12">
            <div class="inline-block bg-white bg-opacity-10 backdrop-filter backdrop-blur-lg rounded-full p-6 mb-6">
                <i class="fas fa-book-open text-white text-6xl"></i>
            </div>
            <h2 class="text-4xl font-bold text-white mb-4">Publicações Oficiais</h2>
            <p class="text-blue-200 text-lg max-w-2xl mx-auto">
                Consulte as edições do Diário Oficial Municipal de São Luís
            </p>
        </div>
        
        <!-- Search Bar -->
        <div class="portal-card rounded-2xl p-6 mb-8">
            <div class="flex gap-4">
                <div class="flex-1">
                    <input 
                        type="text" 
                        id="portalSearch"
                        class="w-full px-6 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition text-lg"
                        placeholder="Pesquisar publicações..."
                    >
                </div>
                <button 
                    onclick="searchPortal()"
                    class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-xl transition transform hover:scale-105"
                >
                    <i class="fas fa-search mr-2"></i>Buscar
                </button>
            </div>
        </div>
        
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div class="portal-card rounded-2xl p-6 hover-lift cursor-pointer">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-blue-100 rounded-full p-4">
                        <i class="fas fa-book text-blue-600 text-2xl"></i>
                    </div>
                    <span id="totalEditions" class="text-4xl font-bold text-blue-600">0</span>
                </div>
                <h3 class="text-lg font-semibold text-gray-800">Edições Publicadas</h3>
                <p class="text-sm text-gray-500 mt-1">Total de edições disponíveis</p>
            </div>
            
            <div class="portal-card rounded-2xl p-6 hover-lift cursor-pointer">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-green-100 rounded-full p-4">
                        <i class="fas fa-file-alt text-green-600 text-2xl"></i>
                    </div>
                    <span id="totalMatters" class="text-4xl font-bold text-green-600">0</span>
                </div>
                <h3 class="text-lg font-semibold text-gray-800">Matérias Publicadas</h3>
                <p class="text-sm text-gray-500 mt-1">Total de documentos</p>
            </div>
            
            <div class="portal-card rounded-2xl p-6 hover-lift cursor-pointer">
                <div class="flex items-center justify-between mb-4">
                    <div class="bg-purple-100 rounded-full p-4">
                        <i class="fas fa-calendar text-purple-600 text-2xl"></i>
                    </div>
                    <span id="thisMonth" class="text-4xl font-bold text-purple-600">0</span>
                </div>
                <h3 class="text-lg font-semibold text-gray-800">Este Mês</h3>
                <p class="text-sm text-gray-500 mt-1">Publicações recentes</p>
            </div>
        </div>
        
        <!-- Analytics Charts -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div class="portal-card rounded-2xl p-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-chart-pie mr-2 text-purple-600"></i>
                    Publicações por Secretaria
                </h3>
                <canvas id="chartBySecretaria" style="max-height: 300px;"></canvas>
            </div>
            
            <div class="portal-card rounded-2xl p-6">
                <h3 class="text-xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-chart-bar mr-2 text-green-600"></i>
                    Tipos de Matéria
                </h3>
                <canvas id="chartByType" style="max-height: 300px;"></canvas>
            </div>
        </div>
        
        <!-- Latest Editions -->
        <div class="portal-card rounded-2xl p-8 mb-8">
            <h3 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-newspaper mr-3 text-blue-600"></i>
                Últimas Edições
            </h3>
            <div id="latestEditions" class="space-y-4">
                <div class="text-center py-8">
                    <i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                    <p class="mt-4 text-gray-600">Carregando...</p>
                </div>
            </div>
        </div>
        
        <!-- Most Searched Words (Word Cloud Style) -->
        <div class="portal-card rounded-2xl p-8">
            <h3 class="text-2xl font-bold text-gray-800 mb-6">
                <i class="fas fa-fire mr-3 text-orange-600"></i>
                Termos Mais Buscados
            </h3>
            <div id="mostSearched" class="flex flex-wrap gap-3 justify-center">
                <!-- Será preenchido dinamicamente com tamanhos variados -->
            </div>
        </div>
    </div>
    
    <!-- Footer -->
    <footer class="portal-container text-center py-8 text-white text-sm mt-12">
        <p class="mb-2">© 2025 Prefeitura Municipal de São Luís - MA</p>
        <p class="text-blue-200">Sistema Oficial de Publicações | Todos os direitos reservados</p>
    </footer>
    
    <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="/static/webgl-init.js"></script>
    <script>
        // Load portal data
        async function loadPortalData() {
            try {
                // Load stats
                const statsResponse = await axios.get('/api/portal/stats');
                document.getElementById('totalEditions').textContent = statsResponse.data.total_editions || 0;
                document.getElementById('totalMatters').textContent = statsResponse.data.total_matters || 0;
                document.getElementById('thisMonth').textContent = statsResponse.data.this_month || 0;
                
                // Load analytics for charts
                const analyticsResponse = await axios.get('/api/portal/analytics');
                renderCharts(analyticsResponse.data);
                
                // Load latest editions
                const editionsResponse = await axios.get('/api/portal/editions');
                renderLatestEditions(editionsResponse.data.editions || []);
                
                // Load most searched words
                const searchResponse = await axios.get('/api/portal/most-searched');
                renderMostSearched(searchResponse.data.terms || []);
                
            } catch (error) {
                console.error('Error loading portal data:', error);
                document.getElementById('latestEditions').innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <p>Erro ao carregar dados</p>
                    </div>
                \`;
            }
        }
        
        function renderCharts(data) {
            // Chart: Publicações por Secretaria
            const ctxSec = document.getElementById('chartBySecretaria');
            if (ctxSec && data.by_secretaria) {
                new Chart(ctxSec, {
                    type: 'doughnut',
                    data: {
                        labels: data.by_secretaria.map(s => s.acronym || s.name),
                        datasets: [{
                            data: data.by_secretaria.map(s => s.count),
                            backgroundColor: [
                                '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
                                '#10b981', '#06b6d4', '#6366f1', '#84cc16'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom' }
                        }
                    }
                });
            }
            
            // Chart: Tipos de Matéria
            const ctxType = document.getElementById('chartByType');
            if (ctxType && data.by_type) {
                new Chart(ctxType, {
                    type: 'bar',
                    data: {
                        labels: data.by_type.map(t => t.name),
                        datasets: [{
                            label: 'Quantidade',
                            data: data.by_type.map(t => t.count),
                            backgroundColor: '#10b981'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: { beginAtZero: true }
                        }
                    }
                });
            }
        }
        
        function renderLatestEditions(editions) {
            if (editions.length === 0) {
                document.getElementById('latestEditions').innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-inbox text-4xl mb-4"></i>
                        <p>Nenhuma edição publicada</p>
                    </div>
                \`;
                return;
            }
            
            document.getElementById('latestEditions').innerHTML = editions.map(edition => \`
                <div class="border border-gray-200 rounded-xl p-6 hover:bg-gray-50 transition cursor-pointer" onclick="viewEditionPortal(\${edition.id})">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-2">
                                <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                                    Edição \${edition.edition_number}
                                </span>
                                \${edition.is_supplemental ? '<span class="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">SUPLEMENTAR</span>' : ''}
                            </div>
                            <h4 class="text-lg font-semibold text-gray-900 mb-2">
                                Diário Oficial - \${edition.year}
                            </h4>
                            <p class="text-sm text-gray-600">
                                <i class="fas fa-calendar mr-2"></i>
                                \${new Date(edition.edition_date).toLocaleDateString('pt-BR')}
                            </p>
                            <p class="text-sm text-gray-600 mt-1">
                                <i class="fas fa-file-alt mr-2"></i>
                                \${edition.matter_count || 0} matéria(s)
                            </p>
                        </div>
                        <a 
                            href="/api/editions/\${edition.id}/pdf" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                            onclick="event.stopPropagation()"
                        >
                            <i class="fas fa-download mr-2"></i>Baixar
                        </a>
                    </div>
                </div>
            \`).join('');
        }
        
        function renderMostSearched(terms) {
            if (!terms || terms.length === 0) {
                terms = [
                    { term: 'Decreto', count: 156 },
                    { term: 'Portaria', count: 134 },
                    { term: 'Edital', count: 98 },
                    { term: 'Licitação', count: 87 },
                    { term: 'Concurso', count: 76 },
                    { term: 'Contrato', count: 65 },
                    { term: 'Nomeação', count: 54 },
                    { term: 'Exoneração', count: 43 }
                ];
            }
            
            // Word cloud style - tamanhos proporcionais à contagem
            const maxCount = Math.max(...terms.map(t => t.count));
            const colors = ['orange', 'red', 'purple', 'blue', 'green', 'pink', 'indigo', 'yellow'];
            
            document.getElementById('mostSearched').innerHTML = terms.map((item, index) => {
                const size = Math.max(0.8, (item.count / maxCount));
                const fontSize = 0.8 + (size * 1.2); // 0.8rem to 2rem
                const color = colors[index % colors.length];
                
                return \`
                    <button 
                        onclick="quickSearch('\${item.term}')"
                        class="bg-gradient-to-r from-\${color}-100 to-\${color}-200 hover:from-\${color}-200 hover:to-\${color}-300 text-gray-800 px-4 py-2 rounded-full font-medium transition transform hover:scale-110"
                        style="font-size: \${fontSize}rem;"
                        title="\${item.count} buscas"
                    >
                        <i class="fas fa-search mr-1"></i>\${item.term}
                    </button>
                \`;
            }).join('');
        }
        
        function searchPortal() {
            const query = document.getElementById('portalSearch').value;
            if (query) {
                window.location.href = \`/pesquisa?q=\${encodeURIComponent(query)}\`;
            }
        }
        
        function quickSearch(term) {
            window.location.href = \`/pesquisa?q=\${encodeURIComponent(term)}\`;
        }
        
        function viewEditionPortal(id) {
            window.location.href = \`/api/editions/\${id}/pdf\`;
        }
        
        // Load data on page load
        loadPortalData();
    </script>
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


app.get('/api/debug/routes', (c) => {
  return c.json({
    routes: [
      { method: 'GET', path: '/api/matters' },
      { method: 'GET', path: '/api/matters/:id' },
      { method: 'POST', path: '/api/matters' },
      { method: 'POST', path: '/api/auth/login' },
      { method: 'GET', path: '/api/auth/me' },
      { method: 'GET', path: '/api/matter-types' },
      { method: 'GET', path: '/api/health' },
      { method: 'GET', path: '/api/debug/routes' }
    ],
    timestamp: new Date().toISOString()
  });
});

console.log('=== IMPORTANDO ROTAS ===');
console.log('Importando auth:', typeof auth);
console.log('Importando matters:', typeof matters);
console.log('Importando semad:', typeof semad);
console.log('=== FIM DOS IMPORTS ===');

export default app;
