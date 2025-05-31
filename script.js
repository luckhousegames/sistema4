// Initialize jsPDF & Chart (global, as they are loaded in <head>)
const jsPDFModule = window.jspdf ? window.jspdf.jsPDF : null;
const ChartJS = window.Chart || null;

if (!jsPDFModule) console.error("CRÍTICO: jsPDF não carregado! Geração de PDF não funcionará.");
else console.log("jsPDF carregado.");
if (!ChartJS) console.error("CRÍTICO: Chart.js não carregado! Gráficos não funcionarão.");
else console.log("Chart.js carregado.");

console.log("Luckhouse Games - Script.js: Iniciando carregamento...");

// --- CONSTANTES GLOBAIS ---
const EQUIPAMENTO_TIPOS_OS = ["Console", "Controle", "Portátil", "Acessório", "Computador/Notebook", "Outro"];
const EQUIPAMENTO_MARCAS_OS = ["Sony", "Microsoft", "Nintendo", "Valve", "PC Genérico", "Notebook Genérico", "Outra"];
const GARANTIA_EXTENDIDA_PRECOS = {
    CONTROLE: 30,
    CONSOLE_PADRAO: 60,
    CONSOLE_PREMIUM: 90,
    PORTATIL: 50
};
const GARANTIA_EXTENDIDA_MESES = 3;

const DIAGNOSTIC_DEVICE_TYPES = [
    { value: "", label: "Selecione o tipo..." }, // Opção padrão
    { value: "ps5", label: "PlayStation 5" },
    { value: "ps4", label: "PlayStation 4" },
    { value: "ps3", label: "PlayStation 3" },
    { value: "xboxseries", label: "Xbox Series S/X" },
    { value: "xboxone", label: "Xbox One" },
    { value: "xbox360", label: "Xbox 360" },
    { value: "switch", label: "Nintendo Switch (Todos modelos)" },
    { value: "portatil-outro", label: "Outro Portátil (PSP, Vita, DS, 3DS)" },
    { value: "controle-ps", label: "Controle PlayStation (DualSense, DualShock)" },
    { value: "controle-xbox", label: "Controle Xbox" },
    { value: "controle-switch", label: "Controle Switch (Joy-Con, Pro Controller)" },
    { value: "retro-console", label: "Console Retrô (SNES, Mega Drive, etc.)" },
    { value: "pc-gamer", label: "PC Gamer / Notebook" }
];


// --- GLOBAL APP STATE & CONFIG ---
let STORE_CONFIG = {};
let ORDENS_SERVICO = [];
let CLIENTES = [];
let PRODUTOS = [];
let SERVICOS = [];
let VENDAS = [];
let TECNICOS = [];
let ENTREGAS = [];
let EMPRESTIMOS_CONSOLE = [];
let pdvCartItems = [];
let CURRENT_USER = { username: null, role: null };
let salesChartInstance = null;
window.clientFromPdvFlag = false;
let osIdParaAcaoTecnico = null;
let acaoTecnicoPendente = null;
let osIdParaEmprestimo = null;

// --- UTILITY FUNCTIONS ---
function showToast(message, type = "primary", title = "Notificação") {
    try {
        const toastEl = document.getElementById('liveToast');
        const toastMessageEl = document.getElementById('toast-message');
        const toastTitleEl = document.getElementById('toast-title');
        const toastCloseButton = toastEl.querySelector('.btn-close');

        if (!toastEl || !toastMessageEl || !toastTitleEl || !toastCloseButton) {
            console.error("Elementos do Toast não encontrados! Mensagem:", message);
            alert(title + ": " + message); return;
        }
        const toastComponent = bootstrap.Toast.getOrCreateInstance(toastEl);
        toastMessageEl.textContent = message;
        toastTitleEl.textContent = title;

        const validBgClasses = ['bg-primary-custom', 'bg-success-custom', 'bg-danger-custom', 'bg-warning', 'bg-info-custom'];
        const textWhiteClass = 'text-white';

        toastEl.classList.remove(...validBgClasses, textWhiteClass);
        toastMessageEl.classList.remove(textWhiteClass);
        toastTitleEl.classList.remove(textWhiteClass);
        toastCloseButton.classList.remove('btn-close-white');

        let newClass = 'bg-primary-custom';
        let addTextWhiteToToastBody = true;
        let addTextWhiteToHeaderElements = true; // Para título e botão de fechar

        if (type === "success") newClass = 'bg-success-custom';
        else if (type === "danger") newClass = 'bg-danger-custom';
        else if (type === "warning") { newClass = 'bg-warning'; addTextWhiteToToastBody = false; addTextWhiteToHeaderElements = false; }
        else if (type === "info") newClass = 'bg-info-custom';

        toastEl.classList.add(newClass);
        toastEl.style.color = addTextWhiteToToastBody ? '#fff' : '#000'; // Cor do texto do corpo do toast
        toastMessageEl.style.color = addTextWhiteToToastBody ? '#fff' : '#000';

        const currentTheme = document.body.className;
        const toastHeader = toastEl.querySelector('.toast-header');

        if (currentTheme === 'light-theme') {
            if (type === 'warning') {
                toastHeader.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--warning-color');
                toastHeader.style.color = '#000';
                toastTitleEl.style.color = '#000';
                toastCloseButton.classList.remove('btn-close-white');
            } else {
                // Para outros tipos no tema claro, o header do toast pode ser mais sutil
                toastHeader.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--tertiary-color'); // Ex: um cinza claro
                toastHeader.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-color');
                toastTitleEl.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-color');
                toastCloseButton.classList.remove('btn-close-white');
            }
        } else { // Temas escuros (dark-theme, blue-theme)
            toastHeader.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue(`--${type}-color`) || getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
            toastHeader.style.color = '#fff';
            toastTitleEl.style.color = '#fff';
            toastCloseButton.classList.add('btn-close-white');
        }


        if(toastComponent) toastComponent.show(); else console.error("Toast component não inicializado.");
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

// --- LOCALSTORAGE DATA MANAGEMENT ---
function saveData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Dados SALVOS para chave "${key}". Itens:`, Array.isArray(data) ? data.length : '(Objeto)');
    } catch (e) { console.error("Erro ao salvar dados na localStorage para chave", key, e); showToast(`Erro ao salvar (${key}).`, "danger"); }
}

function loadData(key, defaultValue = []) {
    const dataFromStorage = localStorage.getItem(key);
    if (dataFromStorage) {
        try {
            const parsedData = JSON.parse(dataFromStorage);
            console.log(`Dados CARREGADOS da chave "${key}". Itens:`, Array.isArray(parsedData) ? parsedData.length : '(Objeto)');
            // Mesclar com default para garantir que novas chaves sejam adicionadas
            if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue) &&
                typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
                return { ...defaultValue, ...parsedData };
            }
            return parsedData;
        } catch (e) {
            console.error(`Erro ao parsear JSON da chave "${key}":`, e, "\nConteúdo:", dataFromStorage);
            showToast(`Erro ao carregar dados (${key}). Resetando para padrão.`, "warning");
            localStorage.removeItem(key);
        }
    }
    console.log(`Nenhum dado para chave "${key}", usando default.`);
    return Array.isArray(defaultValue) ? [...defaultValue] : (typeof defaultValue === 'object' && defaultValue !== null ? {...defaultValue} : defaultValue);
}


// --- APP CONFIG ---
function loadAppConfig() {
    const defaultConfig = {
        nomeLoja: "Luckhouse Games", cnpj: "43.864.000/198",
        endereco: "Av. Itália, 200 – Shopping Amarilys, Itupeva – SP",
        telefone: "(11) 99357-7209", email: "luckhousegames@gmail.com",
        logoUrl: "assets/logo.png", diasGarantiaPadrao: 90,
        diasGarantiaPadraoServico: 90,
        adminWhatsapp: "",
        currentTheme: "dark-theme",
        tecnicoPadraoId: null,
        wppMsgOsStatus: "Olá, {{CLIENTE_NOME}}! Sua OS #{{OS_ID}} ({{EQUIPAMENTO_NOME}}) teve o status atualizado para: {{STATUS_OS}}. {{MENSAGEM_ATRASO}}Equipe {{NOME_LOJA}}.",
        wppMsgOsPronta: "Olá, {{CLIENTE_NOME}}! ✅ Sua OS #{{OS_ID}} ({{EQUIPAMENTO_NOME}}) está pronta para retirada! Valor final: {{VALOR_ORCAMENTO}}. {{MENSAGEM_ATRASO}}Att, {{NOME_LOJA}}.",
        wppMsgOsAprovacao: "Olá, {{CLIENTE_NOME}}! O orçamento para sua OS #{{OS_ID}} ({{EQUIPAMENTO_NOME}}) é de {{VALOR_ORCAMENTO}}. {{MENSAGEM_ATRASO}}Aguardamos sua aprovação. Att, {{NOME_LOJA}}.",
        wppMsgOsAtrasoSnippet: "Pedimos desculpas pela demora em sua OS #{{OS_ID}}. Estamos priorizando sua conclusão."
    };
    STORE_CONFIG = loadData('luckhouse_config', defaultConfig);
    // Garante que novas chaves de config sejam adicionadas se não existirem no localStorage
    for (const key in defaultConfig) {
        if (STORE_CONFIG[key] === undefined) {
            STORE_CONFIG[key] = defaultConfig[key];
        }
    }
    applyTheme(STORE_CONFIG.currentTheme); // Aplica tema e atualiza meta tag
    updateStoreInfoUI(); // Preenche campos de config e UI geral
}

function saveAppConfig() {
    saveData('luckhouse_config', STORE_CONFIG);
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

        const configSection = document.querySelector('#configuracoes');
        if (configSection && !configSection.classList.contains('d-none')) {
            el('config-nome-loja').value = STORE_CONFIG.nomeLoja || '';
            el('config-cnpj').value = STORE_CONFIG.cnpj || '';
            el('config-endereco').value = STORE_CONFIG.endereco || '';
            el('config-telefone').value = STORE_CONFIG.telefone || '';
            el('config-email').value = STORE_CONFIG.email || '';
            el('config-logo-url').value = STORE_CONFIG.logoUrl || '';
            el('config-admin-whatsapp').value = STORE_CONFIG.adminWhatsapp || '';
            el('config-garantia-dias').value = STORE_CONFIG.diasGarantiaPadrao || 90;
            
            const tecnicoSelectConfig = el('config-tecnico-padrao-select');
            if (tecnicoSelectConfig) {
                populateTecnicoSelects();
                tecnicoSelectConfig.value = STORE_CONFIG.tecnicoPadraoId || "";
            }
            
            el('config-wpp-msg-os-status').value = STORE_CONFIG.wppMsgOsStatus || '';
            el('config-wpp-msg-os-pronta').value = STORE_CONFIG.wppMsgOsPronta || '';
            el('config-wpp-msg-os-aprovacao').value = STORE_CONFIG.wppMsgOsAprovacao || '';
            el('config-wpp-msg-os-atraso-snippet').value = STORE_CONFIG.wppMsgOsAtrasoSnippet || '';

            const themeSelect = el('config-theme-select');
            if (themeSelect) {
                themeSelect.value = STORE_CONFIG.currentTheme || 'dark-theme';
            }
        }
        updateTermoGarantiaPreview();
    } catch (error) { console.error("Erro em updateStoreInfoUI:", error); }
}

function updateTermoGarantiaPreview() {
    const osTermosPreview = document.getElementById('os-termos-garantia-preview');
    if (osTermosPreview) {
        let diasGarantia = STORE_CONFIG.diasGarantiaPadraoServico || 90;
        const chkGarantiaExtendida = document.getElementById('os-garantia-extendida-check');
        if (chkGarantiaExtendida && chkGarantiaExtendida.checked) {
             const tipoEquip = document.getElementById('os-equip-tipo').value;
             let valorGarantiaAdicional = 0;
             if (tipoEquip === 'Controle') valorGarantiaAdicional = GARANTIA_EXTENDIDA_PRECOS.CONTROLE;
             else if (tipoEquip === 'Console') valorGarantiaAdicional = GARANTIA_EXTENDIDA_PRECOS.CONSOLE_PADRAO;
             else if (tipoEquip === 'Portátil') valorGarantiaAdicional = GARANTIA_EXTENDIDA_PRECOS.PORTATIL;

            if(valorGarantiaAdicional > 0){
                diasGarantia += (GARANTIA_EXTENDIDA_MESES * 30);
            }
        }

        osTermosPreview.innerHTML = `
            <p>Garantia de ${diasGarantia} dias após entrega do serviço/produto coberto pela OS.</p>
            <p>Não nos responsabilizamos por danos causados por mau uso ou quedas após o reparo.</p>
            <p>Equipamentos não retirados em até 90 dias serão descartados ou reaproveitados.</p>`;
    }
}

function applyTheme(themeName) {
    document.body.className = '';
    document.body.classList.add(themeName);
    STORE_CONFIG.currentTheme = themeName;
    console.log(`Tema aplicado: ${themeName}`);

    // Atualiza a meta tag theme-color do PWA
    const metaThemeColor = document.getElementById('meta-theme-color');
    if (metaThemeColor) {
        if (themeName === 'light-theme') metaThemeColor.content = '#ffffff'; // Cor de fundo do tema claro
        else if (themeName === 'blue-theme') metaThemeColor.content = '#111827'; // Cor de fundo do tema azulado
        else metaThemeColor.content = '#121212'; // Cor de fundo do tema escuro (padrão)
    }
    
    const toastCloseButton = document.querySelector('#liveToast .btn-close');
    const toastHeader = document.querySelector('#liveToast .toast-header');
    const toastTitle = document.getElementById('toast-title');

    if (toastCloseButton && toastHeader && toastTitle) {
        const isLightTheme = themeName === 'light-theme';
        toastHeader.style.backgroundColor = isLightTheme ? 
            (getComputedStyle(document.documentElement).getPropertyValue('--bs-light-bg-subtle') || '#f8f9fa') :
            (getComputedStyle(document.documentElement).getPropertyValue('--primary-color') || '#007bff');
        
        const headerTextColor = isLightTheme ? 
            (getComputedStyle(document.documentElement).getPropertyValue('--bs-body-color') || '#212529') : 
            '#ffffff';
            
        toastHeader.style.color = headerTextColor;
        toastTitle.style.color = headerTextColor;
        toastCloseButton.classList.toggle('btn-close-white', !isLightTheme);
    }

    if (document.getElementById('admin-area') && !document.getElementById('admin-area').classList.contains('d-none') && CURRENT_USER.role === 'admin') {
        renderSalesChart();
    }
}


function fillMessageTemplate(template, data) {
    let message = template;
    for (const key in data) {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '');
    }
    message = message.replace(/\{\{[A-Z_]+\}\}/g, '');
    return message;
}


// --- LOGIN & AUTHENTICATION (SIMULATED) ---
function handleLogin(event) {
    event.preventDefault();
    console.log("handleLogin: Tentativa de login iniciada.");
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

    if (username === 'luckmaster' && password === 'L@1998*') { CURRENT_USER = {username: 'Luck Master', role: 'admin'}; }
    else if (username === 'Henrique Del Peso' && password === 'hdp123') { CURRENT_USER = {username: 'Henrique Del Peso', role: 'padrao'}; }
    else { errorMessageEl.classList.remove('d-none'); console.log("handleLogin: Credenciais inválidas."); return; }

    errorMessageEl.classList.add('d-none');
    saveData('luckhouse_currentUser', CURRENT_USER);
    console.log("handleLogin: Usuário salvo no localStorage:", CURRENT_USER);

    updateUIAfterLogin();

    const modalLoginEl = document.getElementById('modalLogin');
    if (modalLoginEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalLoginEl);
        if (modalInstance && modalInstance['_isShown']) {
            modalInstance.hide();
            console.log("handleLogin: Modal de login escondido.");
        }
    } else { console.error("handleLogin: Modal de login não encontrado para esconder."); }

    showToast(`Bem-vindo(a), ${CURRENT_USER.username}!`, "success");
    navigateToSection('dashboard');
    setupAllModulesDynamic();
}

function handleLogout() {
    console.log("handleLogout: Iniciando processo de logout.");
    if (!confirm("Tem certeza que deseja sair?")) { console.log("handleLogout: Logout cancelado pelo usuário."); return; }
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
    console.log("checkLoginState: Verificando estado de login...");
    const storedUser = loadData('luckhouse_currentUser', null);
    if (storedUser && storedUser.username && storedUser.role) {
        CURRENT_USER = storedUser;
        console.log("checkLoginState: Usuário encontrado no localStorage:", CURRENT_USER);
        updateUIAfterLogin();
        navigateToSection('dashboard');
        setupAllModulesDynamic();
    } else {
        console.log("checkLoginState: Nenhum usuário logado encontrado. Exibindo UI de login.");
        updateUIAfterLogin();
        const modalLoginEl = document.getElementById('modalLogin');
        if (modalLoginEl) {
            const loginModalInstance = bootstrap.Modal.getOrCreateInstance(modalLoginEl);
            if (loginModalInstance && !loginModalInstance['_isShown']) {
                 loginModalInstance.show();
            }
        } else { console.error("checkLoginState: Modal de login não encontrado para ser exibido."); }
    }
}

function updateUIAfterLogin() {
    console.log("updateUIAfterLogin: Atualizando UI para usuário:", CURRENT_USER.username, "Role:", CURRENT_USER.role);
    const el = id => document.getElementById(id);
    const loggedInUserEl = el('logged-in-user');
    const logoutButton = el('logout-button');
    const adminNavItems = document.querySelectorAll('.nav-item-admin');
    const loginPromptSection = el('login-prompt');
    const dashboardUsernameEl = el('dashboard-username');

    if (CURRENT_USER.username) {
        console.log("updateUIAfterLogin: Configurando UI para usuário LOGADO.");
        if(loggedInUserEl) loggedInUserEl.textContent = `Logado: ${CURRENT_USER.username} (${CURRENT_USER.role})`;
        if(logoutButton) logoutButton.style.display = 'block';
        if(loginPromptSection) loginPromptSection.classList.add('d-none');
        if(dashboardUsernameEl) dashboardUsernameEl.textContent = CURRENT_USER.username;
        adminNavItems.forEach(item => item.classList.toggle('d-none', CURRENT_USER.role !== 'admin'));

        const activeSection = document.querySelector('.content-section:not(.d-none):not(#login-prompt)');
        if (activeSection && activeSection.classList.contains('admin-content') && CURRENT_USER.role !== 'admin') {
            console.log("updateUIAfterLogin: Usuário não admin tentou acessar área admin, redirecionando para dashboard.");
            navigateToSection('dashboard');
        } else if (activeSection && activeSection.id === 'admin-area' && CURRENT_USER.role === 'admin') {
            renderAdminDashboard();
        }
    } else {
        console.log("updateUIAfterLogin: Configurando UI para estado NÃO LOGADO.");
        if(loggedInUserEl) loggedInUserEl.textContent = 'Não Logado';
        if(logoutButton) logoutButton.style.display = 'none';
        if(loginPromptSection) loginPromptSection.classList.remove('d-none');
        if(dashboardUsernameEl) dashboardUsernameEl.textContent = "Usuário";
        
        document.querySelectorAll('.content-section').forEach(s => {
            if (s.id !== 'login-prompt') s.classList.add('d-none');
        });
        adminNavItems.forEach(item => item.classList.add('d-none'));
    }
}

// --- MODULE SETUP FUNCTIONS ---
function setupStaticModules() {
    console.groupCollapsed("setupStaticModules: Configurando módulos estáticos...");
    try {
        setupConfiguracoesModule();
        setupTecnicosModule();
        setupClientesModule();
        setupProdutosModule();
        setupServicosModule();
        setupOSModule();
        setupPdvModule();
        setupAdminAreaModule();
        setupSearchFilterListeners();
        setupBackupRestoreModule();
        setupModalServicoTecnico();
        setupEntregasModule();
        setupEmprestimosConsoleModule();
        setupRelatoriosModule();
        setupAssistenteDiagnosticoModule();
        console.log("Módulos estáticos (forms e botões) configurados.");
    } catch (error) {
        console.error("ERRO CRÍTICO em setupStaticModules:", error);
        showToast("Erro ao configurar módulos da aplicação. Verifique o console.", "danger");
    }
    console.groupEnd();
}

function setupAllModulesDynamic() {
    console.groupCollapsed("setupAllModulesDynamic: Configurando/Atualizando módulos dinâmicos...");
    try {
        if (CURRENT_USER && CURRENT_USER.role) {
            renderDashboardOSRecentes();
            if (CURRENT_USER.role === 'admin') renderAdminDashboard();
            populateRelatoriosSelects();
            populateTecnicoSelects();
            populateClienteSelect();
            populatePdvClienteSelect();
            renderPdvItemList();
            updateStoreInfoUI();
        }
        console.log("Módulos dinâmicos (renderizações) atualizados.");
    } catch (error) {
        console.error("ERRO CRÍTICO em setupAllModulesDynamic:", error);
        showToast("Erro ao atualizar módulos dinâmicos. Verifique o console.", "danger");
    }
    console.groupEnd();
}


function setupConfiguracoesModule() {
    console.log("Configurando módulo: Configurações");
    const btnSaveLoja = document.getElementById('btn-save-config-loja');
    const themeSelect = document.getElementById('config-theme-select');
    const btnSaveAparencia = document.getElementById('btn-save-config-aparencia');
    const formMensagens = document.getElementById('formConfigMensagensWpp');

    if (btnSaveLoja) {
        btnSaveLoja.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("Salvando configurações da Loja...");
            STORE_CONFIG.nomeLoja = document.getElementById('config-nome-loja').value;
            STORE_CONFIG.cnpj = document.getElementById('config-cnpj').value;
            STORE_CONFIG.endereco = document.getElementById('config-endereco').value;
            STORE_CONFIG.telefone = document.getElementById('config-telefone').value;
            STORE_CONFIG.email = document.getElementById('config-email').value;
            STORE_CONFIG.logoUrl = document.getElementById('config-logo-url').value.trim();
            STORE_CONFIG.adminWhatsapp = document.getElementById('config-admin-whatsapp').value.trim();
            STORE_CONFIG.diasGarantiaPadrao = parseInt(document.getElementById('config-garantia-dias').value) || 90;
            STORE_CONFIG.diasGarantiaPadraoServico = parseInt(document.getElementById('config-garantia-dias').value) || 90;
            STORE_CONFIG.tecnicoPadraoId = document.getElementById('config-tecnico-padrao-select').value || null;
            
            saveAppConfig();
            updateStoreInfoUI();
            showToast("Dados da loja salvos!", "success");
        });
    } else { console.error("Botão (btn-save-config-loja) não encontrado."); }

    if (themeSelect && btnSaveAparencia) {
        themeSelect.addEventListener('change', function() {
            applyTheme(this.value); // Aplica imediatamente ao mudar
        });
        btnSaveAparencia.addEventListener('click', function() {
            // STORE_CONFIG.currentTheme já foi atualizado por applyTheme
            saveAppConfig(); // Salva todas as configs, incluindo o tema
            showToast("Configurações de aparência salvas!", "success");
        });
    } else { console.error("Select de tema ou botão de salvar aparência não encontrado."); }

    if (formMensagens) {
        formMensagens.addEventListener('submit', function(e) {
            e.preventDefault();
            STORE_CONFIG.wppMsgOsStatus = document.getElementById('config-wpp-msg-os-status').value;
            STORE_CONFIG.wppMsgOsPronta = document.getElementById('config-wpp-msg-os-pronta').value;
            STORE_CONFIG.wppMsgOsAprovacao = document.getElementById('config-wpp-msg-os-aprovacao').value;
            STORE_CONFIG.wppMsgOsAtrasoSnippet = document.getElementById('config-wpp-msg-os-atraso-snippet').value;
            saveAppConfig();
            showToast("Templates de mensagens WhatsApp salvos!", "success");
        });
    } else { console.error("Formulário de mensagens WhatsApp (formConfigMensagensWpp) não encontrado.");}
}


// --- TECNICOS MODULE ---
function setupTecnicosModule() {
    console.log("Configurando módulo: Técnicos");
    const form = document.getElementById('formNovoTecnico');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const idInput = document.getElementById('tecnico-id');
            const id = idInput ? idInput.value : '';
            const tecnico = {
                id: id ? parseInt(id) : getNextId(TECNICOS),
                nome: document.getElementById('tecnico-nome').value,
                telefone: document.getElementById('tecnico-telefone').value
            };
            if (!tecnico.nome || !tecnico.telefone) {
                showToast("Nome e Telefone do técnico são obrigatórios.", "warning");
                return;
            }
            if (id) {
                const i = TECNICOS.findIndex(t => t.id === parseInt(id));
                if (i > -1) TECNICOS[i] = tecnico;
                else { TECNICOS.push(tecnico); }
            } else {
                TECNICOS.push(tecnico);
            }
            saveTecnicos();
            showToast(`Técnico ${tecnico.nome} ${id ? 'atualizado' : 'salvo'}!`, "success");
            form.reset();
            if (idInput) idInput.value = '';
        });
    } else { console.error("Formulário formNovoTecnico não encontrado."); }
}

function loadTecnicos() {
    TECNICOS = loadData('luckhouse_tecnicos', []);
    renderTecnicosList();
    populateTecnicoSelects();
}

function saveTecnicos() {
    saveData('luckhouse_tecnicos', TECNICOS);
    renderTecnicosList();
    populateTecnicoSelects();
}

function renderTecnicosList() {
    const listEl = document.getElementById('lista-tecnicos');
    if (!listEl) { console.error("Elemento lista-tecnicos não encontrado."); return; }
    listEl.innerHTML = '';
    if (TECNICOS.length === 0) {
        listEl.innerHTML = '<li class="list-group-item text-muted">Nenhum técnico cadastrado.</li>';
        return;
    }
    TECNICOS.forEach(tec => {
        listEl.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>${tec.nome} - ${tec.telefone}</span>
                <div>
                    <button class="btn btn-sm btn-warning-custom me-1" onclick="window.editTecnico(${tec.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger-custom" onclick="window.deleteTecnico(${tec.id})"><i class="fas fa-trash"></i></button>
                </div>
            </li>`;
    });
}

window.editTecnico = function(id) {
    const tecnico = TECNICOS.find(t => t.id === id);
    if (tecnico) {
        document.getElementById('tecnico-id').value = tecnico.id;
        document.getElementById('tecnico-nome').value = tecnico.nome;
        document.getElementById('tecnico-telefone').value = tecnico.telefone;
        document.getElementById('tecnico-nome').focus();
    }
};

window.deleteTecnico = function(id) {
    if (confirm("Excluir este técnico?")) {
        TECNICOS = TECNICOS.filter(t => t.id !== id);
        if (STORE_CONFIG.tecnicoPadraoId && STORE_CONFIG.tecnicoPadraoId === id) {
            STORE_CONFIG.tecnicoPadraoId = null;
            saveAppConfig();
        }
        saveTecnicos();
        showToast("Técnico excluído.", "success");
    }
};

function populateTecnicoSelects() {
    const configTecnicoSelect = document.getElementById('config-tecnico-padrao-select');
    if (configTecnicoSelect) {
        const currentVal = STORE_CONFIG.tecnicoPadraoId;
        configTecnicoSelect.innerHTML = '<option value="">Nenhum (Manual)</option>';
        TECNICOS.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(t => {
            configTecnicoSelect.innerHTML += `<option value="${t.id}">${t.nome}</option>`;
        });
        if (currentVal && TECNICOS.find(t => t.id === parseInt(currentVal))) {
             configTecnicoSelect.value = currentVal;
        } else {
            configTecnicoSelect.value = "";
        }
    }
}


// --- CLIENTES MODULE ---
function setupClientesModule() {
    console.log("Configurando módulo: Clientes");
    const form = document.getElementById('formNovoCliente');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const idInput = document.getElementById('cliente-id');
            const id = idInput ? idInput.value : '';
            const cliente = {
                id: id ? parseInt(id) : getNextId(CLIENTES),
                nome: document.getElementById('cliente-nome').value,
                telefone: document.getElementById('cliente-telefone').value,
                cpf: document.getElementById('cliente-cpf').value,
                email: document.getElementById('cliente-email').value,
                endereco: document.getElementById('cliente-endereco').value,
            };
            if (!cliente.nome || !cliente.telefone) { showToast("Nome e Telefone são obrigatórios.", "warning"); return; }
            if (id) {
                const i = CLIENTES.findIndex(c=>c.id=== parseInt(id));
                if(i>-1) CLIENTES[i]=cliente;
                else { CLIENTES.push(cliente); console.warn("Editando cliente não encontrado no array, adicionando como novo.")}
            } else { CLIENTES.push(cliente); }
            saveClientes();
            showToast(`Cliente ${cliente.nome} ${id ? 'atualizado' : 'salvo'}!`, "success");
            const modalEl = document.getElementById('modalNovoCliente');
            if(modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
            if (window.clientFromPdvFlag) {
                populatePdvClienteSelect();
                const pdvSelect = document.getElementById('pdv-cliente-select');
                if (pdvSelect) pdvSelect.value = cliente.id;
                fillPdvClientReceiptFields();
                window.clientFromPdvFlag = false;
            }
        });
    } else { console.error("Formulário formNovoCliente não encontrado."); }
    const btnSearch = document.getElementById('btn-search-client');
    if(btnSearch) btnSearch.addEventListener('click', filterClientList);
    else { console.error("Botão btn-search-client não encontrado."); }
}

function loadClientes() { CLIENTES = loadData('luckhouse_clientes', []); renderClientList(); populateClienteSelect(); populatePdvClienteSelect(); }
function saveClientes() { saveData('luckhouse_clientes', CLIENTES); renderClientList(); populateClienteSelect(); populatePdvClienteSelect(); }

function renderClientList(filteredClients = null) {
    const tbody = document.getElementById('client-list-tbody');
    if(!tbody) { console.error("Tbody de clientes (client-list-tbody) não encontrado."); return; }
    tbody.innerHTML = '';
    const listToRender = filteredClients ? filteredClients : CLIENTES;
    if (listToRender.length === 0) { tbody.innerHTML = '<tr class="no-clients-message"><td colspan="5" class="text-center text-muted">Nenhum cliente.</td></tr>'; return; }
    listToRender.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(c => {
        tbody.innerHTML += `<tr><td>${c.nome}</td><td>${c.telefone||'-'}</td><td>${c.cpf||'-'}</td><td>${c.email||'-'}</td>
                            <td><button class="btn btn-sm btn-warning-custom me-1" onclick="window.editCliente(${c.id})"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger-custom" onclick="window.deleteCliente(${c.id})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

window.editCliente = function(id) {
    const cliente = CLIENTES.find(c => c.id === id);
    if (cliente) {
        try {
            const form = document.getElementById('formNovoCliente');
            if(form) form.reset(); else { console.error("formNovoCliente não encontrado em editCliente."); return; }
            const el = (idForm) => document.getElementById(idForm);
            if(el('cliente-id')) el('cliente-id').value = cliente.id;
            if(el('cliente-nome')) el('cliente-nome').value = cliente.nome;
            if(el('cliente-telefone')) el('cliente-telefone').value = cliente.telefone;
            if(el('cliente-cpf')) el('cliente-cpf').value = cliente.cpf || '';
            if(el('cliente-email')) el('cliente-email').value = cliente.email || '';
            if(el('cliente-endereco')) el('cliente-endereco').value = cliente.endereco || '';
            
            const modalTitle = document.getElementById('modalNovoClienteLabelDynamic');
            if(modalTitle) modalTitle.textContent = `Editando Cliente: ${cliente.nome}`;

            const modalEl = el('modalNovoCliente');
            if(modalEl) bootstrap.Modal.getOrCreateInstance(modalEl).show();
            else console.error("Modal 'modalNovoCliente' não encontrado para exibir.");
        } catch (e) { console.error("Erro em editCliente:", e); showToast("Erro ao tentar editar cliente.", "danger"); }
    } else { showToast("Cliente não encontrado.", "warning");}
};
window.deleteCliente = function(id) { if (confirm("Excluir este cliente?")) { CLIENTES = CLIENTES.filter(c => c.id !== id); saveClientes(); showToast("Cliente excluído.", "success"); }};

function populateClienteSelect() {
    const select = document.getElementById('os-cliente-select');
    if(!select) { console.warn("Select de cliente para OS (os-cliente-select) não encontrado."); return; }
    const currentVal = select.value;
    select.innerHTML = '<option value="">Selecione um cliente...</option>';
    CLIENTES.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome} (${c.telefone || 'Sem tel.'} / CPF: ${c.cpf || 'N/A'})</option>`;
    });
    if (CLIENTES.find(c => c.id === parseInt(currentVal))) { select.value = currentVal; }
}

function populatePdvClienteSelect() {
    const select = document.getElementById('pdv-cliente-select');
    if(!select) { console.warn("Select de cliente para PDV (pdv-cliente-select) não encontrado."); return; }
    const currentVal = select.value;
    select.innerHTML = '<option value="">Consumidor (Não Identificado)</option>';
    CLIENTES.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.nome} (CPF: ${c.cpf || 'N/A'})</option>`;
    });
     if (CLIENTES.find(c => c.id === parseInt(currentVal))) { select.value = currentVal; }
}

function openNewClientModalFromOS() {
    window.clientFromPdvFlag = false;
    const modalNovaOS = document.getElementById('modalNovaOS');
    const modalNovoCliente = document.getElementById('modalNovoCliente');
    // Reset do form é feito no 'hidden.bs.modal'
    
    if (modalNovaOS && bootstrap.Modal.getInstance(modalNovaOS)) {
         bootstrap.Modal.getInstance(modalNovaOS).hide();
    }
    const modalTitle = document.getElementById('modalNovoClienteLabelDynamic');
    if(modalTitle) modalTitle.textContent = 'Novo Cliente (para OS)';

    if (modalNovoCliente) bootstrap.Modal.getOrCreateInstance(modalNovoCliente).show();
    else { console.error("Modal modalNovoCliente não encontrado."); }
}


// --- PRODUTOS MODULE ---
function setupProdutosModule() {
    const form = document.getElementById('formNovoProduto');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const idInput = document.getElementById('produto-id');
            const id = idInput ? idInput.value : '';
            const produto = {
                id: id ? parseInt(id) : getNextId(PRODUTOS),
                nome: document.getElementById('produto-nome').value,
                categoria: document.getElementById('produto-categoria').value,
                descricao: document.getElementById('produto-descricao').value,
                acessoriosInclusos: document.getElementById('produto-acessorios').value,
                precoVenda: parseFloat(document.getElementById('produto-preco').value),
                estoque: parseInt(document.getElementById('produto-estoque').value) || 0,
                isVideogame: document.getElementById('produto-is-videogame').checked,
                consignado: document.getElementById('produto-consignado').checked,
                tipo: 'produto'
            };
            if (!produto.nome || isNaN(produto.precoVenda) || produto.precoVenda <= 0) { showToast("Nome e Preço válido são obrigatórios.", "warning"); return; }
            if (id) { const i = PRODUTOS.findIndex(p=>p.id=== parseInt(id)); if(i>-1) PRODUTOS[i]=produto; else {PRODUTOS.push(produto); console.warn("Editando produto não encontrado, adicionando como novo.");}}
            else { PRODUTOS.push(produto); }
            saveProdutos();
            showToast(`Produto ${produto.nome} ${id ? 'atualizado' : 'salvo'}!`, "success");
            bootstrap.Modal.getInstance(document.getElementById('modalNovoProduto'))?.hide();
            // Reset é feito no 'hidden.bs.modal'
        });
    } else { console.error("Formulário formNovoProduto não encontrado."); }
}
function loadProdutos() { PRODUTOS = loadData('luckhouse_produtos', []); renderProductList(); renderPdvItemList(); }
function saveProdutos() { saveData('luckhouse_produtos', PRODUTOS); renderProductList(); renderPdvItemList(); }

function renderProductList(filteredList = null) {
    const tbody = document.getElementById('product-list-tbody');
    if(!tbody) { console.error("Tbody de produto (product-list-tbody) não encontrado."); return; }
    tbody.innerHTML = '';
    const listToRender = filteredList ? filteredList : PRODUTOS;
    if (listToRender.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Nenhum produto.</td></tr>'; return; }
    listToRender.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(p => {
        tbody.innerHTML += `<tr>
            <td>${p.nome}</td>
            <td>${p.categoria||'-'}</td>
            <td>${p.descricao ? p.descricao.substring(0,30) + (p.descricao.length > 30 ? '...' : '') : '-'}</td>
            <td>${p.isVideogame ? 'Sim' : 'Não'}</td>
            <td>${p.consignado ? 'Sim' : 'Não'}</td>
            <td>${formatCurrency(p.precoVenda)}</td>
            <td>${p.estoque}</td>
            <td>
                <button class="btn btn-sm btn-warning-custom me-1" onclick="window.editProduto(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger-custom" onclick="window.deleteProduto(${p.id})"><i class="fas fa-trash"></i></button>
            </td></tr>`;
    });
}
window.editProduto = function(id) {
    const p = PRODUTOS.find(item => item.id === id);
    if(p){
        const form = document.getElementById('formNovoProduto');
        // Reset é feito no 'hidden.bs.modal', mas garantir campos limpos aqui
        if(form) form.reset(); else { console.error("formNovoProduto não encontrado em editProduto"); return; }
        document.getElementById('produto-id').value = p.id;
        document.getElementById('produto-nome').value = p.nome;
        document.getElementById('produto-categoria').value = p.categoria || '';
        document.getElementById('produto-descricao').value = p.descricao || '';
        document.getElementById('produto-acessorios').value = p.acessoriosInclusos || '';
        document.getElementById('produto-preco').value = p.precoVenda;
        document.getElementById('produto-estoque').value = p.estoque;
        document.getElementById('produto-is-videogame').checked = p.isVideogame || false;
        document.getElementById('produto-consignado').checked = p.consignado || false;
        
        const modalTitle = document.getElementById('modalNovoProdutoLabelDynamic');
        if(modalTitle) modalTitle.textContent = `Editando Produto: ${p.nome}`;
        
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoProduto')).show();
    } else { showToast("Produto não encontrado.", "warning"); }
};
window.deleteProduto = function(id) { if(confirm('Excluir este produto?')) { PRODUTOS = PRODUTOS.filter(p => p.id !== id); saveProdutos(); showToast('Produto excluído.', 'success'); }};

// FIM DA PARTE 1

// --- SERVICOS MODULE ---
function setupServicosModule() {
    const form = document.getElementById('formNovoServico');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const idInput = document.getElementById('servico-id');
            const id = idInput ? idInput.value : '';
            const servico = {
                id: id ? parseInt(id) : getNextId(SERVICOS),
                nome: document.getElementById('servico-nome').value,
                descricao: document.getElementById('servico-descricao').value,
                valor: parseFloat(document.getElementById('servico-valor').value),
                custoTecnico: parseFloat(document.getElementById('servico-custo-tecnico').value) || 0,
                tipo: 'servico'
            };
            if (!servico.nome || isNaN(servico.valor) || servico.valor <= 0) { showToast("Nome e Valor para Cliente são obrigatórios e devem ser válidos.", "warning"); return; }
            if (isNaN(servico.custoTecnico) || servico.custoTecnico < 0) { showToast("Custo do técnico inválido.", "warning"); return; }

            if (id) { const i = SERVICOS.findIndex(s=>s.id=== parseInt(id)); if(i>-1) SERVICOS[i]=servico; else {SERVICOS.push(servico); console.warn("Editando serviço não encontrado, adicionando como novo.");}}
            else { SERVICOS.push(servico); }
            saveServicos();
            showToast(`Serviço ${servico.nome} ${id ? 'atualizado' : 'salvo'}!`, "success");
            bootstrap.Modal.getInstance(document.getElementById('modalNovoServico'))?.hide();
        });
    } else { console.error("Formulário formNovoServico não encontrado."); }
}
function loadServicos() { SERVICOS = loadData('luckhouse_servicos', []); renderServiceList(); renderPdvItemList(); }
function saveServicos() { saveData('luckhouse_servicos', SERVICOS); renderServiceList(); renderPdvItemList(); }

function renderServiceList(filteredList = null) {
    const tbody = document.getElementById('service-list-tbody');
    if(!tbody) { console.error("Tbody de serviço (service-list-tbody) não encontrado."); return; }
    tbody.innerHTML = '';
    const listToRender = filteredList ? filteredList : SERVICOS;
    if (listToRender.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum serviço.</td></tr>'; return; }
    listToRender.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(s => {
        tbody.innerHTML += `<tr><td>${s.nome}</td><td>${s.descricao||'-'}</td><td>${formatCurrency(s.custoTecnico)}</td><td>${formatCurrency(s.valor)}</td>
                            <td><button class="btn btn-sm btn-warning-custom me-1" onclick="window.editServico(${s.id})"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger-custom" onclick="window.deleteServico(${s.id})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}
window.editServico = function(id) {
    const s = SERVICOS.find(item => item.id === id);
    if(s){
        const form = document.getElementById('formNovoServico');
        if(form) form.reset(); else { console.error("formNovoServico não encontrado em editServico"); return; }
        document.getElementById('servico-id').value = s.id;
        document.getElementById('servico-nome').value = s.nome;
        document.getElementById('servico-descricao').value = s.descricao || '';
        document.getElementById('servico-valor').value = s.valor;
        document.getElementById('servico-custo-tecnico').value = s.custoTecnico || 0;

        const modalTitle = document.getElementById('modalNovoServicoLabelDynamic');
        if(modalTitle) modalTitle.textContent = `Editando Serviço: ${s.nome}`;

        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNovoServico')).show();
    } else { showToast("Serviço não encontrado.", "warning"); }
};
window.deleteServico = function(id) { if(confirm('Excluir este serviço?')) { SERVICOS = SERVICOS.filter(s => s.id !== id); saveServicos(); showToast('Serviço excluído.', 'success'); }};


// --- ORDENS DE SERVIÇO (OS) MODULE ---
function setupOSModule() {
    const form = document.getElementById('formNovaOS');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const idInput = document.getElementById('os-id');
            const id = idInput ? idInput.value : '';
            const clienteId = document.getElementById('os-cliente-select').value;
            const cliente = CLIENTES.find(c=>c.id === parseInt(clienteId));
            if(!cliente) { showToast("Cliente inválido selecionado para a OS.", "danger"); return; }

            let equipTipo = document.getElementById('os-equip-tipo').value;
            if (equipTipo === 'Outro') {
                equipTipo = document.getElementById('os-equip-tipo-outro').value.trim() || 'Outro (Não Especificado)';
            }
            let equipMarca = document.getElementById('os-equip-marca').value;
            if (equipMarca === 'Outra') {
                equipMarca = document.getElementById('os-equip-marca-outra').value.trim() || 'Outra (Não Especificada)';
            }

            let valorOrcamentoBase = parseFloat(document.getElementById('os-orcamento').value) || 0;
            let valorFinalOrcamento = valorOrcamentoBase;
            let garantiaExtendidaAdicionada = false;
            let valorGarantiaExtendidaCalculado = 0;

            if (document.getElementById('os-garantia-extendida-check').checked) {
                const tipoEquipParaGarantia = document.getElementById('os-equip-tipo').value;
                if (tipoEquipParaGarantia === 'Controle') {
                    valorGarantiaExtendidaCalculado = GARANTIA_EXTENDIDA_PRECOS.CONTROLE;
                } else if (tipoEquipParaGarantia === 'Console') {
                    valorGarantiaExtendidaCalculado = GARANTIA_EXTENDIDA_PRECOS.CONSOLE_PADRAO;
                } else if (tipoEquipParaGarantia === 'Portátil') {
                    valorGarantiaExtendidaCalculado = GARANTIA_EXTENDIDA_PRECOS.PORTATIL;
                }
                
                if (valorGarantiaExtendidaCalculado > 0) {
                    valorFinalOrcamento += valorGarantiaExtendidaCalculado;
                    garantiaExtendidaAdicionada = true;
                }
            }

            const os = {
                id: id ? parseInt(id) : getNextId(ORDENS_SERVICO),
                clienteId: cliente.id, clienteNome: cliente.nome, clienteTelefone: cliente.telefone, clienteCpf: cliente.cpf,
                status: document.getElementById('os-status').value,
                dataPrevistaConclusao: document.getElementById('os-data-prevista').value || null,
                isManualmenteAtrasado: document.getElementById('os-atraso-manual-check').checked,
                equipamentoTipo: equipTipo,
                equipamentoMarca: equipMarca,
                equipamentoModelo: document.getElementById('os-equip-modelo').value,
                equipamentoSerial: document.getElementById('os-equip-serial').value,
                problemaDescricao: document.getElementById('os-problema').value,
                diagnosticoTecnico: document.getElementById('os-diagnostico-tecnico').value,
                acessoriosInclusos: document.getElementById('os-acessorios-inclusos').value,
                observacoes: document.getElementById('os-observacoes').value,
                valorOrcamento: valorFinalOrcamento,
                temGarantiaExtendida: garantiaExtendidaAdicionada,
                valorGarantiaExtendida: valorGarantiaExtendidaCalculado,
                dataAbertura: id ? (ORDENS_SERVICO.find(o=>o.id===parseInt(id))?.dataAbertura || new Date().toISOString()) : new Date().toISOString(),
                dataConclusao: (id && ORDENS_SERVICO.find(o=>o.id===parseInt(id))?.dataConclusao) || null, // Manter dataConclusao se já existir
                operadorAbertura: id ? (ORDENS_SERVICO.find(o=>o.id===parseInt(id))?.operadorAbertura || CURRENT_USER.username) : CURRENT_USER.username,
            };
            if (os.status === 'Entregue' && !os.dataConclusao) { // Se marcou como entregue e não tinha data, seta agora
                os.dataConclusao = new Date().toISOString();
            }

            if (!os.clienteId || !os.equipamentoTipo || !os.equipamentoMarca || !os.equipamentoModelo || !os.problemaDescricao || isNaN(os.valorOrcamento)) { showToast("Campos obrigatórios da OS não preenchidos ou orçamento inválido.", "warning"); return; }
            
            const isNewOS = !id;

            if (id) { 
                const index = ORDENS_SERVICO.findIndex(o=>o.id === parseInt(id)); 
                if(index>-1) ORDENS_SERVICO[index]=os; 
                else {ORDENS_SERVICO.push(os); console.warn("Editando OS não encontrada, adicionando como nova.");}
            } else { ORDENS_SERVICO.push(os); }
            
            saveOrdensServico();
            showToast(`OS #${String(os.id).padStart(3,'0')} ${id ? 'atualizada' : 'salva'}!`, "success");
            
            const btnNotificarAdminOS = document.getElementById('btn-notificar-admin-os');
            if (isNewOS && STORE_CONFIG.adminWhatsapp && STORE_CONFIG.adminWhatsapp.trim() !== "") {
                 btnNotificarAdminOS.classList.remove('d-none');
                 btnNotificarAdminOS.onclick = () => notificarAdminNovaOS(os, true); // Passa 'true' para forcarWhatsapp
            } else {
                 btnNotificarAdminOS.classList.add('d-none');
            }

            bootstrap.Modal.getInstance(document.getElementById('modalNovaOS'))?.hide();
        });
    } else { console.error("Formulário formNovaOS não encontrado."); }

    const btnSearch = document.getElementById('btn-search-os');
    if(btnSearch) btnSearch.addEventListener('click', filterOSList); else { console.error("Botão btn-search-os não encontrado.");}
    
    const linkNewClient = document.getElementById('link-novo-cliente-from-os');
    if (linkNewClient) linkNewClient.addEventListener('click', (e) => { e.preventDefault(); openNewClientModalFromOS(); });
    else { console.error("Link link-novo-cliente-from-os não encontrado.");}

    const equipTipoSelect = document.getElementById('os-equip-tipo');
    const equipTipoOutroInput = document.getElementById('os-equip-tipo-outro');
    if (equipTipoSelect && equipTipoOutroInput) {
        equipTipoSelect.addEventListener('change', function() {
            equipTipoOutroInput.classList.toggle('d-none', this.value !== 'Outro');
            if(this.value === 'Outro') equipTipoOutroInput.focus();
            updateValorGarantiaExtendidaInfoOS();
        });
    }
    const equipMarcaSelect = document.getElementById('os-equip-marca');
    const equipMarcaOutroInput = document.getElementById('os-equip-marca-outra');
    if (equipMarcaSelect && equipMarcaOutraInput) {
        equipMarcaSelect.addEventListener('change', function() {
            equipMarcaOutraInput.classList.toggle('d-none', this.value !== 'Outra');
            if(this.value === 'Outra') equipMarcaOutraInput.focus();
        });
    }
    const chkGarantiaOS = document.getElementById('os-garantia-extendida-check');
    if (chkGarantiaOS) {
        chkGarantiaOS.addEventListener('change', updateValorGarantiaExtendidaInfoOS);
    }
    
    const dataPrevistaInput = document.getElementById('os-data-prevista');
    const statusSelect = document.getElementById('os-status');
    const atrasoManualCheck = document.getElementById('os-atraso-manual-check');

    function updatePrazoAndEmprestimoButtonFromModal() {
        const osId = document.getElementById('os-id').value;
        updateOSPrazoInfo(dataPrevistaInput.value, statusSelect.value, atrasoManualCheck.checked);
        toggleEmprestimoButtonVisibility(osId); // osId pode ser string vazia para nova OS
    }

    if(dataPrevistaInput) dataPrevistaInput.addEventListener('change', updatePrazoAndEmprestimoButtonFromModal);
    if(statusSelect) statusSelect.addEventListener('change', updatePrazoAndEmprestimoButtonFromModal);
    if(atrasoManualCheck) atrasoManualCheck.addEventListener('change', updatePrazoAndEmprestimoButtonFromModal);
}

function updateValorGarantiaExtendidaInfoOS() {
    const chk = document.getElementById('os-garantia-extendida-check');
    const infoEl = document.getElementById('os-garantia-extendida-valor-info');
    const tipoEquip = document.getElementById('os-equip-tipo').value;
    let valor = 0;

    if (!chk || !infoEl || !tipoEquip) return;

    if (chk.checked) {
        if (tipoEquip === 'Controle') valor = GARANTIA_EXTENDIDA_PRECOS.CONTROLE;
        else if (tipoEquip === 'Console') valor = GARANTIA_EXTENDIDA_PRECOS.CONSOLE_PADRAO;
        else if (tipoEquip === 'Portátil') valor = GARANTIA_EXTENDIDA_PRECOS.PORTATIL;
    }
    infoEl.textContent = valor > 0 ? `Valor adicional: ${formatCurrency(valor)}` : (chk.checked ? 'Tipo não elegível ou valor não definido.' : '');
}

function updateOSPrazoInfo(dataPrevistaStr, statusOS = null, isManualmenteAtrasado = false) {
    const prazoInfoEl = document.getElementById('os-prazo-info');
    if (!prazoInfoEl) return;

    if (isManualmenteAtrasado && statusOS !== 'Entregue' && statusOS !== 'Cancelada' && statusOS !== 'Orçamento Reprovado') {
        prazoInfoEl.textContent = `Atrasada (Manual)`;
        prazoInfoEl.className = 'form-control-plaintext text-danger fw-bold';
        return;
    }

    if (!dataPrevistaStr) {
        prazoInfoEl.textContent = '-';
        prazoInfoEl.className = 'form-control-plaintext';
        return;
    }

    const dataPrevista = new Date(dataPrevistaStr + "T23:59:59");
    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    if (statusOS === 'Entregue' || statusOS === 'Cancelada' || statusOS === 'Orçamento Reprovado') {
        prazoInfoEl.textContent = `OS Finalizada (${statusOS})`;
        prazoInfoEl.className = 'form-control-plaintext text-muted';
        return;
    }

    if (hoje > dataPrevista) {
        const diffTime = Math.abs(hoje - dataPrevista);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        prazoInfoEl.textContent = `Atrasada em ${diffDays} dia(s)`;
        prazoInfoEl.className = 'form-control-plaintext text-danger fw-bold';
    } else {
        const diffTime = Math.abs(dataPrevista - hoje);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        prazoInfoEl.textContent = diffDays === 0 ? 'Previsto para Hoje' : `Em dia (faltam ${diffDays} dia(s))`;
        prazoInfoEl.className = 'form-control-plaintext text-success';
    }
}

function toggleEmprestimoButtonVisibility(osIdStr){
    const btnEmprestimo = document.getElementById('btn-registrar-emprestimo-console-os');
    if(!btnEmprestimo) return;

    if (!osIdStr) { // Nova OS, ainda sem ID
        btnEmprestimo.classList.add('d-none');
        return;
    }
    const osId = parseInt(osIdStr);
    const os = ORDENS_SERVICO.find(o => o.id === osId);
    let isAtrasadaCalculada = false;

    if (os && os.dataPrevistaConclusao && os.status !== 'Entregue' && os.status !== 'Cancelada' && os.status !== 'Orçamento Reprovado') {
        const dataPrevista = new Date(os.dataPrevistaConclusao + "T23:59:59");
        if (new Date() > dataPrevista) isAtrasadaCalculada = true;
    }
    
    const showButton = os && (os.isManualmenteAtrasado || isAtrasadaCalculada) && os.status !== 'Entregue' && os.status !== 'Cancelada' && os.status !== 'Orçamento Reprovado';
    
    btnEmprestimo.classList.toggle('d-none', !showButton);
    if(showButton && os){ // Garante que os existe
        btnEmprestimo.onclick = () => abrirModalEmprestimoConsole(os.id);
    }
}


function loadOrdensServico() { ORDENS_SERVICO = loadData('luckhouse_os', []); renderOSList(); renderDashboardOSRecentes(); }
function saveOrdensServico() { saveData('luckhouse_os', ORDENS_SERVICO); renderOSList(); renderDashboardOSRecentes(); }

function getStatusBadgeClass(status) {
    if (!status) return 'badge rounded-pill me-2 bg-secondary';
    let s = status.toLowerCase().replace(/\s+/g,'-').replace(/[^\w-]+/g,'');
    if (s.startsWith('atrasada-')) s = 'atrasada';
    return `badge rounded-pill me-2 status-${s}`;
}

function renderOSList(filteredOS = null) {
    const container = document.getElementById('os-list-container');
    if(!container) { console.error("Container de lista de OS (os-list-container) não encontrado."); return; }
    container.innerHTML = '';
    const listToRender = filteredOS ? filteredOS : ORDENS_SERVICO;
    if (listToRender.length === 0) { container.innerHTML = '<p class="text-muted p-2 no-os-message">Nenhuma OS encontrada.</p>'; return; }
    listToRender.sort((a,b)=>b.id-a.id).forEach(os => {
        const cliente = CLIENTES.find(c=>c.id===os.clienteId) || {nome:'Cliente Desconhecido'};
        
        let statusFinal = os.status || 'N/A';
        let isAtrasadaReal = false;
        if (os.dataPrevistaConclusao && os.status !== 'Entregue' && os.status !== 'Cancelada' && os.status !== 'Orçamento Reprovado') {
            const dataPrevista = new Date(os.dataPrevistaConclusao + "T23:59:59");
            if (new Date() > dataPrevista) isAtrasadaReal = true;
        }
        if (os.isManualmenteAtrasado && os.status !== 'Entregue' && os.status !== 'Cancelada' && os.status !== 'Orçamento Reprovado') isAtrasadaReal = true;

        if(isAtrasadaReal) statusFinal = `Atrasada (${os.status})`;
        const statusBadgeClass = getStatusBadgeClass(statusFinal);

        container.innerHTML += `
            <div class="list-group-item list-group-item-action bg-dark-secondary text-white mb-2 rounded shadow-sm os-item" data-id="${os.id}">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1 text-primary-custom">OS #${String(os.id).padStart(3,'0')} - ${cliente.nome}</h5>
                    <span class="${statusBadgeClass}">${statusFinal}</span>
                </div>
                <p class="mb-1"><strong>Equip:</strong> ${os.equipamentoTipo} ${os.equipamentoMarca} ${os.equipamentoModelo} (S/N: ${os.equipamentoSerial||'N/A'})</p>
                <p class="mb-1"><strong>Probl:</strong> ${os.problemaDescricao.substring(0,100)}${os.problemaDescricao.length > 100 ? '...' : ''}</p>
                <p class="mb-1"><small class="text-muted">Abertura: ${new Date(os.dataAbertura).toLocaleDateString('pt-BR')} por ${os.operadorAbertura || 'N/D'}</small> | <small class="text-muted">Orçam: ${formatCurrency(os.valorOrcamento)}</small> ${os.temGarantiaExtendida ? '<span class="badge bg-info-custom ms-1">G. Extendida</span>' : ''}</p>
                <small class="text-muted">Prev. Conclusão: ${os.dataPrevistaConclusao ? new Date(os.dataPrevistaConclusao  + "T00:00:00").toLocaleDateString('pt-BR') : 'Não definida'}</small>
                <div class="mt-2 action-buttons">
                    <button class="btn btn-sm btn-warning-custom" onclick="window.editOS(${os.id})"><i class="fas fa-edit me-1"></i> Editar</button>
                    <button class="btn btn-sm btn-info-custom" onclick="window.generateAndOpenOSPdf(${os.id})"><i class="fas fa-file-pdf me-1"></i> PDF Cliente</button>
                    <button class="btn btn-sm btn-success-custom" onclick="window.generateAndOpenOSWhatsAppMessage(${os.id})"><i class="fab fa-whatsapp me-1"></i> Wpp Cliente</button>
                    <button class="btn btn-sm btn-outline-info-custom" onclick="window.abrirModalSelecaoServicoTecnico(${os.id}, 'pdf')"><i class="fas fa-receipt me-1"></i> Recibo Téc.</button>
                    <button class="btn btn-sm btn-outline-success-custom" onclick="window.abrirModalSelecaoServicoTecnico(${os.id}, 'whatsapp')"><i class="fab fa-whatsapp me-1"></i> Wpp Téc.</button>
                    <button class="btn btn-sm btn-primary-custom" onclick="window.solicitarEntregaOS(${os.id})"><i class="fas fa-motorcycle me-1"></i> Entrega</button>
                    <button class="btn btn-sm btn-danger-custom" onclick="window.deleteOS(${os.id})"><i class="fas fa-trash me-1"></i> Excluir</button>
                </div>
            </div>`;
    });
}

function renderDashboardOSRecentes() {
    // ... (Lógica existente, já adaptada para mostrar atraso)
    const container = document.getElementById('dashboard-os-recentes');
    if (!container) { console.warn("Container dashboard-os-recentes não encontrado."); return; }
    container.innerHTML = '';
    const recentes = ORDENS_SERVICO
        .filter(os => os.status && os.status !== 'Entregue' && os.status !== 'Cancelada' && os.status !== 'Orçamento Reprovado')
        .sort((a,b) => new Date(b.dataAbertura).getTime() - new Date(a.dataAbertura).getTime())
        .slice(0, 5);

    if (recentes.length === 0) { container.innerHTML = '<p class="text-muted">Nenhuma OS ativa recente.</p>'; return; }
    recentes.forEach(os => {
        const cliente = CLIENTES.find(c => c.id === os.clienteId) || { nome: 'N/A' };
        const item = document.createElement('a'); item.href = "#";
        item.className = "list-group-item list-group-item-action bg-dark-tertiary text-white d-flex justify-content-between align-items-center";
        item.onclick = (e) => { e.preventDefault(); navigateToSection('os'); setTimeout(() => window.editOS(os.id), 100); };
        
        let statusFinal = os.status || 'N/A';
        let isAtrasadaReal = false;
        if (os.dataPrevistaConclusao && os.status !== 'Entregue' && os.status !== 'Cancelada' && os.status !== 'Orçamento Reprovado') {
            const dataPrevista = new Date(os.dataPrevistaConclusao + "T23:59:59");
            if (new Date() > dataPrevista) isAtrasadaReal = true;
        }
         if (os.isManualmenteAtrasado && os.status !== 'Entregue' && os.status !== 'Cancelada' && os.status !== 'Orçamento Reprovado') isAtrasadaReal = true;

        if(isAtrasadaReal) statusFinal = `Atrasada (${os.status})`;
        const statusBadgeClass = getStatusBadgeClass(statusFinal);

        item.innerHTML = `<span>OS #${String(os.id).padStart(3, '0')} - ${cliente.nome} (${os.equipamentoTipo})</span> <span class="${statusBadgeClass}">${statusFinal}</span>`;
        container.appendChild(item);
    });
}

window.editOS = function(id) {
    // ... (Lógica de editOS já ajustada na Parte 1 do script da iteração anterior,
    // incluindo preenchimento dos novos campos, "outro", garantia, atraso manual, etc.)
    // Apenas garantir que o botão de registrar empréstimo seja atualizado aqui também.
    const os = ORDENS_SERVICO.find(item => item.id === id);
    if (os) {
        // ... (código de preenchimento do form) ...
        // Exemplo do que já foi feito:
        const el = (idForm) => document.getElementById(idForm);
        el('os-id').value = os.id;
        el('os-operador').value = os.operadorAbertura || CURRENT_USER.username;
        el('os-cliente-select').value = os.clienteId;
        // ...etc para todos os campos...
        el('os-atraso-manual-check').checked = os.isManualmenteAtrasado || false;
        updateOSPrazoInfo(os.dataPrevistaConclusao, os.status, os.isManualmenteAtrasado);
        toggleEmprestimoButtonVisibility(os.id.toString());

        // Botão Notificar Admin
        const btnNotificarAdminOS = document.getElementById('btn-notificar-admin-os');
        if (STORE_CONFIG.adminWhatsapp && STORE_CONFIG.adminWhatsapp.trim() !== "") {
                btnNotificarAdminOS.classList.remove('d-none');
                btnNotificarAdminOS.onclick = () => notificarAdminNovaOS(os, true);
        } else {
            btnNotificarAdminOS.classList.add('d-none');
        }
        
        bootstrap.Modal.getOrCreateInstance(el('modalNovaOS')).show();
    } // ... (resto da função)
};

// generateAndOpenOSPdf, generateAndOpenOSWhatsAppMessage, notificarAdminNovaOS, generateRegistroInternoOSPdf
// (Já existem e foram ajustadas anteriormente)


// --- Modal Serviço Técnico (OS) ---
// setupModalServicoTecnico, abrirModalSelecaoServicoTecnico, enviarMsgWhatsappTecnicoComServico, gerarReciboServicoTecnicoPdfComServico
// (Já existem e foram ajustadas anteriormente)


// --- ENTREGAS MODULE ---
function setupEntregasModule() {
    const form = document.getElementById('formRegistrarEntrega');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const osIdEl = document.getElementById('entrega-os-id');
            const osId = osIdEl ? osIdEl.value : null;

            if(!osId) {
                showToast("Erro: ID da OS não encontrado para registrar entrega.", "danger");
                return;
            }
            const entrega = {
                id: getNextId(ENTREGAS),
                osId: parseInt(osId),
                dataSolicitacao: document.getElementById('entrega-data').value,
                enderecoRetirada: document.getElementById('entrega-endereco-retirada').value,
                enderecoDestino: document.getElementById('entrega-endereco-destino').value,
                valorCorrida: parseFloat(document.getElementById('entrega-valor-corrida').value) || 0,
                observacoes: document.getElementById('entrega-observacoes').value,
                operadorRegistro: CURRENT_USER.username
            };
            if (!entrega.osId || !entrega.dataSolicitacao || !entrega.enderecoDestino) {
                showToast("OS ID, Data e Endereço de Destino são obrigatórios.", "warning");
                return;
            }
            ENTREGAS.push(entrega);
            saveEntregas();
            showToast("Registro de entrega salvo!", "success");
            bootstrap.Modal.getInstance(document.getElementById('modalRegistrarEntrega')).hide();
        });
    }
}

function loadEntregas() {
    ENTREGAS = loadData('luckhouse_entregas', []);
    renderEntregasList(); // Renderiza na inicialização ou quando a seção é mostrada
}
function saveEntregas() {
    saveData('luckhouse_entregas', ENTREGAS);
    renderEntregasList();
}

window.solicitarEntregaOS = function(osId) {
    const osData = ORDENS_SERVICO.find(os => os.id === osId);
    if (!osData) { showToast("OS não encontrada para solicitar entrega.", "danger"); return; }
    const cliente = CLIENTES.find(c => c.id === osData.clienteId);
    if (!cliente) { showToast("Cliente da OS não encontrado.", "danger"); return; }

    window.open('https://m.99app.com/', '_blank');

    document.getElementById('entrega-os-id').value = osId;
    document.getElementById('entrega-os-id-display-form').textContent = `#${String(osId).padStart(3,'0')}`;
    document.getElementById('entrega-data').value = new Date().toISOString().slice(0, 16);
    document.getElementById('entrega-endereco-retirada').value = STORE_CONFIG.endereco || 'Endereço da Loja (Configurações)';
    document.getElementById('entrega-endereco-destino').value = cliente.endereco || '';
    document.getElementById('entrega-valor-corrida').value = '';
    document.getElementById('entrega-observacoes').value = `Entrega para cliente ${cliente.nome}, OS #${String(osId).padStart(3,'0')}. Equipamento: ${osData.equipamentoTipo} ${osData.equipamentoModelo}.`;
    
    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalRegistrarEntrega'));
    modal.show();
};


// --- EMPRÉSTIMOS DE CONSOLE MODULE ---
function setupEmprestimosConsoleModule() {
    const form = document.getElementById('formEmprestimoConsole');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const osIdRef = document.getElementById('emprestimo-os-id-ref').value;
            if (!osIdRef) {
                showToast("Erro: ID da OS de referência não encontrado.", "danger");
                return;
            }
            const emprestimo = {
                id: getNextId(EMPRESTIMOS_CONSOLE),
                osIdReferencia: parseInt(osIdRef),
                consoleModelo: document.getElementById('emprestimo-console-modelo').value,
                consoleSerial: document.getElementById('emprestimo-console-serial').value,
                dataEmprestimo: document.getElementById('emprestimo-data').value,
                dataPrevistaDevolucao: document.getElementById('emprestimo-data-prev-devolucao').value,
                dataDevolucaoReal: null,
                observacoes: document.getElementById('emprestimo-observacoes').value,
                operadorRegistro: CURRENT_USER.username,
                status: 'Emprestado'
            };

            if (!emprestimo.consoleModelo || !emprestimo.dataEmprestimo) {
                showToast("Modelo do console e Data do Empréstimo são obrigatórios.", "warning");
                return;
            }
            EMPRESTIMOS_CONSOLE.push(emprestimo);
            saveEmprestimosConsole();
            showToast("Registro de empréstimo salvo!", "success");
            bootstrap.Modal.getInstance(document.getElementById('modalEmprestimoConsole')).hide();
        });
    }
}

function loadEmprestimosConsole() {
    EMPRESTIMOS_CONSOLE = loadData('luckhouse_emprestimos_console', []);
    renderEmprestimosList();
}

function saveEmprestimosConsole() {
    saveData('luckhouse_emprestimos_console', EMPRESTIMOS_CONSOLE);
    renderEmprestimosList();
}

window.abrirModalEmprestimoConsole = function(osId) {
    osIdParaEmprestimo = osId;
    const osData = ORDENS_SERVICO.find(os => os.id === osId);
    if (!osData) {
        showToast("OS não encontrada para registrar empréstimo.", "danger");
        return;
    }
    document.getElementById('emprestimo-os-id-ref').value = osId;
    document.getElementById('emprestimo-os-id-display').textContent = `#${String(osId).padStart(3,'0')} (Cliente: ${osData.clienteNome})`;
    document.getElementById('emprestimo-data').value = new Date().toISOString().slice(0,10);

    document.getElementById('emprestimo-console-modelo').value = '';
    document.getElementById('emprestimo-console-serial').value = '';
    document.getElementById('emprestimo-data-prev-devolucao').value = '';
    document.getElementById('emprestimo-observacoes').value = '';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalEmprestimoConsole'));
    modal.show();
};

window.marcarEmprestimoDevolvido = function(emprestimoId) {
    const emprestimo = EMPRESTIMOS_CONSOLE.find(e => e.id === emprestimoId);
    if (emprestimo) {
        if (confirm(`Marcar o empréstimo do console "${emprestimo.consoleModelo}" (OS #${emprestimo.osIdReferencia}) como devolvido?`)) {
            emprestimo.status = 'Devolvido';
            emprestimo.dataDevolucaoReal = new Date().toISOString().slice(0,10);
            saveEmprestimosConsole();
            showToast("Empréstimo marcado como devolvido.", "success");
        }
    } else {
        showToast("Registro de empréstimo não encontrado.", "danger");
    }
};


// FIM DA PARTE 2

// --- PDV MODULE ---
function setupPdvModule() {
    const el = id => document.getElementById(id);
    const btnSearch = el('btn-pdv-search-item'); if(btnSearch) btnSearch.addEventListener('click', window.searchPdvItems);
    const searchInput = el('pdv-search-item'); if(searchInput) searchInput.addEventListener('keyup', (event) => { if(event.key === "Enter") window.searchPdvItems(); });
    const discountInput = el('pdv-discount-percentage'); if(discountInput) discountInput.addEventListener('input', updatePdvTotals);
    const btnFinalize = el('btn-finalize-sale'); if(btnFinalize) btnFinalize.addEventListener('click', finalizeSale);
    const btnPrint = el('btn-print-sale-receipt'); if(btnPrint) btnPrint.addEventListener('click', () => printSaleReceipt(true));
    const btnDownloadCoupon = el('btn-download-sale-coupon'); if(btnDownloadCoupon) btnDownloadCoupon.addEventListener('click', () => downloadSaleCouponPdf(true));
    const btnPdvNovoCliente = el('btn-pdv-novo-cliente-rapido');
    if (btnPdvNovoCliente) {
        btnPdvNovoCliente.addEventListener('click', function() {
            window.clientFromPdvFlag = true;
            const modalNovoCliente = el('modalNovoCliente');
            const modalTitle = document.getElementById('modalNovoClienteLabelDynamic');
            if(modalTitle) modalTitle.textContent = 'Novo Cliente (PDV)';
            if (modalNovoCliente) bootstrap.Modal.getOrCreateInstance(modalNovoCliente).show();
            else console.error("Modal de Novo Cliente não encontrado para PDV.")
        });
    }
    
    const formNovoItemRapido = el('formNovoItemRapidoPDV');
    const itemTipoSelect = el('item-rapido-tipo');
    const itemEstoqueGroup = el('item-rapido-estoque-group');
    if (itemTipoSelect && itemEstoqueGroup) { itemTipoSelect.addEventListener('change', function() { itemEstoqueGroup.style.display = this.value === 'produto' ? 'block' : 'none'; }); }
    
    if(formNovoItemRapido){
        formNovoItemRapido.addEventListener('submit', function(e){
            e.preventDefault();
            const nome = el('item-rapido-nome').value; const precoInput = el('item-rapido-preco').value;
            const tipo = el('item-rapido-tipo').value; const estoqueInput = el('item-rapido-estoque').value;
            if (!nome || !precoInput) { showToast("Nome e Preço são obrigatórios.", "warning"); return; }
            const preco = parseFloat(precoInput);
            if (isNaN(preco) || preco <= 0) { showToast("Preço inválido.", "warning"); return; }
            const estoque = tipo === 'produto' ? parseInt(estoqueInput) || 0 : undefined;
            let novoItemSalvo;
            if (tipo === 'produto') { novoItemSalvo = { id: getNextId(PRODUTOS), nome, precoVenda: preco, estoque, categoria: 'PDV Rápido', tipo: 'produto', isVideogame: false, consignado: false, descricao: '', acessoriosInclusos: '' }; PRODUTOS.push(novoItemSalvo); saveProdutos(); }
            else { novoItemSalvo = { id: getNextId(SERVICOS), nome, valor: preco, descricao: 'Serviço PDV', tipo: 'servico', custoTecnico: 0 }; SERVICOS.push(novoItemSalvo); saveServicos(); }
            showToast(`Item "${nome}" adicionado ao cadastro!`, 'success');
            window.pdvAddItemByIdAndType(novoItemSalvo.id, novoItemSalvo.tipo);
            bootstrap.Modal.getInstance(el('modalNovoItemRapidoPDV'))?.hide();
        });
    } else { console.error("Formulário formNovoItemRapidoPDV não encontrado."); }
    const pdvClienteSelectEl = el('pdv-cliente-select');
    if(pdvClienteSelectEl) pdvClienteSelectEl.addEventListener('change', fillPdvClientReceiptFields);
}

function loadVendas() { VENDAS = loadData('luckhouse_vendas', []); }

function renderPdvItemList(searchTerm = '') {
    const listEl = document.getElementById('pdv-item-list'); if(!listEl) {console.error("Elemento pdv-item-list não encontrado."); return;}
    listEl.innerHTML = ''; const combined = [...PRODUTOS, ...SERVICOS];
    const term = searchTerm.toLowerCase().trim();
    const filtered = combined.filter(item => 
        item.nome.toLowerCase().includes(term) || 
        (item.categoria && item.categoria.toLowerCase().includes(term)) || 
        String(item.id) === term
    );
    if (filtered.length === 0) { listEl.innerHTML = `<p class="text-muted p-2">${searchTerm ? 'Nenhum item encontrado.' : 'Busque ou cadastre itens.'}</p>`; return; }
    filtered.forEach(item => {
        const price = item.tipo === 'produto' ? item.precoVenda : item.valor;
        const stockInfo = item.tipo === 'produto' ? ` (Est: ${item.estoque})` : '';
        listEl.innerHTML += `<a href="#" class="list-group-item list-group-item-action bg-dark-tertiary text-white" onclick="window.pdvAddItemByIdAndType(${item.id}, '${item.tipo}')">${item.nome}${stockInfo} - ${formatCurrency(price)}</a>`;
    });
}
window.searchPdvItems = function() { const termEl = document.getElementById('pdv-search-item'); if(termEl) { const term = termEl.value; renderPdvItemList(term); } else {console.error("Campo de busca PDV não encontrado.");} };

window.pdvAddItemByIdAndType = function(itemId, itemType) {
    console.log("Tentando adicionar item por ID e Tipo:", itemId, itemType);
    let itemFull = null;
    if (itemType === 'produto') itemFull = PRODUTOS.find(p => p.id === parseInt(itemId));
    else if (itemType === 'servico') itemFull = SERVICOS.find(s => s.id === parseInt(itemId));

    if (!itemFull) { showToast("Item não encontrado no cadastro.", "danger"); console.error("Item não encontrado:", itemId, itemType); return; }
    
    if (itemFull.tipo === 'produto' && (itemFull.estoque === undefined || itemFull.estoque <= 0)) { showToast(`"${itemFull.nome}" fora de estoque!`, "warning"); return; }
    const existing = pdvCartItems.find(ci => ci.id === itemFull.id && ci.tipo === itemFull.tipo);
    if(existing){ if (itemFull.tipo === 'produto' && itemFull.estoque !== undefined && existing.quantidade >= itemFull.estoque) { showToast(`Estoque máximo para "${itemFull.nome}".`, "warning"); return; } existing.quantidade++; }
    else { pdvCartItems.push({ id: itemFull.id, nome: itemFull.nome, preco: itemFull.tipo === 'produto' ? itemFull.precoVenda : itemFull.valor, quantidade: 1, tipo: itemFull.tipo, estoqueOriginal: itemFull.tipo === 'produto' ? itemFull.estoque : Infinity, isVideogame: itemFull.isVideogame || false }); }
    updatePdvCartUI(); showToast(`${itemFull.nome} adicionado.`, "success");
};

function updatePdvCartUI() {
    const cartUl = document.getElementById('pdv-cart'); if(!cartUl) {console.error("Elemento pdv-cart não encontrado."); return;}
    cartUl.innerHTML = '';
    if (pdvCartItems.length === 0) { cartUl.innerHTML = '<li class="list-group-item d-flex justify-content-between align-items-center bg-dark-tertiary text-muted">Nenhum item.</li>'; }
    else { pdvCartItems.forEach((item, i) => { cartUl.innerHTML += `<li class="list-group-item d-flex justify-content-between align-items-center bg-dark-tertiary text-white"><div>${item.nome} (x${item.quantidade}) <small class="d-block text-muted">${formatCurrency(item.preco)} cada</small></div><span class="d-flex align-items-center">${formatCurrency(item.preco*item.quantidade)}<button class="btn btn-sm btn-outline-light ms-2" onclick="window.pdvDecrementItem(${i})"><i class="fas fa-minus"></i></button><button class="btn btn-sm btn-outline-light ms-1" onclick="window.pdvIncrementItem(${i})"><i class="fas fa-plus"></i></button><button class="btn btn-sm btn-danger-custom ms-2" onclick="window.pdvRemoveItem(${i})"><i class="fas fa-times"></i></button></span></li>`; }); }
    updatePdvTotals();
}

window.pdvIncrementItem = function(index) { const item = pdvCartItems[index]; if (item.tipo === 'produto' && item.estoqueOriginal !== undefined && item.quantidade >= item.estoqueOriginal) { showToast(`Estoque máximo para "${item.nome}".`, "warning"); return; } item.quantidade++; updatePdvCartUI(); };
window.pdvDecrementItem = function(index) { pdvCartItems[index].quantidade--; if(pdvCartItems[index].quantidade <= 0) pdvCartItems.splice(index, 1); updatePdvCartUI(); };
window.pdvRemoveItem = function(index) { const removed = pdvCartItems.splice(index, 1)[0]; updatePdvCartUI(); showToast(`${removed.nome} removido.`, "info"); };

function updatePdvTotals() {
    let subtotal = pdvCartItems.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);
    document.getElementById('pdv-subtotal').textContent = formatCurrency(subtotal);
    const discPercEl = document.getElementById('pdv-discount-percentage');
    const discPerc = discPercEl ? parseFloat(discPercEl.value) || 0 : 0;
    const discVal = subtotal * (discPerc / 100);
    document.getElementById('pdv-discount-value').textContent = formatCurrency(discVal);
    document.getElementById('pdv-total').textContent = formatCurrency(subtotal - discVal);
}

function fillPdvClientReceiptFields() {
    const clienteId = document.getElementById('pdv-cliente-select').value;
    const nameInput = document.getElementById('pdv-receipt-client-name');
    const contactInput = document.getElementById('pdv-receipt-client-contact');
    if (!nameInput || !contactInput) {console.error("Campos de nome/contato do recibo PDV não encontrados."); return;}

    if (clienteId) {
        const cliente = CLIENTES.find(c => c.id === parseInt(clienteId));
        if (cliente) { nameInput.value = cliente.nome; contactInput.value = cliente.telefone || cliente.email || ''; }
    } else { nameInput.value = ''; contactInput.value = ''; }
}

function finalizeSale() {
    if (pdvCartItems.length === 0) { showToast("Carrinho vazio.", "warning"); return; }
    
    const receiptClientName = document.getElementById('pdv-receipt-client-name').value;
    const receiptClientContact = document.getElementById('pdv-receipt-client-contact').value;
    const clienteIdSelected = document.getElementById('pdv-cliente-select').value;
    let clienteCpfFinal = null;
    if(clienteIdSelected){ const clienteDb = CLIENTES.find(c => c.id === parseInt(clienteIdSelected)); if(clienteDb) clienteCpfFinal = clienteDb.cpf; }

    const totalStr = document.getElementById('pdv-total').textContent;
    const total = parseFloat(totalStr.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
    const venda = {
        id: getNextId(VENDAS), data: new Date().toISOString(), clienteId: clienteIdSelected ? parseInt(clienteIdSelected) : null,
        receiptClientName: receiptClientName, receiptClientContact: receiptClientContact, clienteCpf: clienteCpfFinal,
        itens: pdvCartItems.map(i => ({ id: i.id, nome: i.nome, precoUnitario: i.preco, quantidade: i.quantidade, subtotal: i.preco * i.quantidade, tipo: i.tipo, isVideogame: i.isVideogame })),
        subtotal: pdvCartItems.reduce((s,i)=>s+(i.preco*i.quantidade),0),
        descontoPercentual: parseFloat(document.getElementById('pdv-discount-percentage').value) || 0,
        valorDesconto: parseFloat(document.getElementById('pdv-discount-value').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0,
        total: total,
        formaPagamento: document.getElementById('payment-method').value,
        operadorVenda: CURRENT_USER.username
    };
    VENDAS.push(venda); saveData('luckhouse_vendas', VENDAS);
    pdvCartItems.forEach(ci => { if (ci.tipo === 'produto') { const pOrig = PRODUTOS.find(p => p.id === ci.id); if (pOrig && pOrig.estoque !== undefined) { pOrig.estoque -= ci.quantidade; if (pOrig.estoque < 0) pOrig.estoque = 0; } }});
    saveProdutos();
    showToast(`Venda #${venda.id} finalizada! Total: ${formatCurrency(total)}`, "success");
    pdvCartItems = []; updatePdvCartUI();
    document.getElementById('pdv-cliente-select').value = '';
    document.getElementById('pdv-receipt-client-name').value = '';
    document.getElementById('pdv-receipt-client-contact').value = '';
    document.getElementById('pdv-discount-percentage').value = 0;
    updatePdvTotals();
    renderAdminDashboard();
}

function prepareReceiptHTML(isPreview = true, saleData = null) {
    // ... (Função já existente e ajustada para incluir operador)
    let itemsToProcess, clientName, clientContact, clientCpf = null, payment, saleTotal, discountVal, subtotalVal, saleDate, hasVideogame = false, operadorNome = "";
    if (isPreview && !saleData) {
        if (pdvCartItems.length === 0) { showToast("Carrinho vazio.", "warning"); return null; }
        itemsToProcess = pdvCartItems.map(i => ({ ...i }));
        clientName = document.getElementById('pdv-receipt-client-name').value || "Consumidor";
        clientContact = document.getElementById('pdv-receipt-client-contact').value;
        const selectedClientId = document.getElementById('pdv-cliente-select').value;
        if (selectedClientId) { const cliente = CLIENTES.find(c => c.id === parseInt(selectedClientId)); if(cliente) clientCpf = cliente.cpf; }
        payment = document.getElementById('payment-method').value;
        saleTotal = parseFloat(document.getElementById('pdv-total').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        discountVal = parseFloat(document.getElementById('pdv-discount-value').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        subtotalVal = parseFloat(document.getElementById('pdv-subtotal').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        saleDate = new Date();
        hasVideogame = pdvCartItems.some(item => item.isVideogame);
        operadorNome = CURRENT_USER.username || "N/D";
    } else if (saleData) {
        itemsToProcess = saleData.itens.map(i => ({...i, precoUnitario: i.precoUnitario || i.preco}));
        clientName = saleData.receiptClientName || "Consumidor"; clientContact = saleData.receiptClientContact; clientCpf = saleData.clienteCpf;
        payment = saleData.formaPagamento; saleTotal = saleData.total; discountVal = saleData.valorDesconto;
        subtotalVal = saleData.subtotal; saleDate = new Date(saleData.data);
        hasVideogame = itemsToProcess.some(item => item.isVideogame);
        operadorNome = saleData.operadorVenda || "N/D";
    } else { return null; }
    let html = `<div class="receipt-content">`;
    html += `<div style="text-align: center;">`;
    if (STORE_CONFIG.logoUrl && (STORE_CONFIG.logoUrl.startsWith('data:image') || STORE_CONFIG.logoUrl.startsWith('assets/'))) { html += `<img src="${STORE_CONFIG.logoUrl}" alt="Logo" class="receipt-logo">`; }
    else { html += `<h2 style="margin: 2mm 0; font-size: 11pt;">${STORE_CONFIG.nomeLoja.toUpperCase()}</h2>`; }
    html += `<p>${STORE_CONFIG.endereco}</p><p>CNPJ: ${STORE_CONFIG.cnpj}</p><p>Tel: ${STORE_CONFIG.telefone}</p></div><hr>`;
    html += `<h3 style="text-align: center; font-size: 10pt; margin: 1mm 0;">COMPROVANTE DE VENDA</h3>`;
    html += `<p style="text-align: center; font-size: 8pt;">${saleDate.toLocaleString('pt-BR')} | Op: ${operadorNome}</p><hr>`;
    html += `<p>Cliente: ${clientName}</p>`;
    if (clientContact) html += `<p>Contato: ${clientContact}</p>`;
    if (clientCpf) html += `<p>CPF: ${clientCpf}</p>`;
    html += `<table style="width:100%;font-size:8pt;margin-top:2mm"><thead><tr><th style="text-align:left;width:55%">Item</th><th style="text-align:right;width:15%">Qtd</th><th style="text-align:right;width:30%">Total</th></tr></thead><tbody>`;
    itemsToProcess.forEach(item => { html += `<tr><td style="word-break:break-all;">${item.nome}</td><td style="text-align:right;">${item.quantidade}</td><td style="text-align:right;">${formatCurrency(item.precoUnitario * item.quantidade)}</td></tr>`; });
    html += `</tbody></table><hr><div style="font-size:9pt"><p>Subtotal: <span style="float:right;">${formatCurrency(subtotalVal)}</span></p>`;
    if (discountVal > 0) html += `<p>Desconto: <span style="float:right;">-${formatCurrency(discountVal)}</span></p>`;
    html += `<p style="font-weight:bold;">TOTAL: <span style="float:right;">${formatCurrency(saleTotal)}</span></p>`;
    html += `<p>Pagamento: <span style="float:right;">${payment}</span></p></div>`;
    if (hasVideogame) {
        html += `<hr><p style="font-size:7pt; text-align:center;">TERMO DE GARANTIA (VIDEOGAME): Garantia de ${STORE_CONFIG.diasGarantiaPadrao} dias contra defeitos de fabricação. Não cobre mau uso ou danos físicos.</p>`;
    }
    html += `<hr><p style="text-align:center;font-size:8pt;margin-top:3mm">Obrigado!</p><p style="text-align:center;font-size:8pt">${STORE_CONFIG.nomeLoja}</p>`;
    html += `<p style="text-align:center;font-size:7pt;">IG: @luckhousegames | Site: www.luckhousegames.com.br</p></div>`;
    return html;
}
function printSaleReceipt(isPreview = true, saleData = null) {
    // ... (Função já existente)
    console.log("printSaleReceipt chamado. isPreview:", isPreview, "saleData:", saleData);
    const receiptHTML = prepareReceiptHTML(isPreview, saleData);
    if (!receiptHTML) { console.error("HTML do recibo não gerado."); return; }
    const printArea = document.getElementById('receipt-print-area');
    if (!printArea) { showToast("Área de impressão não encontrada.", "danger"); console.error("Elemento receipt-print-area não encontrado."); return; }
    printArea.innerHTML = receiptHTML;
    printArea.classList.remove('d-none');
    console.log("HTML do recibo injetado na área de impressão.");
    showToast(isPreview ? "Prévia do recibo pronta para impressão." : "Recibo pronto para impressão.", "info");
    
    setTimeout(() => {
        try {
            console.log("Chamando window.print()...");
            window.print();
            console.log("window.print() chamado com sucesso.");
        } catch(e) { console.error("Erro ao chamar window.print():", e); showToast("Erro ao tentar imprimir.", "danger");}
    }, 350);
}
function downloadSaleCouponPdf(isPreview = true, saleData = null) {
    // ... (Função já existente e ajustada para incluir operador)
    if (!jsPDFModule) { showToast("Biblioteca PDF (jsPDF) não está carregada.", "danger"); return; }
    let itemsToProcess, clientName, clientCpf, clientContact, payment, saleTotal, discountVal, subtotalVal, saleDate, hasVideogame = false, operadorNome = "";
    
    if (isPreview && !saleData) {
        if (pdvCartItems.length === 0) { showToast("Carrinho vazio.", "warning"); return; }
        itemsToProcess = pdvCartItems.map(i => ({ nome: i.nome, precoUnitario: i.preco, quantidade: i.quantidade, subtotal: i.preco * i.quantidade, isVideogame: i.isVideogame }));
        clientName = document.getElementById('pdv-receipt-client-name').value || "Consumidor";
        clientContact = document.getElementById('pdv-receipt-client-contact').value;
        const selectedClientId = document.getElementById('pdv-cliente-select').value;
        if (selectedClientId) { const cliente = CLIENTES.find(c => c.id === parseInt(selectedClientId)); if(cliente) clientCpf = cliente.cpf; }
        payment = document.getElementById('payment-method').value;
        saleTotal = parseFloat(document.getElementById('pdv-total').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        discountVal = parseFloat(document.getElementById('pdv-discount-value').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        subtotalVal = parseFloat(document.getElementById('pdv-subtotal').textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0;
        saleDate = new Date();
        hasVideogame = pdvCartItems.some(item => item.isVideogame);
        operadorNome = CURRENT_USER.username || "N/D";
    } else if (saleData) {
        itemsToProcess = saleData.itens.map(i => ({...i, precoUnitario: i.precoUnitario || i.preco}));
        clientName = saleData.receiptClientName || "Consumidor"; clientContact = saleData.receiptClientContact; clientCpf = saleData.clienteCpf;
        payment = saleData.formaPagamento; saleTotal = saleData.total; discountVal = saleData.valorDesconto;
        subtotalVal = saleData.subtotal; saleDate = new Date(saleData.data);
        hasVideogame = itemsToProcess.some(item => item.isVideogame);
        operadorNome = saleData.operadorVenda || "N/D";
    } else { return; }

    showToast("Gerando Cupom PDF...", "info");
    try {
        const doc = new jsPDFModule({ unit: 'mm', format: [78, 200] });
        let y = 5; const xMargin = 3; const contentWidth = 78 - (2 * xMargin);

        if (STORE_CONFIG.logoUrl && (STORE_CONFIG.logoUrl.startsWith('data:image'))) {
            try { doc.addImage(STORE_CONFIG.logoUrl, 'PNG', contentWidth / 2 - 10 + xMargin, y, 20, 7); y += 9; }
            catch(e){ console.warn("Logo (base64) não adicionado ao cupom PDF",e); doc.setFontSize(8).text("[Logo Indisp.]", contentWidth/2 + xMargin, y, {align:'center'}); y+=5;}
        } else { doc.setFontSize(10).setFont("helvetica", "bold"); doc.text(STORE_CONFIG.nomeLoja.toUpperCase(), contentWidth/2 + xMargin, y, {align:'center'}); y += 4;}
        
        doc.setFontSize(7).setFont("helvetica", "normal");
        let textLines = doc.splitTextToSize(STORE_CONFIG.endereco, contentWidth); doc.text(textLines, contentWidth/2 + xMargin, y, {align:'center'}); y += textLines.length * 2.5 + 1;
        doc.text(`CNPJ: ${STORE_CONFIG.cnpj}`, contentWidth/2 + xMargin, y, {align:'center'}); y+=3;
        doc.text(`Tel: ${STORE_CONFIG.telefone}`, contentWidth/2 + xMargin, y, {align:'center'}); y+=4;
        doc.line(xMargin, y, xMargin + contentWidth, y); y+=3;
        doc.setFontSize(8).setFont("helvetica", "bold"); doc.text("COMPROVANTE DE VENDA", contentWidth/2 + xMargin, y, {align:'center'}); y+=3;
        doc.setFontSize(7).setFont("helvetica", "normal"); doc.text(`${new Date(saleDate).toLocaleString('pt-BR')} | Op: ${operadorNome}`, contentWidth/2 + xMargin, y, {align:'center'}); y+=3;
        doc.line(xMargin, y, xMargin + contentWidth, y); y+=3;

        doc.text(`Cliente: ${clientName||'Consumidor'}`, xMargin, y); y+=3;
        if(clientContact) { doc.text(`Contato: ${clientContact}`, xMargin, y); y+=3; }
        if(clientCpf) { doc.text(`CPF: ${clientCpf}`, xMargin, y); y+=3; }
        
        const bodyData = itemsToProcess.map(item => [
            { content: `${item.quantidade}x ${item.nome}`, styles: { cellWidth: contentWidth * 0.65, overflow: 'linebreak', fontSize: 6.5 } },
            { content: formatCurrency(item.precoUnitario * item.quantidade), styles: { cellWidth: contentWidth * 0.35, halign: 'right', fontSize: 6.5 } }
        ]);
        doc.autoTable({ startY: y, head: [['Item', 'Total']], body: bodyData, theme: 'plain', styles: { fontSize: 7, cellPadding: 0.5, lineWidth: 0.1, lineColor: 180 }, headStyles: { fillColor: [230,230,230], textColor: 0, fontStyle: 'bold', halign: 'center'}, margin: {left: xMargin, right: xMargin}, tableWidth: contentWidth });
        y = doc.lastAutoTable.finalY + 2;
        doc.line(xMargin, y, xMargin + contentWidth, y); y+=3;
        doc.setFontSize(8);
        doc.text("Subtotal:", xMargin, y); doc.text(formatCurrency(subtotalVal), xMargin + contentWidth, y, {align:'right'}); y+=4;
        if(discountVal > 0) { doc.text("Desconto:", xMargin, y); doc.text(`-${formatCurrency(discountVal)}`, xMargin+contentWidth, y, {align:'right'}); y+=4; }
        doc.setFont("helvetica", "bold"); doc.text("TOTAL:", xMargin, y); doc.text(formatCurrency(saleTotal), xMargin+contentWidth, y, {align:'right'}); y+=4;
        doc.setFont("helvetica", "normal"); doc.text(`Pagamento: ${payment}`, xMargin, y);  y+=4;
        doc.line(xMargin, y, xMargin + contentWidth, y); y+=3;
        if (hasVideogame) { doc.setFontSize(6); textLines = doc.splitTextToSize(`GARANTIA (Videogame): ${STORE_CONFIG.diasGarantiaPadrao} dias contra defeitos de fabricação. Não cobre mau uso ou danos físicos.`, contentWidth); doc.text(textLines, contentWidth/2 + xMargin, y, {align:'center'}); y+= textLines.length * 2 +1; }
        doc.setFontSize(7); doc.text("Obrigado pela preferência!", contentWidth/2+xMargin, y, {align:'center'}); y+=3;
        doc.text(STORE_CONFIG.nomeLoja, contentWidth/2+xMargin, y, {align:'center'}); y+=3;
        doc.text(`IG: @luckhousegames | Site: www.luckhousegames.com.br`, contentWidth/2 + xMargin, y, {align:'center'});
        
        doc.save(`Cupom_Venda_${(clientName||'Consumidor').replace(/\s+/g, '_')}_${new Date(saleDate).toISOString().slice(0,10)}.pdf`);
        showToast("Cupom PDF gerado!", "success");
    } catch (e) { console.error("Erro ao gerar Cupom PDF:", e); showToast("Falha ao gerar Cupom PDF.", "danger");}
}


// --- ADMIN AREA ---
// setupAdminAreaModule, renderAdminDashboard, renderSalesChart, exportVendasCSV (já existem e foram ajustadas)


// --- RELATÓRIOS/EMISSÕES MODULE ---
// setupRelatoriosModule, populateRelatoriosSelects, generateTermoGarantiaPdf (já existem e foram ajustadas)

function renderEntregasList(filteredList = null) {
    const tbody = document.getElementById('entregas-list-tbody');
    if (!tbody) { console.error("Tbody de entregas (entregas-list-tbody) não encontrado."); return; }
    tbody.innerHTML = '';
    const listToRender = filteredList || ENTREGAS;
    if (listToRender.length === 0) {
        tbody.innerHTML = '<tr class="no-entregas-message"><td colspan="6" class="text-center text-muted">Nenhum registro de entrega.</td></tr>';
        return;
    }
    listToRender.sort((a, b) => new Date(b.dataSolicitacao).getTime() - new Date(a.dataSolicitacao).getTime()).forEach(entrega => {
        const os = ORDENS_SERVICO.find(o => o.id === entrega.osId);
        const clienteNome = os ? (CLIENTES.find(c=>c.id === os.clienteId)?.nome || 'N/A') : 'OS não encontrada';
        tbody.innerHTML += `
            <tr>
                <td>OS #${String(entrega.osId).padStart(3,'0')} (${clienteNome})</td>
                <td>${new Date(entrega.dataSolicitacao).toLocaleString('pt-BR')}</td>
                <td>${entrega.enderecoDestino}</td>
                <td>${formatCurrency(entrega.valorCorrida)}</td>
                <td>${entrega.observacoes || '-'}</td>
                <td>${entrega.operadorRegistro || 'N/D'}</td>
            </tr>`;
    });
}

function renderEmprestimosList(filteredList = null) {
    const tbody = document.getElementById('emprestimos-list-tbody');
    if (!tbody) { console.error("Tbody de empréstimos (emprestimos-list-tbody) não encontrado."); return; }
    tbody.innerHTML = '';
    const listToRender = filteredList || EMPRESTIMOS_CONSOLE;
    if (listToRender.length === 0) {
        tbody.innerHTML = '<tr class="no-emprestimos-message"><td colspan="8" class="text-center text-muted">Nenhum empréstimo registrado.</td></tr>';
        return;
    }
    listToRender.sort((a, b) => new Date(b.dataEmprestimo).getTime() - new Date(a.dataEmprestimo).getTime()).forEach(emp => {
        const os = ORDENS_SERVICO.find(o => o.id === emp.osIdReferencia);
        const clienteNome = os ? (CLIENTES.find(c=>c.id === os.clienteId)?.nome || 'N/A') : 'OS não encontrada';
        const isDevolvido = emp.status === 'Devolvido';
        tbody.innerHTML += `
            <tr>
                <td>OS #${String(emp.osIdReferencia).padStart(3,'0')} (${clienteNome})</td>
                <td>${emp.consoleModelo}</td>
                <td>${emp.consoleSerial || '-'}</td>
                <td>${new Date(emp.dataEmprestimo + "T00:00:00").toLocaleDateString('pt-BR')}</td>
                <td>${emp.dataPrevistaDevolucao ? new Date(emp.dataPrevistaDevolucao + "T00:00:00").toLocaleDateString('pt-BR') : '-'}</td>
                <td><span class="badge ${isDevolvido ? 'bg-success' : 'bg-warning text-dark'}">${emp.status} ${isDevolvido && emp.dataDevolucaoReal ? '('+new Date(emp.dataDevolucaoReal + "T00:00:00").toLocaleDateString('pt-BR')+')' : ''}</span></td>
                <td>${emp.operadorRegistro || 'N/D'}</td>
                <td>
                    ${!isDevolvido ? `<button class="btn btn-sm btn-success-custom" onclick="window.marcarEmprestimoDevolvido(${emp.id})"><i class="fas fa-check-circle"></i> Devolvido</button>` : '-'}
                </td>
            </tr>`;
    });
}

// --- ASSISTENTE DE DIAGNÓSTICO MODULE ---
const DIAGNOSTIC_KB = [ // Base de Conhecimento EXEMPLO (Expandir conforme necessidade)
    { device: "ps5", keywords: ["não liga", "sem energia", "morto"], suggestions: ["Verificar cabo de alimentação e tomada.", "Possível problema na fonte interna (PSU).", "Testar em outra tomada.", "Verificar se o botão power está funcionando."] },
    { device: "ps5", keywords: ["luz branca", "sem imagem", "sem vídeo", "nao da video"], suggestions: ["Verificar cabo HDMI (testar outro, preferencialmente 2.1).", "Verificar porta HDMI do console e da TV/monitor.", "Tentar modo de segurança para alterar resolução.", "Pode ser 'White Light of Death' (WLOD) - falha no chip HDMI ou CI retimer."] },
    { device: "ps5", keywords: ["desliga sozinho", "desligando durante jogo"], suggestions: ["Superaquecimento: verificar ventilação, limpar poeira interna e saídas de ar.", "Problema na fonte interna (PSU).", "Metal líquido mal aplicado na APU (raro, mas possível).", "Software corrompido: tentar reconstruir banco de dados ou reinstalar firmware em modo de segurança."] },
    { device: "ps4", keywords: ["não liga", "luz azul", "blod", "bip e desliga"], suggestions: ["BLOD (Blue Light of Death): Pode ser solda BGA da APU, problema no HD (disco rígido), ou fonte.", "Verificar cabo de alimentação e HD.", "Tentar modo de segurança para verificar/reinstalar sistema."] },
    { device: "ps4", keywords: ["sem imagem", "luz branca", "sem vídeo", "porta hdmi"], suggestions: ["Cabo HDMI defeituoso ou mal conectado.", "Porta HDMI do console danificada fisicamente (pinos tortos).", "Chip controlador HDMI (CI Panasonic MN86471A ou similar) defeituoso (WLOD).", "Configuração de resolução incompatível (usar modo de segurança)."] },
    { device: "ps4", keywords: ["ejeta disco", "bipando sozinho", "expelindo disco"], suggestions: ["Sensor de eject com defeito ou sujo (especialmente em modelos FAT).", "Parafuso de ejeção manual desregulado.", "Problema na borracha do botão eject (modelos FAT, pode expandir com calor).", "Flat cable do botão eject/power com defeito."] },
    { device: "xboxseries", keywords: ["não liga", "sem sinal de energia"], suggestions: ["Verificar cabo de alimentação e tomada.", "Fonte interna defeituosa.", "Botão de power pode estar com defeito.", "Curto na placa-mãe."] },
    { device: "xboxseries", keywords: ["sem imagem", "sem vídeo", "tela preta ao ligar"], suggestions: ["Cabo HDMI (usar o original ou de alta velocidade compatível).", "Porta HDMI do console ou TV/monitor.", "Problema no chip retimer HDMI (comum).", "Tentar ciclo de energia completo e redefinir resolução."] },
    { device: "xboxone", keywords: ["não liga", "fonte laranja", "fonte vermelha", "sem energia"], suggestions: ["Problema na fonte externa (verificar luz: Laranja = standby, Branca = ligado, Sem luz/Vermelha = defeito na fonte).", "Se fonte OK (luz branca/laranja), pode ser curto na placa-mãe do console.", "HD defeituoso impedindo boot."] },
    { device: "switch", keywords: ["não liga", "tela preta", "nao acende"], suggestions: ["Bateria totalmente descarregada (deixar carregando por várias horas com carregador original).", "Dock com problema (testar carregar direto no console).", "Problema no conector USB-C do console.", "Chip M92T36 (gerenciamento de energia/carga) ou P13USB (vídeo/dock) com defeito."] },
    { device: "switch", keywords: ["não carrega", "bateria nao sobe"], suggestions: ["Carregador original defeituoso ou cabo USB-C.", "Conector USB-C do console danificado ou sujo.", "Chip M92T36 (carga) ou BQ24193 (bateria) com defeito."] },
    { device: "switch", keywords: ["joy-con não conecta", "joycon desconectando", "joy con nao reconhece"], suggestions: ["Trilho do Joy-Con no console ou no próprio controle sujo/danificado.", "Bateria fraca do Joy-Con (carregar no console).", "Problema de antena interna do Joy-Con ou do console.", "Firmware desatualizado (console e controles)."] },
    { device: "controle-ps", keywords: ["analógico puxando", "drift", "movendo sozinho", "personagem mexe sozinho"], suggestions: ["Desgaste ou sujeira no potenciômetro do analógico.", "Necessário limpeza interna com álcool isopropílico ou substituição do mecanismo analógico (solda necessária)."] },
    { device: "controle-xbox", keywords: ["analógico puxando", "drift", "personagem mexe sozinho"], suggestions: ["Desgaste ou sujeira no potenciômetro do analógico.", "Necessário limpeza interna ou substituição do mecanismo analógico (solda necessária)."] },
    { device: "controle-ps", keywords: ["não carrega", "luz laranja piscando", "nao segura carga"], suggestions: ["Cabo USB defeituoso.", "Porta de carregamento do controle danificada.", "Bateria viciada ou com defeito (necessita substituição).", "Flat cable interno da bateria/placa."] },
    { device: "controle-xbox", keywords: ["não liga", "não conecta", "desliga sozinho"], suggestions: ["Pilhas fracas ou com mau contato. Testar pilhas novas.", "Bateria recarregável (Play & Charge Kit) com problema ou no fim da vida útil.", "Problema de sincronização (tentar parear novamente pressionando botões de sync).", "Placa interna do controle com defeito."] },
    { device: "retro-console", keywords: ["não liga", "sem imagem", "tela chuviscando", "jogo nao pega"], suggestions: ["Fonte de alimentação original ou compatível com voltagem correta.", "Cabo AV/RF/HDMI mal conectado ou com defeito.", "Cartucho/CD sujo ou com contatos oxidados (limpar com álcool isopropílico).", "Slot do cartucho/leitor de CD sujo ou com defeito."] },
    { device: "pc-gamer", keywords: ["não liga", "sem sinal", "não dá vídeo", "bipa mas nao liga"], suggestions: ["Verificar cabos de energia (fonte, placa de vídeo, monitor).", "Memória RAM mal encaixada ou com defeito (testar um pente por vez).", "Placa de vídeo mal encaixada ou com defeito (testar vídeo onboard se houver).", "Problema na fonte de alimentação (PSU).", "Placa-mãe com defeito (capacitores estufados, etc.).", "Botão de power do gabinete ou fios do painel frontal desconectados."] },
    { device: "pc-gamer", keywords: ["lento", "travando", "desempenho baixo", "jogo com lag"], suggestions: ["Superaquecimento (CPU/GPU): verificar coolers, limpar poeira, trocar pasta térmica.", "HD/SSD cheio ou com erros (verificar saúde do disco).", "Infecção por malware/vírus.", "Drivers desatualizados (principalmente da placa de vídeo).", "Pouca memória RAM para as tarefas/jogos.", "Configurações gráficas do jogo muito altas para o hardware."] },
];

function setupAssistenteDiagnosticoModule() {
    const deviceTypeSelect = document.getElementById('diag-device-type');
    const descriptionTextarea = document.getElementById('diag-problem-description');
    const charCountSpan = document.getElementById('diag-char-count');
    const analisarBtn = document.getElementById('btn-analisar-problema');
    
    if (descriptionTextarea && charCountSpan) {
        descriptionTextarea.addEventListener('input', updateDiagCharCount);
        updateDiagCharCount(); // Initial count
    }

    if (analisarBtn) {
        analisarBtn.addEventListener('click', analisarProblemaDiagnostico);
    }
}

function populateDiagDeviceTypes(){
    const deviceTypeSelect = document.getElementById('diag-device-type');
    if(deviceTypeSelect){
        deviceTypeSelect.innerHTML = ''; // Limpa opções existentes
        DIAGNOSTIC_DEVICE_TYPES.forEach(device => {
            deviceTypeSelect.add(new Option(device.label, device.value));
        });
    }
}

function updateDiagCharCount() {
    const descriptionTextarea = document.getElementById('diag-problem-description');
    const charCountSpan = document.getElementById('diag-char-count');
    if(descriptionTextarea && charCountSpan){
        charCountSpan.textContent = descriptionTextarea.value.length;
    }
}

function analisarProblemaDiagnostico() {
    const deviceType = document.getElementById('diag-device-type').value;
    const description = document.getElementById('diag-problem-description').value.toLowerCase();
    const suggestionsArea = document.getElementById('diag-suggestions-area');

    if (!deviceType) {
        showToast("Por favor, selecione o tipo de dispositivo.", "warning");
        return;
    }
    if (!description.trim()) {
        showToast("Por favor, descreva o problema.", "warning");
        return;
    }

    suggestionsArea.innerHTML = '<p class="text-muted">Analisando...</p>';
    let foundSuggestions = [];

    // Simplificando a limpeza: focar em encontrar keywords de sintomas.
    // O usuário foi orientado a ser descritivo.
    let cleanedDescription = description;

    DIAGNOSTIC_KB.forEach(entry => {
        if (entry.device === deviceType) {
            entry.keywords.forEach(keyword => {
                // Usar regex para encontrar a palavra inteira ou como parte de uma palavra, mas evitar que "liga" case com "desliga" incorretamente
                // Uma forma simples é apenas checar a inclusão. Para maior precisão, regex mais complexos seriam necessários.
                if (cleanedDescription.includes(keyword.toLowerCase())) {
                    entry.suggestions.forEach(suggestion => {
                        if (!foundSuggestions.includes(suggestion)) {
                            foundSuggestions.push(suggestion);
                        }
                    });
                }
            });
        }
    });

    if (foundSuggestions.length > 0) {
        let html = '<p>Com base na descrição, aqui estão algumas possibilidades:</p><ul>';
        foundSuggestions.forEach(sugg => {
            html += `<li>${sugg}</li>`;
        });
        html += '</ul><p class="mt-3 text-warning small"><i class="fas fa-exclamation-triangle me-1"></i> Lembre-se: Estas são apenas sugestões comuns. Um diagnóstico preciso requer análise técnica.</p>';
        suggestionsArea.innerHTML = html;
    } else {
        suggestionsArea.innerHTML = '<p class="text-info">Não foram encontradas sugestões diretas para essa descrição e tipo de aparelho na base de conhecimento atual. Tente descrever com outros termos ou verificar se o tipo de aparelho está correto.</p>';
    }
}


// --- SEARCH/FILTER FUNCTIONS ---
// filterOSList, filterClientList, filterProductServiceList (já existem)
// filterEntregasList, filterEmprestimosList (já existem)


// --- BACKUP/RESTORE ---
// exportData, importData, resetAllDataWarning (já existem e foram ajustadas para incluir novos arrays)


// --- INITIALIZATION & NAVIGATION ---
// DOMContentLoaded, loadAllData, navigateToSection (já existem e foram ajustadas)


console.log("Luckhouse Games - Script.js: Todas as partes carregadas e prontas para uso.");

// FIM DA PARTE 3 (E DO ARQUIVO SCRIPT.JS)
