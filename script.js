// Initialize jsPDF & Chart (global, as they are loaded in <head>)
const jsPDFModule = window.jspdf ? window.jspdf.jsPDF : null; 
const ChartJS = window.Chart || null; 

if (!jsPDFModule) console.error("CRÍTICO: jsPDF não carregado! Geração de PDF não funcionará.");
else console.log("DEBUG: jsPDF carregado.");
if (!ChartJS) console.error("CRÍTICO: Chart.js não carregado! Gráficos não funcionarão.");
else console.log("DEBUG: Chart.js carregado.");

console.log("DEBUG: Luckhouse Games - Script.js: Iniciando carregamento...");

// --- GLOBAL APP STATE & CONFIG ---
let STORE_CONFIG = {}; 
let ORDENS_SERVICO = [];
let CLIENTES = [];
let PRODUTOS = [];
let SERVICOS = [];
let VENDAS = [];
let pdvCartItems = [];
let CURRENT_USER = { username: null, role: null };
let salesChartInstance = null;
window.clientFromPdvFlag = false; 
let osIdParaAcaoTecnico = null; 
let acaoTecnicoPendente = null; 
console.log("DEBUG: Constantes e variáveis globais de estado inicializadas.");

// --- UTILITY FUNCTIONS ---
function showToast(message, type = "primary", title = "Notificação") {
    try {
        // console.log(`DEBUG: showToast chamada com: message='${message}', type='${type}', title='${title}'`);
        const toastEl = document.getElementById('liveToast');
        const toastMessageEl = document.getElementById('toast-message');
        const toastTitleEl = document.getElementById('toast-title');
        if (!toastEl || !toastMessageEl || !toastTitleEl) {
            console.error("Elementos do Toast não encontrados! Mensagem:", message);
            alert(title + ": " + message); return;
        }
        // console.log("DEBUG: Elementos do Toast encontrados.");
        const toastComponent = bootstrap.Toast.getOrCreateInstance(toastEl);
        toastMessageEl.textContent = message;
        toastTitleEl.textContent = title;
        const validBgClasses = ['bg-primary-custom', 'bg-success-custom', 'bg-danger-custom', 'bg-warning', 'bg-info-custom', 'text-white'];
        toastEl.classList.remove(...validBgClasses);
        toastMessageEl.classList.remove('text-white'); 
        toastTitleEl.classList.remove('text-white');
        let newClass = 'bg-primary-custom'; let addTextWhite = true;
        if (type === "success") newClass = 'bg-success-custom';
        else if (type === "danger") newClass = 'bg-danger-custom';
        else if (type === "warning") { newClass = 'bg-warning'; addTextWhite = false; }
        else if (type === "info") newClass = 'bg-info-custom';
        toastEl.classList.add(newClass);
        if (addTextWhite) { toastEl.classList.add('text-white'); toastMessageEl.classList.add('text-white'); toastTitleEl.classList.add('text-white'); }
        if(toastComponent) {
            toastComponent.show(); 
            // console.log("DEBUG: Mostrando toast.");
        } else console.error("Toast component não inicializado.");
    } catch (error) { console.error("Erro ao mostrar toast:", error, message); }
}

function formatCurrency(value) {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return "R$ --,--"; 
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getNextId(collection) {
    if (!Array.isArray(collection) || collection.length === 0) return 1;
    const maxId = Math.max(0, ...collection.map(item => Number(item.id) || 0));
    return maxId + 1;
}
console.log("DEBUG: Funções utilitárias definidas.");

// --- LOCALSTORAGE DATA MANAGEMENT ---
function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`DEBUG: Dados SALVOS para chave "${key}". Itens:`, Array.isArray(data) ? data.length : '(Objeto)');
    } catch (e) { console.error("Erro ao salvar dados na localStorage para chave", key, e); showToast(`Erro ao salvar (${key}).`, "danger"); }
}

function loadData(key, defaultValue = []) {
    const dataFromStorage = localStorage.getItem(key);
    if (dataFromStorage) {
        try {
            const parsedData = JSON.parse(dataFromStorage);
            console.log(`DEBUG: Dados CARREGADOS da chave "${key}". Itens:`, Array.isArray(parsedData) ? parsedData.length : '(Objeto)');
            return parsedData;
        } catch (e) {
            console.error(`Erro ao parsear JSON da chave "${key}":`, e, "\nConteúdo:", dataFromStorage);
            showToast(`Erro ao carregar dados (${key}). Resetando para padrão.`, "warning");
            localStorage.removeItem(key); 
        }
    }
    console.log(`DEBUG: Nenhum dado para chave "${key}", usando default.`);
    return Array.isArray(defaultValue) ? [...defaultValue] : (typeof defaultValue === 'object' && defaultValue !== null ? {...defaultValue} : defaultValue);
}
console.log("DEBUG: Funções de LocalStorage definidas.");

// --- APP CONFIG ---
function loadAppConfig() {
    const defaultConfig = {
        nomeLoja: "Luckhouse Games", cnpj: "43.864.000/198",
        endereco: "Av. Itália, 200 – Shopping Amarilys, Itupeva – SP",
        telefone: "(11) 99357-7209", email: "luckhousegames@gmail.com",
        logoUrl: "assets/logo.png", diasGarantiaPadrao: 90, tecnicoWhatsapp: "",
        msgOSClienteAberta: "Olá {nome_cliente}! Sua OS #{numero_os} para {equipamento} ({problema}) foi aberta na Luckhouse Games. Status: {status_os}. Em breve mais infos!",
        msgOSClienteConcluida: "Olá {nome_cliente}! Boas notícias! Sua OS #{numero_os} ({equipamento}) está CONCLUÍDA e aguardando retirada na Luckhouse Games! Valor: {valor_orcamento}.",
        msgOSTecnicoNova: "Nova OS #{numero_os} (Téc: Luiz Carlos S Sales)!\nCliente: {nome_cliente}\nEntrada: {data_entrada}\nEquip: {equipamento_tipo} {equipamento_marca} - {equipamento_modelo}\nS/N: {serial_equipamento}\nDefeito: {defeito_relatado}\nServiço: {nome_servico_tecnico}\nCusto: {custo_tecnico_servico}"
    };
    STORE_CONFIG = loadData('luckhouse_config', defaultConfig);
    updateStoreInfoUI();
}

function saveAppConfig() {
    saveData('luckhouse_config', STORE_CONFIG);
    updateStoreInfoUI();
    showToast("Configurações salvas!", "success");
}

function updateStoreInfoUI() {
    try {
        const el = (id) => document.getElementById(id);
        const sidebarLogoImg = el('sidebar-logo-img');
        const sidebarLogoText = el('sidebar-logo-text');
        const sidebarStoreNameDisplay = el('sidebar-store-name-display');
        
        if (sidebarLogoImg && sidebarLogoText && sidebarStoreNameDisplay) {
            if (STORE_CONFIG.logoUrl && STORE_CONFIG.logoUrl.trim() !== "") { 
                sidebarLogoImg.src = STORE_CONFIG.logoUrl; 
                sidebarLogoImg.style.display = 'block'; 
                sidebarLogoText.style.display = 'none'; 
            } else { 
                sidebarLogoImg.style.display = 'none'; 
                sidebarLogoText.style.display = 'block'; 
            }
            sidebarStoreNameDisplay.textContent = STORE_CONFIG.nomeLoja;
        }
        if (el('footer-store-name')) el('footer-store-name').textContent = STORE_CONFIG.nomeLoja;
        if (el('footer-store-name-2')) el('footer-store-name-2').textContent = STORE_CONFIG.nomeLoja;
        if (el('footer-cnpj')) el('footer-cnpj').textContent = STORE_CONFIG.cnpj;
        if (el('footer-address')) el('footer-address').textContent = STORE_CONFIG.endereco;
        if (el('footer-phone')) el('footer-phone').textContent = STORE_CONFIG.telefone;
        if (el('footer-email')) el('footer-email').textContent = STORE_CONFIG.email;
        
        const configNomeLojaEl = el('config-nome-loja');
        const configSection = document.querySelector('#configuracoes');
        if (configNomeLojaEl && configSection && !configSection.classList.contains('d-none')) {
            configNomeLojaEl.value = STORE_CONFIG.nomeLoja || '';
            el('config-cnpj').value = STORE_CONFIG.cnpj || '';
            el('config-endereco').value = STORE_CONFIG.endereco || '';
            el('config-telefone').value = STORE_CONFIG.telefone || '';
            el('config-email').value = STORE_CONFIG.email || '';
            el('config-logo-url').value = STORE_CONFIG.logoUrl || '';
            el('config-garantia-dias').value = STORE_CONFIG.diasGarantiaPadrao || 90;
            el('config-tecnico-whatsapp').value = STORE_CONFIG.tecnicoWhatsapp || '';
            // Adicionar aqui para popular os campos de template de mensagem se existirem no HTML de config
        }
        updateTermoGarantiaPreview();
    } catch (error) { console.error("Erro em updateStoreInfoUI:", error); }
}

function updateTermoGarantiaPreview() {
    const osTermosPreview = document.getElementById('os-termos-garantia-preview');
    if (osTermosPreview) {
        osTermosPreview.innerHTML = `
            <p>Garantia de ${STORE_CONFIG.diasGarantiaPadrao || 90} dias após entrega.</p>
            <p>Não nos responsabilizamos por danos causados por mau uso ou quedas após o reparo.</p>
            <p>Equipamentos não retirados em até 90 dias serão descartados ou reaproveitados conforme política da loja.</p>`;
    }
}
console.log("DEBUG: Funções de App Config definidas.");

// --- LOGIN & AUTHENTICATION (SIMULATED) ---
function handleLogin(event) {
    event.preventDefault(); 
    console.log("DEBUG: handleLogin - Iniciado.");
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorMessageEl = document.getElementById('login-error-message');

    if (!usernameInput || !passwordInput || !errorMessageEl) { 
        console.error("handleLogin: Elementos do formulário de login não encontrados."); 
        showToast("Erro interno no formulário de login.", "danger");
        return; 
    }
    const username = usernameInput.value;
    const password = passwordInput.value;
    console.log("DEBUG: handleLogin - Tentando login com usuário:", username);

    if (username === 'luckmaster' && password === 'L@1998*') { CURRENT_USER = {username: 'Luck Master', role: 'admin'}; }
    else if (username === 'Henrique Del Peso' && password === 'hdp123') { CURRENT_USER = {username: 'Henrique Del Peso', role: 'padrao'}; }
    else { errorMessageEl.classList.remove('d-none'); console.log("handleLogin: Credenciais inválidas."); return; }

    errorMessageEl.classList.add('d-none');
    saveData('luckhouse_currentUser', CURRENT_USER);
    console.log("DEBUG: handleLogin - Usuário salvo:", CURRENT_USER);
    
    updateUIAfterLogin(); 
    
    const modalLoginEl = document.getElementById('modalLogin');
    if (modalLoginEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalLoginEl);
        if (modalInstance && modalInstance['_isShown']) {
            modalInstance.hide();
            console.log("DEBUG: handleLogin - Modal de login escondido.");
        }
    } else { console.error("handleLogin: Modal de login não encontrado para esconder."); }
    
    showToast(`Bem-vindo(a), ${CURRENT_USER.username}!`, "success");
    navigateToSection('dashboard'); 
    setupAllModules(); 
    console.log("DEBUG: handleLogin - Concluído.");
}

function handleLogout() {
    console.log("DEBUG: handleLogout - Iniciado.");
    if (!confirm("Tem certeza que deseja sair?")) { console.log("handleLogout: Logout cancelado."); return; }
    CURRENT_USER = {username: null, role: null};
    localStorage.removeItem('luckhouse_currentUser');
    updateUIAfterLogin(); 
    showToast("Você saiu do sistema.", "info");
    
    const modalLoginEl = document.getElementById('modalLogin');
    if (modalLoginEl) {
         const loginModalInstance = bootstrap.Modal.getOrCreateInstance(modalLoginEl);
         if (loginModalInstance && !loginModalInstance['_isShown']) loginModalInstance.show();
    } else { console.error("handleLogout: Modal de login não encontrado para exibir."); }
}

function checkLoginState() {
    console.log("DEBUG: checkLoginState - Iniciado.");
    loadAllData(); // Carrega todos os dados, incluindo config, ANTES de checar o login
    const storedUser = loadData('luckhouse_currentUser', null);
    if (storedUser && storedUser.username && storedUser.role) {
        CURRENT_USER = storedUser;
        console.log("DEBUG: checkLoginState - Usuário encontrado no localStorage:", CURRENT_USER);
        updateUIAfterLogin();
        navigateToSection('dashboard'); 
        setupAllModules(); 
    } else {
        console.log("DEBUG: checkLoginState - Nenhum usuário logado encontrado. Exibindo UI de login.");
        updateUIAfterLogin(); 
        const modalLoginEl = document.getElementById('modalLogin');
        if (modalLoginEl) {
            const loginModalInstance = bootstrap.Modal.getOrCreateInstance(modalLoginEl);
            if (loginModalInstance && !loginModalInstance['_isShown']) {
                 loginModalInstance.show();
            }
        } else { console.error("checkLoginState: Modal de login não encontrado para ser exibido."); }
    }
    console.log("DEBUG: checkLoginState - Concluído.");
}

function updateUIAfterLogin() {
    console.log("DEBUG: updateUIAfterLogin - UI atualizada para usuário:", CURRENT_USER.username);
    const el = id => document.getElementById(id);
    const loggedInUserEl = el('logged-in-user');
    const logoutButton = el('logout-button');
    const adminNavItems = document.querySelectorAll('.nav-item-admin'); 
    const mainContentSections = document.querySelectorAll('.main-content'); 
    const loginPromptSection = el('login-prompt');
    const dashboardUsernameEl = el('dashboard-username');

    if (CURRENT_USER.username) {
        if(loggedInUserEl) loggedInUserEl.textContent = `Logado: ${CURRENT_USER.username} (${CURRENT_USER.role})`;
        if(logoutButton) logoutButton.style.display = 'block';
        if(loginPromptSection) loginPromptSection.classList.add('d-none');
        if(dashboardUsernameEl) dashboardUsernameEl.textContent = CURRENT_USER.username;
        mainContentSections.forEach(section => section.classList.remove('d-none'));
        adminNavItems.forEach(item => item.classList.toggle('d-none', CURRENT_USER.role !== 'admin'));
        
        const activeSection = document.querySelector('.content-section:not(.d-none):not(#login-prompt)');
        if (activeSection && activeSection.id === 'admin-area' && CURRENT_USER.role !== 'admin') {
            navigateToSection('dashboard');
        } else if (activeSection && activeSection.id === 'admin-area' && CURRENT_USER.role === 'admin') {
             renderAdminDashboard(); 
        }
    } else { 
        if(loggedInUserEl) loggedInUserEl.textContent = 'Não Logado';
        if(logoutButton) logoutButton.style.display = 'none';
        if(loginPromptSection) loginPromptSection.classList.remove('d-none'); 
        if(dashboardUsernameEl) dashboardUsernameEl.textContent = "Usuário";
        mainContentSections.forEach(section => section.classList.add('d-none')); 
        const adminArea = el('admin-area'); 
        if(adminArea) adminArea.classList.add('d-none');
        adminNavItems.forEach(item => item.classList.add('d-none'));
    }
}
console.log("DEBUG: Funções de Login/Auth definidas.");

// --- MODULE SETUP FUNCTIONS ---
// As funções `setup<Modulo>Module` serão chamadas por `setupAllModules` DEPOIS do login
function setupAllModules() {
    console.group("DEBUG: setupAllModules - Iniciando configuração de UIs dinâmicas...");
    try {
        setupConfiguracoesModule();
        setupClientesModule();
        setupProdutosModule();
        setupServicosModule();
        setupOSModule();
        setupPdvModule();
        setupAdminAreaModule();
        setupSearchFilterListeners();
        setupBackupRestoreModule();
        setupModalServicoTecnico();
        console.log("DEBUG: setupAllModules - Configuração de UIs dinâmicas concluída.");
    } catch(e){
        console.error("ERRO em setupAllModules:", e);
        showToast("Erro ao configurar módulos. Verifique o console (F12).", "danger");
    }
    console.groupEnd();
}
console.log("DEBUG: Funções de setup de módulos definidas.");

// --- COPIE E COLE AQUI AS DEFINIÇÕES COMPLETAS DAS FUNÇÕES DE CADA MÓDULO ---
// --- (Clientes, Produtos, Serviços, OS, PDV, Admin, Filtros, Backup, PDFs, WhatsApp, etc.) ---
// --- Exemplo da estrutura que você deve colar aqui (use o código da resposta anterior): ---
/*
function setupConfiguracoesModule() { ... }
function loadClientes() { ... }
function saveClientes() { ... }
function renderClientList(filteredClients = null) { ... }
window.editCliente = function(id) { ... };
window.deleteCliente = function(id) { ... };
... e assim por diante para TODAS as outras funções ...
*/

// --- INITIALIZATION & NAVIGATION ---
console.log("DEBUG: Adicionando listener para DOMContentLoaded...");
document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG: DOMContentLoaded - Evento disparado.");
    try {
        console.log("DEBUG: DOMContentLoaded - Dentro do try block.");
        const el = id => document.getElementById(id);
        const menuToggle = el('menu-toggle'); 
        const wrapper = el('wrapper');
        const currentYearSpan = el('currentYear'); 
        const footerCurrentYearSpan = el('footerCurrentYear');
        const formLoginEl = el('formLogin'); 
        const logoutButtonEl = el('logout-button');
        const cardNovaOSEl = el('card-nova-os');
        console.log("DEBUG: DOMContentLoaded - Elementos básicos da UI referenciados.");
        
        if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
        if (footerCurrentYearSpan) footerCurrentYearSpan.textContent = new Date().getFullYear();
        console.log("DEBUG: DOMContentLoaded - Anos atualizados no rodapé.");

        // loadAllData() agora é chamado dentro de checkLoginState ou handleLogin
        // para garantir que STORE_CONFIG esteja carregado antes de outras coisas.

        if (formLoginEl) {
            formLoginEl.addEventListener('submit', handleLogin); 
            console.log("DEBUG: DOMContentLoaded - Listener de submit para formLogin adicionado.");
        } else { 
            console.error("Formulário de Login (formLogin) NÃO ENCONTRADO no DOMContentLoaded!"); 
        }
        
        if (logoutButtonEl) {
            logoutButtonEl.addEventListener('click', handleLogout);
            console.log("DEBUG: DOMContentLoaded - Listener de clique para logoutButton adicionado.");
        } else { 
            console.error("Botão de Logout (logout-button) NÃO ENCONTRADO!"); 
        }
        
        const navLinks = document.querySelectorAll('#sidebar-wrapper .nav-link[data-target]');
        if (navLinks.length > 0) {
            navLinks.forEach(link => { 
                link.addEventListener('click', function(e) { 
                    e.preventDefault(); 
                    const target = this.dataset.target;
                    console.log(`DEBUG: Link da Sidebar clicado! Target: ${target}`);
                    navigateToSection(target, this); 
                    if (wrapper && window.innerWidth<768 && wrapper.classList.contains('toggled')) { 
                        wrapper.classList.remove('toggled'); 
                    } 
                }); 
            });
            console.log("DEBUG: DOMContentLoaded - Listeners de clique para navLinks adicionados.");
        } else { 
            console.error("Links de navegação da Sidebar NÃO ENCONTRADOS!"); 
        }
        
        const dashboardCards = document.querySelectorAll('.dashboard-card');
        if(dashboardCards.length > 0){
            dashboardCards.forEach(card => {
                card.addEventListener('click', function() { 
                    const target = this.dataset.target;
                    console.log(`DEBUG: Card do Dashboard clicado! Target: ${target}, ID do card: ${this.id}`);
                    if(this.id === 'card-nova-os'){ 
                        const modalNovaOsEl = document.getElementById('modalNovaOS');
                        if(modalNovaOsEl) {
                            console.log("DEBUG: Acionando modal de Nova OS pelo card.");
                            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalNovaOsEl);
                             // Resetar formulário ANTES de mostrar, para o caso de ser uma nova OS
                            const form = document.getElementById('formNovaOS');
                            const osIdInput = document.getElementById('os-id');
                            if (form) form.reset();
                            if (osIdInput) osIdInput.value = '';
                            updateTermoGarantiaPreview(); 
                            populateClienteSelect();
                            const modalTitle = document.getElementById('modalNovaOSLabelDynamic');
                            if(modalTitle) modalTitle.textContent = 'Nova Ordem de Serviço';

                            modalInstance.show();
                        } else console.error("Modal de Nova OS não encontrado para ser aberto pelo card.");
                    } else if (target) {
                        navigateToSection(target); 
                    }
                });
            });
            console.log("DEBUG: DOMContentLoaded - Listeners de clique para dashboard-card adicionados.");
        } else {console.warn("Nenhum card de dashboard encontrado.")}


        if (menuToggle && wrapper) { 
            menuToggle.addEventListener('click', function() { wrapper.classList.toggle('toggled'); }); 
            console.log("DEBUG: DOMContentLoaded - Listener de clique para menuToggle adicionado.");
        } else { 
            console.warn("Menu toggle ou wrapper não encontrado."); 
        }
        
        console.log("DEBUG: DOMContentLoaded - Chamando checkLoginState().");
        checkLoginState(); 
        console.log("DEBUG: DOMContentLoaded - checkLoginState() concluído.");
        
        ['modalNovaOS', 'modalNovoCliente', 'modalNovoProduto', 'modalNovoServico', 'modalNovoItemRapidoPDV', 'modalSelecionarServicoParaTecnico'].forEach(modalId => {
            const modalEl = el(modalId);
            if (modalEl) {
                modalEl.addEventListener('hidden.bs.modal', function () { 
                    console.log(`DEBUG: Modal ${modalId} escondido, resetando formulário.`);
                    const form = this.querySelector('form'); if (form) form.reset(); 
                    const idInput = form ? form.querySelector('input[type="hidden"]') : null; if (idInput) idInput.value = '';
                    if(modalId === 'modalNovaOS') updateTermoGarantiaPreview();
                    if(modalId === 'modalNovoItemRapidoPDV') { const itemEstoqueGroupEl = el('item-rapido-estoque-group'); const itemTipoSelectEl = el('item-rapido-tipo'); if (itemEstoqueGroupEl) itemEstoqueGroupEl.style.display = 'block'; if (itemTipoSelectEl) itemTipoSelectEl.value = 'produto'; }
                });
                if (modalId === 'modalNovaOS') { 
                    modalEl.addEventListener('show.bs.modal', function (event) { 
                        console.log(`DEBUG: Modal ${modalId} sendo exibido.`);
                        const modalTitle = document.getElementById('modalNovaOSLabelDynamic'); // Título dinâmico
                        if(modalTitle && document.getElementById('os-id').value === '') { // Só muda título se for nova OS
                             modalTitle.textContent = 'Nova Ordem de Serviço';
                        }
                        updateTermoGarantiaPreview(); 
                        populateClienteSelect(); 
                        const btn = event.relatedTarget; 
                        if (btn && (btn.id === "btn-nova-os-modal" || btn.id === "card-nova-os")) { 
                            const form = el('formNovaOS'); if(form) form.reset(); 
                            const osIdInput = el('os-id'); if(osIdInput) osIdInput.value = ''; 
                            console.log("DEBUG: Modal de Nova OS aberto para nova entrada.");
                        } 
                    }); 
                }
                // Resetar títulos dos outros modais ao serem abertos para "Novo..."
                const simpleModals = {
                    'modalNovoCliente': 'modalNovoClienteLabelDynamic',
                    'modalNovoProduto': 'modalNovoProdutoLabelDynamic',
                    'modalNovoServico': 'modalNovoServicoLabelDynamic'
                };
                if (simpleModals[modalId]) {
                     modalEl.addEventListener('show.bs.modal', function (event) {
                        const btn = event.relatedTarget;
                        // Só reseta título se for aberto pelo botão principal de "Novo X"
                        if (btn && (btn.id === `btn-${modalId.toLowerCase().replace('modal','')}-modal` || btn.id === 'btn-pdv-novo-cliente-rapido' && modalId === 'modalNovoCliente')) {
                            const modalTitleEl = document.getElementById(simpleModals[modalId]);
                            if (modalTitleEl) {
                                if(modalId === 'modalNovoCliente') modalTitleEl.textContent = 'Novo Cliente';
                                else if (modalId === 'modalNovoProduto') modalTitleEl.textContent = 'Novo Produto';
                                else if (modalId === 'modalNovoServico') modalTitleEl.textContent = 'Novo Serviço';
                            }
                            const form = this.querySelector('form'); if (form) form.reset();
                            const idInput = form ? form.querySelector('input[type="hidden"]') : null; if (idInput) idInput.value = '';
                        }
                     });
                }

                if (modalId === 'modalNovoItemRapidoPDV') { 
                    modalEl.addEventListener('show.bs.modal', function() { 
                        console.log(`DEBUG: Modal ${modalId} sendo exibido.`);
                        const itemEstoqueGroupEl = el('item-rapido-estoque-group'); 
                        const itemTipoSelectEl = el('item-rapido-tipo'); 
                        if (itemEstoqueGroupEl && itemTipoSelectEl) { 
                            itemEstoqueGroupEl.style.display = itemTipoSelectEl.value === 'produto' ? 'block' : 'none'; 
                        } 
                    }); 
                }
            } else { console.warn(`Modal com ID ${modalId} não encontrado para configurar listeners.`); }
        });
        console.log("DEBUG: DOMContentLoaded - Listeners de show/hidden para modais configurados.");
        console.log("DEBUG: DOMContentLoaded - FIM do try block. Inicialização principal completa.");
    } catch (error) {
        console.error("ERRO FATAL DURANTE A INICIALIZAÇÃO:", error);
        showToast("Erro crítico na inicialização. Verifique o console (F12).", "danger", "ERRO FATAL");
        const loginPrompt = document.getElementById('login-prompt');
        if (loginPrompt) { loginPrompt.innerHTML = `<h1 class='text-danger display-4'>Erro Crítico na Aplicação</h1><p class='lead'>O sistema encontrou um problema e não pôde ser iniciado corretamente. Por favor, verifique o console do navegador (pressione F12) para detalhes técnicos e, se possível, envie um print do erro para o suporte.</p><p><small>Detalhe: ${error.message}</small></p>`; loginPrompt.classList.remove('d-none'); loginPrompt.style.height = "70vh"; loginPrompt.style.display = "flex"; loginPrompt.style.flexDirection = "column"; loginPrompt.style.justifyContent = "center";}
        document.querySelectorAll('.main-content, .admin-content').forEach(s => s.classList.add('d-none'));
    }
});

function loadAllData() {
    console.groupCollapsed("DEBUG: loadAllData - Iniciando carregamento de todos os dados.");
    try {
        loadAppConfig(); // Carrega STORE_CONFIG primeiro
        CLIENTES = loadData('luckhouse_clientes', []); 
        PRODUTOS = loadData('luckhouse_produtos', []); 
        SERVICOS = loadData('luckhouse_servicos', []); 
        ORDENS_SERVICO = loadData('luckhouse_os', []); 
        VENDAS = loadData('luckhouse_vendas', []); 
        
        // Estas funções dependem dos arrays acima estarem populados
        renderPdvItemList(); 
        populateClienteSelect();
        populatePdvClienteSelect();
        renderClientList();
        renderProductList();
        renderServiceList();
        renderOSList();

        if (CURRENT_USER && CURRENT_USER.role) { 
            renderDashboardOSRecentes(); 
            if (CURRENT_USER.role === 'admin') renderAdminDashboard(); 
        }
        console.log("DEBUG: loadAllData - Todos os dados carregados e UI inicial renderizada (se aplicável).");
    } catch(e) { console.error("Erro Crítico em loadAllData:", e); showToast("Falha crítica ao carregar todos os dados.", "danger");}
    console.groupEnd();
}

function navigateToSection(targetId, clickedLinkElement = null) {
    console.log("DEBUG: navigateToSection - Tentando navegar para:", targetId);
    
    if (!CURRENT_USER || !CURRENT_USER.role) { 
        if(targetId !== 'login-prompt' && targetId !== 'dashboard') { 
            console.warn("DEBUG: navigateToSection - Tentativa de navegação sem usuário logado para:", targetId, ". Forçando verificação de login.");
            checkLoginState(); 
            return;
        }
    }
    if (targetId === 'admin-area' && (!CURRENT_USER || CURRENT_USER.role !== 'admin')) {
        showToast("Acesso negado. Área restrita a administradores.", "danger");
        console.warn("DEBUG: navigateToSection - Acesso negado à área admin para usuário:", CURRENT_USER.role);
        // Força a navegação para o dashboard, e atualiza o link ativo na sidebar
        targetId = 'dashboard'; 
        clickedLinkElement = document.querySelector(`.nav-link[data-target="dashboard"]`); 
    }

    const navLinks = document.querySelectorAll('#sidebar-wrapper .nav-link[data-target]');
    const contentSections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(l => l.classList.remove('active'));
    contentSections.forEach(s => { 
        if (s.id !== 'login-prompt' || targetId === 'login-prompt') { // Não esconde login-prompt se for o alvo
            s.classList.add('d-none'); 
        }
    }); 

    let activeLink = clickedLinkElement;
    if (!activeLink && targetId !== 'login-prompt') { 
        activeLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
    }
    if(activeLink) activeLink.classList.add('active');
    else if (targetId !== 'login-prompt') console.warn("DEBUG: navigateToSection - Link ativo não encontrado para targetId:", targetId);
    
    const targetSection = document.getElementById(targetId);
    if (targetSection) {
        targetSection.classList.remove('d-none'); 
        console.log("DEBUG: navigateToSection - Seção", targetId, "exibida.");
        if (targetId !== 'login-prompt' && document.getElementById('login-prompt')) {
            document.getElementById('login-prompt').classList.add('d-none');
        }
    } else { 
        console.error("DEBUG: navigateToSection - Seção alvo NÃO encontrada:", targetId, ". Navegando para dashboard ou login."); 
        const dashboardFallback = document.getElementById('dashboard');
        const loginPromptFallback = document.getElementById('login-prompt');
        if (dashboardFallback && CURRENT_USER.username) { 
             dashboardFallback.classList.remove('d-none');
             const dashboardLink = document.querySelector(`.nav-link[data-target="dashboard"]`);
             if(dashboardLink) dashboardLink.classList.add('active');
        } else if (loginPromptFallback) { 
            loginPromptFallback.classList.remove('d-none');
        }
        return; 
    }

    if (CURRENT_USER && CURRENT_USER.role) {
        if(targetId === 'configuracoes') updateStoreInfoUI();
        else if (targetId === 'os') { renderOSList(); populateClienteSelect(); }
        else if (targetId === 'clientes') renderClientList();
        else if (targetId === 'produtos') { renderProductList(); renderServiceList(); }
        else if (targetId === 'pdv'){ renderPdvItemList(); populatePdvClienteSelect(); fillPdvClientReceiptFields(); }
        else if (targetId === 'dashboard') renderDashboardOSRecentes();
        else if (targetId === 'admin-area' && CURRENT_USER.role === 'admin') renderAdminDashboard();
    }
}

console.log("Luckhouse Games - Script.js: Carregamento finalizado e pronto para uso.");
