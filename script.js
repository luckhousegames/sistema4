console.log("DEBUG: Script.js v1.5.X - TOPO DO ARQUIVO"); // Adicione uma sub-versão se quiser

// Initialize jsPDF & Chart (global, as they are loaded in <head>)
const jsPDFModule = window.jspdf ? window.jspdf.jsPDF : null;
const ChartJS = window.Chart || null;

if (!jsPDFModule) console.error("CRÍTICO: jsPDF não carregado!");
else console.log("DEBUG: jsPDF carregado.");
if (!ChartJS) console.error("CRÍTICO: Chart.js não carregado!");
else console.log("DEBUG: Chart.js carregado.");

console.log("DEBUG: Luckhouse Games - Script.js: Iniciando constantes e variáveis globais...");

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
    { value: "", label: "Selecione o tipo..." },
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
console.log("DEBUG: Constantes globais definidas.");

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
console.log("DEBUG: Variáveis globais de estado inicializadas.");

// --- UTILITY FUNCTIONS ---
function showToast(message, type = "primary", title = "Notificação") {
    console.log(`DEBUG: showToast chamada: message='${message}', type='${type}', title='${title}'`);
    try {
        const toastEl = document.getElementById('liveToast');
        const toastMessageEl = document.getElementById('toast-message');
        const toastTitleEl = document.getElementById('toast-title');
        const toastCloseButton = toastEl ? toastEl.querySelector('.btn-close') : null;

        if (!toastEl || !toastMessageEl || !toastTitleEl || !toastCloseButton) {
            console.error("DEBUG: Elementos do Toast não encontrados! Mensagem:", message);
            alert(title + ": " + message); return;
        }
        const toastComponent = bootstrap.Toast.getOrCreateInstance(toastEl);
        toastMessageEl.textContent = message;
        toastTitleEl.textContent = title;

        const validBgClasses = ['bg-primary-custom', 'bg-success-custom', 'bg-danger-custom', 'bg-warning', 'bg-info-custom'];
        const textWhiteClass = 'text-white';

        toastEl.classList.remove(...validBgClasses, textWhiteClass); // Clear previous classes from toastEl
        toastMessageEl.classList.remove(textWhiteClass);
        // Header styling is now primarily handled by CSS variables defined in each theme

        let newClass = 'bg-primary-custom';
        let bodyTextColorIsWhite = true;

        if (type === "success") newClass = 'bg-success-custom';
        else if (type === "danger") newClass = 'bg-danger-custom';
        else if (type === "warning") { newClass = 'bg-warning'; bodyTextColorIsWhite = false; }
        else if (type === "info") newClass = 'bg-info-custom';

        toastEl.classList.add(newClass);
        if(bodyTextColorIsWhite) { // For toast body text color
            toastMessageEl.classList.add(textWhiteClass);
        } else {
            toastMessageEl.classList.remove(textWhiteClass);
        }
        // The .toast-header styling (bg, text color, close button filter) should be picked up from the CSS variables.
        
        if(toastComponent) {
            toastComponent.show();
        } else {
            console.error("DEBUG: Toast component não inicializado.");
        }
    } catch (error) { console.error("DEBUG: Erro em showToast:", error, message); }
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
        console.log(`DEBUG: Dados SALVOS para chave "${key}".`);
    } catch (e) { console.error(`DEBUG: Erro ao salvar dados na localStorage para chave ${key}:`, e); showToast(`Erro ao salvar (${key}).`, "danger"); }
}

function loadData(key, defaultValue = []) {
    console.log(`DEBUG: loadData - Tentando carregar dados para chave "${key}".`);
    const dataFromStorage = localStorage.getItem(key);
    if (dataFromStorage) {
        try {
            const parsedData = JSON.parse(dataFromStorage);
            console.log(`DEBUG: loadData - Dados CARREGADOS da chave "${key}".`);
            // Merge with default for objects to ensure new keys are present if loading old data
            if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue) &&
                typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
                console.log(`DEBUG: loadData - Mesclando objeto da chave "${key}" com default.`);
                return { ...defaultValue, ...parsedData };
            }
            return parsedData;
        } catch (e) {
            console.error(`DEBUG: loadData - Erro ao parsear JSON da chave "${key}":`, e);
            showToast(`Erro ao carregar dados (${key}). Usando padrão.`, "warning");
            localStorage.removeItem(key); // Remove corrupted data
        }
    }
    console.log(`DEBUG: loadData - Nenhum dado para chave "${key}", usando default.`);
    return Array.isArray(defaultValue) ? [...defaultValue] : (typeof defaultValue === 'object' && defaultValue !== null ? {...defaultValue} : defaultValue);
}
console.log("DEBUG: Funções de LocalStorage definidas.");

// --- APP CONFIG ---
function loadAppConfig() {
    console.log("DEBUG: loadAppConfig - Iniciando.");
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
    STORE_CONFIG = loadData('luckhouse_config', defaultConfig); // loadData agora mescla objetos
    console.log("DEBUG: loadAppConfig - STORE_CONFIG carregado/definido:", STORE_CONFIG);
    
    // Assegurar que todas as chaves default existem em STORE_CONFIG após carregar do localStorage
    for (const key in defaultConfig) {
        if (STORE_CONFIG[key] === undefined) {
            console.warn(`DEBUG: loadAppConfig - Chave '${key}' ausente no STORE_CONFIG carregado, adicionando valor default.`);
            STORE_CONFIG[key] = defaultConfig[key];
        }
    }

    applyTheme(STORE_CONFIG.currentTheme); // Aplica o tema (e atualiza meta tag)
    updateStoreInfoUI(); // Preenche campos de config e UI geral
    console.log("DEBUG: loadAppConfig - Concluído.");
}

function saveAppConfig() {
    console.log("DEBUG: saveAppConfig - Salvando STORE_CONFIG.");
    saveData('luckhouse_config', STORE_CONFIG);
}

function updateStoreInfoUI() {
    console.log("DEBUG: updateStoreInfoUI - Iniciando.");
    try {
        const el = (id) => document.getElementById(id);
        // ... (código interno da função para atualizar UI com STORE_CONFIG) ...
        // (Lógica de preenchimento de campos da config e rodapé)

        console.log("DEBUG: updateStoreInfoUI - Concluído.");
    } catch (error) { console.error("DEBUG: Erro em updateStoreInfoUI:", error); }
}

function updateTermoGarantiaPreview() {
    // ... (Código interno da função) ...
}

function applyTheme(themeName) {
    console.log(`DEBUG: applyTheme - Aplicando tema: ${themeName}`);
    document.body.className = '';
    document.body.classList.add(themeName);
    
    // Garantir que STORE_CONFIG exista antes de tentar acessá-lo
    if (typeof STORE_CONFIG === 'object' && STORE_CONFIG !== null) {
        STORE_CONFIG.currentTheme = themeName;
    } else {
        console.warn("DEBUG: applyTheme - STORE_CONFIG ainda não definido ao tentar setar currentTheme. Tema aplicado ao body apenas.");
    }

    const metaThemeColor = document.getElementById('meta-theme-color');
    if (metaThemeColor) {
        if (themeName === 'light-theme') metaThemeColor.content = '#ffffff';
        else if (themeName === 'blue-theme') metaThemeColor.content = '#111827';
        else metaThemeColor.content = '#121212';
        console.log(`DEBUG: applyTheme - Meta theme-color atualizada para: ${metaThemeColor.content}`);
    } else {
        console.warn("DEBUG: applyTheme - Elemento meta-theme-color não encontrado.");
    }
    
    if (typeof renderSalesChart === 'function' && salesChartInstance && document.getElementById('admin-area') && !document.getElementById('admin-area').classList.contains('d-none') && CURRENT_USER && CURRENT_USER.role === 'admin') {
        console.log("DEBUG: applyTheme - Re-renderizando gráfico de vendas.");
        renderSalesChart();
    }
    console.log("DEBUG: applyTheme - Concluído.");
}


function fillMessageTemplate(template, data) {
    let message = template;
    if (typeof template !== 'string') {
        console.error("DEBUG: fillMessageTemplate - Template não é uma string:", template);
        return ""; // Retorna string vazia se o template for inválido
    }
    for (const key in data) {
        message = message.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '');
    }
    message = message.replace(/\{\{[A-Z_]+\}\}/g, ''); // Limpar placeholders não preenchidos
    return message;
}
console.log("DEBUG: Funções de App Config definidas.");

// --- LOGIN & AUTHENTICATION (SIMULATED) ---
function handleLogin(event) {
    console.log("DEBUG: handleLogin - Iniciado.");
    event.preventDefault();
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorMessageEl = document.getElementById('login-error-message');

    if (!usernameInput || !passwordInput || !errorMessageEl) {
        console.error("DEBUG: handleLogin - Elementos do form de login não encontrados.");
        showToast("Erro interno no formulário de login.", "danger");
        return;
    }
    const username = usernameInput.value;
    const password = passwordInput.value;
    console.log(`DEBUG: handleLogin - Tentando login com usuário: ${username}`);

    if (username === 'luckmaster' && password === 'L@1998*') { CURRENT_USER = {username: 'Luck Master', role: 'admin'}; }
    else if (username === 'Henrique Del Peso' && password === 'hdp123') { CURRENT_USER = {username: 'Henrique Del Peso', role: 'padrao'}; }
    else { 
        errorMessageEl.classList.remove('d-none'); 
        console.log("DEBUG: handleLogin - Credenciais inválidas."); 
        return; 
    }

    errorMessageEl.classList.add('d-none');
    saveData('luckhouse_currentUser', CURRENT_USER);
    console.log("DEBUG: handleLogin - Usuário salvo:", CURRENT_USER);

    updateUIAfterLogin();

    const modalLoginEl = document.getElementById('modalLogin');
    if (modalLoginEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalLoginEl);
        if (modalInstance && modalInstance['_isShown']) { // Bootstrap 5
            modalInstance.hide();
        }
    }
    showToast(`Bem-vindo(a), ${CURRENT_USER.username}!`, "success");
    navigateToSection('dashboard'); // Navega para dashboard após login
    setupAllModulesDynamic();
    console.log("DEBUG: handleLogin - Concluído.");
}

function handleLogout() {
    console.log("DEBUG: handleLogout - Iniciado.");
    // ... (Código interno da função) ...
    console.log("DEBUG: handleLogout - Concluído.");
}

function checkLoginState() {
    console.log("DEBUG: checkLoginState - Iniciado.");
    const storedUser = loadData('luckhouse_currentUser', null);
    if (storedUser && storedUser.username && storedUser.role) {
        CURRENT_USER = storedUser;
        console.log("DEBUG: checkLoginState - Usuário encontrado no localStorage:", CURRENT_USER);
        updateUIAfterLogin();
        // A navegação inicial para dashboard será feita pelo DOMContentLoaded se não houver erro fatal
        setupAllModulesDynamic();
    } else {
        console.log("DEBUG: checkLoginState - Nenhum usuário logado. Exibindo UI de login.");
        updateUIAfterLogin(); // Configura UI para não logado
        const modalLoginEl = document.getElementById('modalLogin');
        if (modalLoginEl) {
            const loginModalInstance = bootstrap.Modal.getOrCreateInstance(modalLoginEl);
            // Verificar se o modal já não está sendo mostrado para evitar reabrir se já estiver em processo
            if (loginModalInstance && loginModalInstance['_element'] && !loginModalInstance['_isShown']) {
                 loginModalInstance.show();
            }
        } else {
            console.error("DEBUG: checkLoginState - Modal de login não encontrado.");
        }
    }
    console.log("DEBUG: checkLoginState - Concluído.");
}

function updateUIAfterLogin() {
    console.log("DEBUG: updateUIAfterLogin - Atualizando UI para usuário:", CURRENT_USER.username, "Role:", CURRENT_USER.role);
    // ... (Código interno da função) ...
    console.log("DEBUG: updateUIAfterLogin - UI atualizada.");
}
console.log("DEBUG: Funções de Login/Auth definidas.");

// --- MODULE SETUP FUNCTIONS ---
function setupStaticModules() {
    console.groupCollapsed("DEBUG: setupStaticModules - Iniciando configuração de listeners estáticos...");
    try {
        // Chamadas para setup...Module() com logs individuais dentro de cada uma
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
        console.log("DEBUG: setupStaticModules - Módulos estáticos configurados.");
    } catch (error) {
        console.error("DEBUG: ERRO CRÍTICO em setupStaticModules:", error);
        showToast("Erro ao configurar módulos estáticos. Verifique o console.", "danger");
    }
    console.groupEnd();
}

function setupAllModulesDynamic() {
    console.groupCollapsed("DEBUG: setupAllModulesDynamic - Iniciando configuração de UIs dinâmicas...");
    try {
        if (CURRENT_USER && CURRENT_USER.role) {
            console.log("DEBUG: setupAllModulesDynamic - Usuário logado, atualizando UIs.");
            renderDashboardOSRecentes();
            if (CURRENT_USER.role === 'admin') renderAdminDashboard();
            populateRelatoriosSelects();
            populateTecnicoSelects();
            populateClienteSelect();
            populatePdvClienteSelect();
            renderPdvItemList();
            updateStoreInfoUI();
            // Renderizar listas de relatórios se a seção estiver ativa
            const relatoriosSection = document.getElementById('relatorios');
            if (relatoriosSection && !relatoriosSection.classList.contains('d-none')) {
                console.log("DEBUG: setupAllModulesDynamic - Seção de relatórios ativa, renderizando listas.");
                renderEntregasList();
                renderEmprestimosList();
            }
        } else {
            console.log("DEBUG: setupAllModulesDynamic - Nenhum usuário logado, UIs dinâmicas não atualizadas.");
        }
        console.log("DEBUG: setupAllModulesDynamic - Módulos dinâmicos atualizados.");
    } catch (error) {
        console.error("DEBUG: ERRO CRÍTICO em setupAllModulesDynamic:", error);
        showToast("Erro ao atualizar UIs dinâmicas. Verifique o console.", "danger");
    }
    console.groupEnd();
}
console.log("DEBUG: Funções de setup de módulos definidas.");

function setupConfiguracoesModule() {
    console.log("DEBUG: setupConfiguracoesModule - Iniciando.");
    const btnSaveLoja = document.getElementById('btn-save-config-loja');
    if (btnSaveLoja) {
        btnSaveLoja.addEventListener('click', function(e) {
            console.log("DEBUG: Botão 'Salvar Dados da Loja' clicado.");
            e.preventDefault();
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
    } else console.warn("DEBUG: Botão btn-save-config-loja não encontrado.");

    const themeSelect = document.getElementById('config-theme-select');
    const btnSaveAparencia = document.getElementById('btn-save-config-aparencia');
     if (themeSelect && btnSaveAparencia) {
        themeSelect.addEventListener('change', function() {
            console.log("DEBUG: Seleção de tema alterada para:", this.value);
            applyTheme(this.value);
        });
        btnSaveAparencia.addEventListener('click', function() {
            console.log("DEBUG: Botão 'Salvar Aparência' clicado.");
            //STORE_CONFIG.currentTheme já foi atualizado pelo applyTheme no evento 'change'
            saveAppConfig();
            showToast("Configurações de aparência salvas!", "success");
        });
    } else { console.warn("DEBUG: Select de tema ou botão de salvar aparência não encontrado."); }

    const formMensagens = document.getElementById('formConfigMensagensWpp');
    if (formMensagens) {
        formMensagens.addEventListener('submit', function(e) {
            console.log("DEBUG: Formulário de mensagens WhatsApp submetido.");
            e.preventDefault();
            STORE_CONFIG.wppMsgOsStatus = document.getElementById('config-wpp-msg-os-status').value;
            STORE_CONFIG.wppMsgOsPronta = document.getElementById('config-wpp-msg-os-pronta').value;
            STORE_CONFIG.wppMsgOsAprovacao = document.getElementById('config-wpp-msg-os-aprovacao').value;
            STORE_CONFIG.wppMsgOsAtrasoSnippet = document.getElementById('config-wpp-msg-os-atraso-snippet').value;
            saveAppConfig();
            showToast("Templates de mensagens WhatsApp salvos!", "success");
        });
    } else { console.warn("DEBUG: Formulário formConfigMensagensWpp não encontrado.");}
    console.log("DEBUG: setupConfiguracoesModule - Concluído.");
}

// --- TECNICOS MODULE ---
function setupTecnicosModule() {
    console.log("DEBUG: setupTecnicosModule - Iniciando.");
    const form = document.getElementById('formNovoTecnico');
    if (form) {
        form.addEventListener('submit', function(e) {
            console.log("DEBUG: formNovoTecnico - Submit acionado.");
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
                else { TECNICOS.push(tecnico); console.warn("DEBUG: Editando técnico não encontrado, adicionando como novo.")}
            } else {
                TECNICOS.push(tecnico);
            }
            saveTecnicos();
            showToast(`Técnico ${tecnico.nome} ${id ? 'atualizado' : 'salvo'}!`, "success");
            form.reset();
            if (idInput) idInput.value = '';
        });
    } else { console.error("DEBUG: Formulário formNovoTecnico não encontrado."); }
    console.log("DEBUG: setupTecnicosModule - Concluído.");
}
// ... (loadTecnicos, saveTecnicos, renderTecnicosList, editTecnico, deleteTecnico, populateTecnicoSelects com logs de início/fim) ...

// --- CLIENTES MODULE ---
function setupClientesModule() {
    console.log("DEBUG: setupClientesModule - Iniciando.");
    // ... (Conteúdo da função, com logs nos listeners como no exemplo de setupConfiguracoesModule) ...
    console.log("DEBUG: setupClientesModule - Concluído.");
}
// ... (loadClientes, saveClientes, renderClientList, editCliente, deleteCliente, etc. com logs de início/fim) ...

// --- PRODUTOS MODULE ---
function setupProdutosModule() {
    console.log("DEBUG: setupProdutosModule - Iniciando.");
    // ... (Conteúdo da função, com logs nos listeners) ...
    console.log("DEBUG: setupProdutosModule - Concluído.");
}
// ... (loadProdutos, saveProdutos, renderProductList, editProduto, deleteProduto com logs de início/fim) ...

console.log("DEBUG: FIM DA PARTE 1 do script.js (com debugging intensivo)");
// FIM DA PARTE 1

console.log("DEBUG: INÍCIO DA PARTE 2 do script.js (com debugging)");

// --- SERVICOS MODULE ---
function setupServicosModule() {
    console.log("DEBUG: setupServicosModule - Iniciando.");
    const form = document.getElementById('formNovoServico');
    if (form) {
        form.addEventListener('submit', function(e) {
            console.log("DEBUG: formNovoServico - Submit acionado.");
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
            console.log("DEBUG: formNovoServico - Objeto serviço criado:", servico);
            if (!servico.nome || isNaN(servico.valor) || servico.valor <= 0) { showToast("Nome e Valor para Cliente são obrigatórios e devem ser válidos.", "warning"); return; }
            if (isNaN(servico.custoTecnico) || servico.custoTecnico < 0) { showToast("Custo do técnico inválido.", "warning"); return; }

            if (id) { const i = SERVICOS.findIndex(s=>s.id=== parseInt(id)); if(i>-1) SERVICOS[i]=servico; else {SERVICOS.push(servico); console.warn("DEBUG: Editando serviço não encontrado, adicionando como novo.");}}
            else { SERVICOS.push(servico); }
            saveServicos();
            showToast(`Serviço ${servico.nome} ${id ? 'atualizado' : 'salvo'}!`, "success");
            bootstrap.Modal.getInstance(document.getElementById('modalNovoServico'))?.hide();
        });
    } else { console.error("DEBUG: Formulário formNovoServico não encontrado."); }
    console.log("DEBUG: setupServicosModule - Concluído.");
}
function loadServicos() { console.log("DEBUG: loadServicos - Iniciando."); SERVICOS = loadData('luckhouse_servicos', []); renderServiceList(); renderPdvItemList(); console.log("DEBUG: loadServicos - Concluído.");}
function saveServicos() { console.log("DEBUG: saveServicos - Iniciando."); saveData('luckhouse_servicos', SERVICOS); renderServiceList(); renderPdvItemList(); console.log("DEBUG: saveServicos - Concluído.");}
function renderServiceList(filteredList = null) {
    console.log("DEBUG: renderServiceList - Iniciando.");
    const tbody = document.getElementById('service-list-tbody');
    if(!tbody) { console.error("DEBUG: Tbody de serviço (service-list-tbody) não encontrado."); return; }
    tbody.innerHTML = '';
    const listToRender = filteredList ? filteredList : SERVICOS;
    if (listToRender.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum serviço.</td></tr>'; return; }
    listToRender.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(s => {
        tbody.innerHTML += `<tr><td>${s.nome}</td><td>${s.descricao||'-'}</td><td>${formatCurrency(s.custoTecnico)}</td><td>${formatCurrency(s.valor)}</td>
                            <td><button class="btn btn-sm btn-warning-custom me-1" onclick="window.editServico(${s.id})"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-danger-custom" onclick="window.deleteServico(${s.id})"><i class="fas fa-trash"></i></button></td></tr>`;
    });
    console.log("DEBUG: renderServiceList - Lista de serviços renderizada.");
}
window.editServico = function(id) {
    console.log(`DEBUG: window.editServico - Editando serviço ID: ${id}`);
    // ... (lógica interna) ...
};
window.deleteServico = function(id) {
    console.log(`DEBUG: window.deleteServico - Tentando deletar serviço ID: ${id}`);
    // ... (lógica interna) ...
};
console.log("DEBUG: Funções do Módulo Serviços definidas.");


// --- ORDENS DE SERVIÇO (OS) MODULE ---
function setupOSModule() {
    console.log("DEBUG: setupOSModule - Iniciando.");
    // ... (Lógica interna da função com logs em pontos chave, especialmente nos event listeners) ...
    const form = document.getElementById('formNovaOS');
    if (form) {
        form.addEventListener('submit', function(e) {
            console.log("DEBUG: formNovaOS - Submit acionado.");
            // ... (lógica interna como definida anteriormente) ...
        });
    } else { console.error("DEBUG: setupOSModule - Formulário formNovaOS não encontrado.");}
    // ... (outros listeners)
    console.log("DEBUG: setupOSModule - Concluído.");
}

function updateValorGarantiaExtendidaInfoOS() {
    // console.log("DEBUG: updateValorGarantiaExtendidaInfoOS - Chamada."); // Log pode ser muito frequente
    // ... (lógica interna) ...
}

function updateOSPrazoInfo(dataPrevistaStr, statusOS = null, isManualmenteAtrasado = false) {
    // console.log(`DEBUG: updateOSPrazoInfo - data: ${dataPrevistaStr}, status: ${statusOS}, manual: ${isManualmenteAtrasado}`); // Log pode ser muito frequente
    // ... (lógica interna) ...
}

function toggleEmprestimoButtonVisibility(osIdStr){
    // console.log(`DEBUG: toggleEmprestimoButtonVisibility - osId: ${osIdStr}`); // Log pode ser muito frequente
    // ... (lógica interna) ...
}

function loadOrdensServico() { console.log("DEBUG: loadOrdensServico - Iniciando."); ORDENS_SERVICO = loadData('luckhouse_os', []); renderOSList(); renderDashboardOSRecentes(); console.log("DEBUG: loadOrdensServico - Concluído.");}
function saveOrdensServico() { console.log("DEBUG: saveOrdensServico - Iniciando."); saveData('luckhouse_os', ORDENS_SERVICO); renderOSList(); renderDashboardOSRecentes(); console.log("DEBUG: saveOrdensServico - Concluído.");}

function getStatusBadgeClass(status) {
    // ... (lógica interna) ...
    return `badge rounded-pill me-2 status-default`; // Exemplo
}

function renderOSList(filteredOS = null) {
    console.log("DEBUG: renderOSList - Iniciando.");
    // ... (lógica interna da função) ...
    console.log("DEBUG: renderOSList - Lista de OS renderizada.");
}

function renderDashboardOSRecentes() {
    console.log("DEBUG: renderDashboardOSRecentes - Iniciando.");
    // ... (lógica interna da função) ...
    console.log("DEBUG: renderDashboardOSRecentes - Dashboard OS recentes renderizado.");
}

window.editOS = function(id) {
    console.log(`DEBUG: window.editOS - Editando OS ID: ${id}`);
    // ... (lógica interna da função) ...
};

window.deleteOS = function(id) {
    console.log(`DEBUG: window.deleteOS - Tentando deletar OS ID: ${id}`);
    // ... (lógica interna da função) ...
};

window.generateAndOpenOSPdf = async function(osId) {
    console.log(`DEBUG: window.generateAndOpenOSPdf - Gerando PDF para OS ID: ${osId}`);
    // ... (lógica interna da função) ...
};

window.generateAndOpenOSWhatsAppMessage = function(osId) {
    console.log(`DEBUG: window.generateAndOpenOSWhatsAppMessage - Gerando msg WhatsApp para OS ID: ${osId}`);
    // ... (lógica interna da função) ...
};

function notificarAdminNovaOS(osData, forcarWhatsapp = false) {
    console.log(`DEBUG: notificarAdminNovaOS - Notificando admin para OS ID: ${osData.id}, forcarWhatsapp: ${forcarWhatsapp}`);
    // ... (lógica interna da função) ...
}

async function generateRegistroInternoOSPdf(osData) {
    console.log(`DEBUG: generateRegistroInternoOSPdf - Gerando PDF interno para OS ID: ${osData.id}`);
    // ... (lógica interna da função) ...
}
console.log("DEBUG: Funções do Módulo OS definidas.");

// --- Modal Serviço Técnico (OS) ---
function setupModalServicoTecnico() {
    console.log("DEBUG: setupModalServicoTecnico - Iniciando.");
    const btnConfirmar = document.getElementById('btn-confirmar-servico-tecnico');
    if(btnConfirmar) {
        btnConfirmar.addEventListener('click', function() {
            console.log("DEBUG: Botão 'btn-confirmar-servico-tecnico' clicado.");
            // ... (lógica interna) ...
        });
    } else { console.error("DEBUG: Botão btn-confirmar-servico-tecnico não encontrado.");}
    console.log("DEBUG: setupModalServicoTecnico - Concluído.");
}

window.abrirModalSelecaoServicoTecnico = function(osId, acao) {
    console.log(`DEBUG: window.abrirModalSelecaoServicoTecnico - OS ID: ${osId}, Ação: ${acao}`);
    // ... (lógica interna da função) ...
}

function enviarMsgWhatsappTecnicoComServico(osData, servicoInfo) {
    console.log(`DEBUG: enviarMsgWhatsappTecnicoComServico - OS ID: ${osData.id}, Servico: ${servicoInfo.nome}`);
    // ... (lógica interna da função) ...
}

function gerarReciboServicoTecnicoPdfComServico(osData, servicoInfo) {
    console.log(`DEBUG: gerarReciboServicoTecnicoPdfComServico - OS ID: ${osData.id}, Servico: ${servicoInfo.nome}`);
    // ... (lógica interna da função) ...
}
console.log("DEBUG: Funções do Modal Serviço Técnico definidas.");

// --- ENTREGAS MODULE ---
function setupEntregasModule() {
    console.log("DEBUG: setupEntregasModule - Iniciando.");
    const form = document.getElementById('formRegistrarEntrega');
    if (form) {
        form.addEventListener('submit', function(e) {
            console.log("DEBUG: formRegistrarEntrega - Submit acionado.");
            e.preventDefault();
            // ... (lógica interna) ...
        });
    } else { console.error("DEBUG: Formulário formRegistrarEntrega não encontrado.");}
    console.log("DEBUG: setupEntregasModule - Concluído.");
}

function loadEntregas() { console.log("DEBUG: loadEntregas - Iniciando."); ENTREGAS = loadData('luckhouse_entregas', []); renderEntregasList(); console.log("DEBUG: loadEntregas - Concluído.");}
function saveEntregas() { console.log("DEBUG: saveEntregas - Iniciando."); saveData('luckhouse_entregas', ENTREGAS); renderEntregasList(); console.log("DEBUG: saveEntregas - Concluído.");}

window.solicitarEntregaOS = function(osId) {
    console.log(`DEBUG: window.solicitarEntregaOS - Solicitando entrega para OS ID: ${osId}`);
    // ... (lógica interna da função) ...
};
console.log("DEBUG: Funções do Módulo Entregas definidas.");

// --- EMPRÉSTIMOS DE CONSOLE MODULE ---
function setupEmprestimosConsoleModule() {
    console.log("DEBUG: setupEmprestimosConsoleModule - Iniciando.");
    const form = document.getElementById('formEmprestimoConsole');
    if (form) {
        form.addEventListener('submit', function(e) {
            console.log("DEBUG: formEmprestimoConsole - Submit acionado.");
            e.preventDefault();
            // ... (lógica interna da função) ...
        });
    } else { console.error("DEBUG: Formulário formEmprestimoConsole não encontrado."); }
    console.log("DEBUG: setupEmprestimosConsoleModule - Concluído.");
}

function loadEmprestimosConsole() {
    console.log("DEBUG: loadEmprestimosConsole - Iniciando.");
    EMPRESTIMOS_CONSOLE = loadData('luckhouse_emprestimos_console', []);
    renderEmprestimosList(); // Certifique-se que esta função existe e é chamada
    console.log("DEBUG: loadEmprestimosConsole - Concluído.");
}

function saveEmprestimosConsole() {
    console.log("DEBUG: saveEmprestimosConsole - Iniciando.");
    saveData('luckhouse_emprestimos_console', EMPRESTIMOS_CONSOLE);
    renderEmprestimosList(); // Certifique-se que esta função existe e é chamada
    console.log("DEBUG: saveEmprestimosConsole - Concluído.");
}

window.abrirModalEmprestimoConsole = function(osId) {
    console.log(`DEBUG: window.abrirModalEmprestimoConsole - Para OS ID: ${osId}`);
    // ... (lógica interna da função) ...
};

window.marcarEmprestimoDevolvido = function(emprestimoId) {
    console.log(`DEBUG: window.marcarEmprestimoDevolvido - Empréstimo ID: ${emprestimoId}`);
    // ... (lógica interna da função) ...
};
console.log("DEBUG: Funções do Módulo Empréstimos de Console definidas.");

console.log("DEBUG: FIM DA PARTE 2 do script.js (com debugging)");
// FIM DA PARTE 2

console.log("DEBUG: INÍCIO DA PARTE 3 do script.js (com debugging)");

// --- PDV MODULE ---
function setupPdvModule() {
    console.log("DEBUG: setupPdvModule - Iniciando.");
    const el = id => {
        const element = document.getElementById(id);
        // if (!element) console.warn(`DEBUG: setupPdvModule - Elemento com ID '${id}' NÃO encontrado.`); // Pode ser muito verboso
        return element;
    };

    const btnSearch = el('btn-pdv-search-item');
    if (btnSearch) {
        btnSearch.addEventListener('click', () => {
            console.log("DEBUG: Botão 'btn-pdv-search-item' clicado.");
            window.searchPdvItems();
        });
    } else { console.warn("DEBUG: Botão btn-pdv-search-item não encontrado."); }

    const searchInput = el('pdv-search-item');
    if (searchInput) {
        searchInput.addEventListener('keyup', (event) => {
            if (event.key === "Enter") {
                console.log("DEBUG: Enter pressionado em 'pdv-search-item'.");
                window.searchPdvItems();
            }
        });
    } else { console.warn("DEBUG: Campo pdv-search-item não encontrado."); }

    const discountInput = el('pdv-discount-percentage');
    if (discountInput) {
        discountInput.addEventListener('input', () => {
            // console.log("DEBUG: Input 'pdv-discount-percentage' alterado."); // Muito verboso
            updatePdvTotals();
        });
    } else { console.warn("DEBUG: Campo pdv-discount-percentage não encontrado."); }

    const btnFinalize = el('btn-finalize-sale');
    if (btnFinalize) {
        btnFinalize.addEventListener('click', () => {
            console.log("DEBUG: Botão 'btn-finalize-sale' clicado.");
            finalizeSale();
        });
    } else { console.warn("DEBUG: Botão btn-finalize-sale não encontrado."); }

    const btnPrint = el('btn-print-sale-receipt');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            console.log("DEBUG: Botão 'btn-print-sale-receipt' clicado.");
            printSaleReceipt(true);
        });
    } else { console.warn("DEBUG: Botão btn-print-sale-receipt não encontrado."); }
    
    const btnDownloadCoupon = el('btn-download-sale-coupon');
    if (btnDownloadCoupon) {
        btnDownloadCoupon.addEventListener('click', () => {
            console.log("DEBUG: Botão 'btn-download-sale-coupon' clicado.");
            downloadSaleCouponPdf(true);
        });
    } else { console.warn("DEBUG: Botão btn-download-sale-coupon não encontrado."); }

    const btnPdvNovoCliente = el('btn-pdv-novo-cliente-rapido');
    if (btnPdvNovoCliente) {
        btnPdvNovoCliente.addEventListener('click', function() {
            console.log("DEBUG: Botão 'btn-pdv-novo-cliente-rapido' clicado.");
            window.clientFromPdvFlag = true;
            const modalNovoCliente = el('modalNovoCliente');
            const modalTitle = document.getElementById('modalNovoClienteLabelDynamic');
            if(modalTitle) modalTitle.textContent = 'Novo Cliente (PDV)';
            if (modalNovoCliente) bootstrap.Modal.getOrCreateInstance(modalNovoCliente).show();
            else console.error("DEBUG: Modal de Novo Cliente não encontrado para PDV.")
        });
    } else { console.warn("DEBUG: Botão btn-pdv-novo-cliente-rapido não encontrado.");}
    
    const formNovoItemRapido = el('formNovoItemRapidoPDV');
     if (formNovoItemRapido) {
        formNovoItemRapido.addEventListener('submit', function(e){
            console.log("DEBUG: formNovoItemRapidoPDV - Submit acionado.");
            // ... (lógica interna)
        });
    } else { console.error("DEBUG: Formulário formNovoItemRapidoPDV não encontrado."); }

    const pdvClienteSelectEl = el('pdv-cliente-select');
    if(pdvClienteSelectEl) {
        pdvClienteSelectEl.addEventListener('change', () => {
            console.log("DEBUG: Select 'pdv-cliente-select' alterado.");
            fillPdvClientReceiptFields();
        });
    } else { console.warn("DEBUG: Select pdv-cliente-select não encontrado.");}

    console.log("DEBUG: setupPdvModule - Concluído.");
}

function loadVendas() { console.log("DEBUG: loadVendas - Iniciando."); VENDAS = loadData('luckhouse_vendas', []); console.log("DEBUG: loadVendas - Concluído.");}

function renderPdvItemList(searchTerm = '') {
    // console.log(`DEBUG: renderPdvItemList - Buscando por: '${searchTerm}'`); // Muito verboso
    // ... (lógica interna) ...
}
// ... (restante das funções do PDV com seus próprios console.logs se necessário) ...


// --- ADMIN AREA ---
function setupAdminAreaModule() {
    console.log("DEBUG: setupAdminAreaModule - Iniciando.");
    const btnExport = document.getElementById('btn-export-vendas-csv');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            console.log("DEBUG: Botão 'btn-export-vendas-csv' clicado.");
            exportVendasCSV();
        });
    } else console.warn("DEBUG: Botão btn-export-vendas-csv não encontrado.");
    console.log("DEBUG: setupAdminAreaModule - Concluído.");
}
function renderAdminDashboard() {
    console.log("DEBUG: renderAdminDashboard - Iniciando.");
    if (CURRENT_USER.role !== 'admin') {
        console.log("DEBUG: renderAdminDashboard - Usuário não é admin, retornando.");
        return;
    }
    const fatEl = document.getElementById('admin-faturamento-total');
    if (fatEl) fatEl.textContent = formatCurrency(VENDAS.reduce((s,v)=>s+v.total,0));
    else console.warn("DEBUG: renderAdminDashboard - Elemento admin-faturamento-total não encontrado.");
    renderSalesChart();
    console.log("DEBUG: renderAdminDashboard - Concluído.");
}
function renderSalesChart() {
    console.log("DEBUG: renderSalesChart - Iniciando.");
    if (CURRENT_USER.role !== 'admin' || typeof ChartJS === 'undefined' || !ChartJS) {
        console.warn("DEBUG: renderSalesChart - ChartJS não definido ou usuário não admin.");
        return;
    }
    const canvas = document.getElementById('salesChartCanvas');
    if (!canvas) {
        console.error("DEBUG: renderSalesChart - Canvas do gráfico (salesChartCanvas) não encontrado.");
        return;
    }
    // ... (lógica de configuração do gráfico com cores de tema) ...
    const theme = STORE_CONFIG.currentTheme || 'dark-theme';
    let tickColor = '#fff'; let gridColor = 'rgba(255,255,255,0.1)'; let legendLabelColor = '#fff';
    if (theme === 'light-theme') { tickColor = '#333'; gridColor = 'rgba(0,0,0,0.1)'; legendLabelColor = '#333'; }
    else if (theme === 'blue-theme') { tickColor = '#e5e7eb'; gridColor = 'rgba(229, 231, 235, 0.15)'; legendLabelColor = '#e5e7eb';}

    // ... (resto da lógica do gráfico) ...
    console.log("DEBUG: renderSalesChart - Gráfico renderizado/atualizado.");
}
function exportVendasCSV() {
    console.log("DEBUG: exportVendasCSV - Iniciando exportação.");
    // ... (lógica interna) ...
}
console.log("DEBUG: Funções do Módulo Admin definidas.");

// --- RELATÓRIOS/EMISSÕES MODULE ---
function setupRelatoriosModule() {
    console.log("DEBUG: setupRelatoriosModule - Iniciando.");
    // Adicionar logs para cada addEventListener
    const btnReemitirOSPdf = document.getElementById('btn-reemitir-os-pdf');
    if (btnReemitirOSPdf) btnReemitirOSPdf.addEventListener('click', () => { console.log("DEBUG: Botão 'Reemitir OS PDF' clicado."); /* ... */ });
    else console.warn("DEBUG: Botão btn-reemitir-os-pdf não encontrado.");
    // ... para todos os outros botões ...
    console.log("DEBUG: setupRelatoriosModule - Concluído.");
}

function populateRelatoriosSelects() {
    console.log("DEBUG: populateRelatoriosSelects - Iniciando.");
    // ... (lógica interna) ...
    console.log("DEBUG: populateRelatoriosSelects - Concluído.");
}

async function generateTermoGarantiaPdf(id, tipoOrigem) {
    console.log(`DEBUG: generateTermoGarantiaPdf - ID: ${id}, Tipo: ${tipoOrigem}`);
    // ... (lógica interna) ...
}

function renderEntregasList(filteredList = null) {
    console.log("DEBUG: renderEntregasList - Iniciando.");
    const tbody = document.getElementById('entregas-list-tbody');
    if (!tbody) { console.error("DEBUG: Tbody de entregas (entregas-list-tbody) não encontrado."); return; }
    // ... (lógica interna) ...
    console.log("DEBUG: renderEntregasList - Concluído.");
}

function renderEmprestimosList(filteredList = null) {
    console.log("DEBUG: renderEmprestimosList - Iniciando.");
    const tbody = document.getElementById('emprestimos-list-tbody');
    if (!tbody) { console.error("DEBUG: Tbody de empréstimos (emprestimos-list-tbody) não encontrado."); return; }
    // ... (lógica interna) ...
    console.log("DEBUG: renderEmprestimosList - Concluído.");
}

function filterEntregasList() {
    console.log("DEBUG: filterEntregasList - Iniciando.");
    // ... (lógica interna) ...
}

function filterEmprestimosList() {
    console.log("DEBUG: filterEmprestimosList - Iniciando.");
    // ... (lógica interna) ...
}
console.log("DEBUG: Funções do Módulo Relatórios/Emissões definidas.");

// --- ASSISTENTE DE DIAGNÓSTICO MODULE ---
function setupAssistenteDiagnosticoModule() {
    console.log("DEBUG: setupAssistenteDiagnosticoModule - Iniciando.");
    const deviceTypeSelect = document.getElementById('diag-device-type');
    const descriptionTextarea = document.getElementById('diag-problem-description');
    const charCountSpan = document.getElementById('diag-char-count');
    const analisarBtn = document.getElementById('btn-analisar-problema');

    if (deviceTypeSelect) {
        populateDiagDeviceTypes(); // Popula o select ao configurar o módulo
    } else { console.warn("DEBUG: Select de tipo de dispositivo do diagnóstico não encontrado."); }

    if (descriptionTextarea && charCountSpan) {
        descriptionTextarea.addEventListener('input', updateDiagCharCount);
        updateDiagCharCount();
        console.log("DEBUG: Listener de input e contador de caracteres do diagnóstico configurados.");
    } else { console.warn("DEBUG: Textarea ou contador de caracteres do diagnóstico não encontrados."); }

    if (analisarBtn) {
        analisarBtn.addEventListener('click', () => {
            console.log("DEBUG: Botão 'Analisar Problema' do diagnóstico clicado.");
            analisarProblemaDiagnostico();
        });
    } else { console.warn("DEBUG: Botão 'Analisar Problema' do diagnóstico não encontrado."); }
    console.log("DEBUG: setupAssistenteDiagnosticoModule - Concluído.");
}

function populateDiagDeviceTypes(){
    console.log("DEBUG: populateDiagDeviceTypes - Iniciando.");
    const deviceTypeSelect = document.getElementById('diag-device-type');
    if(deviceTypeSelect){
        deviceTypeSelect.innerHTML = ''; 
        DIAGNOSTIC_DEVICE_TYPES.forEach(device => {
            deviceTypeSelect.add(new Option(device.label, device.value));
        });
        console.log("DEBUG: populateDiagDeviceTypes - Select populado.");
    } else { console.warn("DEBUG: populateDiagDeviceTypes - Select não encontrado.");}
}

function updateDiagCharCount() {
    // console.log("DEBUG: updateDiagCharCount - Atualizando contagem."); // Pode ser muito verboso
    // ... (lógica interna) ...
}

function analisarProblemaDiagnostico() {
    console.log("DEBUG: analisarProblemaDiagnostico - Iniciando análise.");
    // ... (lógica interna) ...
    console.log("DEBUG: analisarProblemaDiagnostico - Análise concluída.");
}
console.log("DEBUG: Funções do Módulo Assistente de Diagnóstico definidas.");


// --- SEARCH/FILTER FUNCTIONS (gerais) ---
function setupSearchFilterListeners() {
    console.log("DEBUG: setupSearchFilterListeners - Configurando listeners de busca gerais.");
    const el = id => document.getElementById(id);
    const btnSearchProdServ = el('btn-search-prodserv');
    if(btnSearchProdServ) btnSearchProdServ.addEventListener('click', filterProductServiceList);
    else console.warn("DEBUG: Botão btn-search-prodserv não encontrado.");

    const searchProdServInput = el('searchProductServiceInput');
    if(searchProdServInput) searchProdServInput.addEventListener('keyup', (e) => { if(e.key === 'Enter') filterProductServiceList();});
    else console.warn("DEBUG: Campo searchProductServiceInput não encontrado.");

    const searchOSInputEl = el('searchOSInput');
    if(searchOSInputEl) searchOSInputEl.addEventListener('keyup', (e) => { if(e.key === 'Enter') filterOSList(); });
    else console.warn("DEBUG: Campo searchOSInput não encontrado.");
    const btnSearchOS = el('btn-search-os'); // Botão de busca OS
    if(btnSearchOS) btnSearchOS.addEventListener('click', filterOSList);
    else console.warn("DEBUG: Botão btn-search-os não encontrado.");


    const searchClientInputEl = el('searchClientInput');
    if(searchClientInputEl) searchClientInputEl.addEventListener('keyup', (e) => { if(e.key === 'Enter') filterClientList(); });
    else console.warn("DEBUG: Campo searchClientInput não encontrado.");
    const btnSearchClient = el('btn-search-client'); // Botão de busca Cliente
    if(btnSearchClient) btnSearchClient.addEventListener('click', filterClientList);
    else console.warn("DEBUG: Botão btn-search-client não encontrado.");

    console.log("DEBUG: setupSearchFilterListeners - Concluído.");
}
console.log("DEBUG: Funções de Search/Filter definidas.");

// --- BACKUP/RESTORE ---
function setupBackupRestoreModule() {
    console.log("DEBUG: setupBackupRestoreModule - Iniciando.");
    const el = id => document.getElementById(id);
    const btnExport = el('btn-export-data');
    if(btnExport) btnExport.addEventListener('click', exportData);
    else console.warn("DEBUG: Botão btn-export-data não encontrado.");

    const importFileEl = el('importFile');
    if(importFileEl) importFileEl.addEventListener('change', importData);
    else console.warn("DEBUG: Campo importFile não encontrado.");

    const btnReset = el('btn-reset-data');
    if(btnReset) btnReset.addEventListener('click', resetAllDataWarning);
    else console.warn("DEBUG: Botão btn-reset-data não encontrado.");
    console.log("DEBUG: setupBackupRestoreModule - Concluído.");
}
function exportData() {
    console.log("DEBUG: exportData - Iniciando exportação de dados.");
    const dataToExport = { 
        config: STORE_CONFIG, 
        clientes: CLIENTES, 
        produtos: PRODUTOS, 
        servicos: SERVICOS, 
        os: ORDENS_SERVICO, 
        vendas: VENDAS, 
        tecnicos: TECNICOS, 
        entregas: ENTREGAS,
        emprestimos: EMPRESTIMOS_CONSOLE
    };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `luckhouse_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast("Dados exportados com sucesso!", "success");
    console.log("DEBUG: exportData - Exportação concluída.");
}
function importData(event) {
    console.log("DEBUG: importData - Arquivo selecionado para importação.");
    // ... (lógica interna, já ajustada para novos arrays) ...
}
function resetAllDataWarning() {
    console.log("DEBUG: resetAllDataWarning - Aviso de reset iniciado.");
    // ... (lógica interna) ...
}
console.log("DEBUG: Funções de Backup/Restore definidas.");

// --- INITIALIZATION & NAVIGATION ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG: DOMContentLoaded - Evento disparado.");
    try {
        console.log("DEBUG: DOMContentLoaded - Dentro do try block.");
        const el = id => {
            const element = document.getElementById(id);
            if (!element) {
                console.warn(`DEBUG: DOMContentLoaded - Elemento com ID '${id}' NÃO encontrado no DOM.`);
            }
            return element;
        };
        console.log("DEBUG: DOMContentLoaded - Função 'el' definida.");

        const menuToggle = el('menu-toggle'); 
        const wrapper = el('wrapper');
        const currentYearSpan = el('currentYear'); 
        const footerCurrentYearSpan = el('footerCurrentYear');
        const formLoginEl = el('formLogin'); 
        const logoutButtonEl = el('logout-button');
        console.log("DEBUG: DOMContentLoaded - Elementos básicos da UI referenciados.");
        
        if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
        if (footerCurrentYearSpan) footerCurrentYearSpan.textContent = new Date().getFullYear();
        console.log("DEBUG: DOMContentLoaded - Anos atualizados no rodapé.");

        console.log("DEBUG: DOMContentLoaded - Chamando loadAllData().");
        loadAllData(); // Carrega STORE_CONFIG e outros dados, aplica tema inicial.
        console.log("DEBUG: DOMContentLoaded - loadAllData() concluído.");

        console.log("DEBUG: DOMContentLoaded - Chamando setupStaticModules().");
        setupStaticModules(); // Configura listeners estáticos.
        console.log("DEBUG: DOMContentLoaded - setupStaticModules() concluído.");

        if (formLoginEl) {
            formLoginEl.addEventListener('submit', handleLogin);
            console.log("DEBUG: DOMContentLoaded - Listener de submit para formLogin adicionado.");
        } else { 
            console.error("DEBUG: DOMContentLoaded - Formulário de Login (formLogin) NÃO encontrado!");
        }
        if (logoutButtonEl) {
            logoutButtonEl.addEventListener('click', handleLogout);
            console.log("DEBUG: DOMContentLoaded - Listener de clique para logoutButton adicionado.");
        } else { 
            // Não é um erro fatal se o botão de logout não for encontrado antes do login
            console.warn("DEBUG: DOMContentLoaded - Botão de Logout (logout-button) NÃO encontrado (pode ser normal se não logado).");
        }
        
        const navLinks = document.querySelectorAll('#sidebar-wrapper .nav-link[data-target]');
        if (navLinks.length > 0) {
            navLinks.forEach(link => { 
                link.addEventListener('click', function(e) { 
                    console.log(`DEBUG: Link de navegação clicado: ${this.dataset.target}`);
                    e.preventDefault(); 
                    navigateToSection(this.dataset.target, this); 
                    if (wrapper && window.innerWidth<768 && wrapper.classList.contains('toggled')) { 
                        wrapper.classList.remove('toggled'); 
                    } 
                }); 
            });
            console.log("DEBUG: DOMContentLoaded - Listeners de clique para navLinks adicionados.");
        } else { console.error("DEBUG: DOMContentLoaded - Links de navegação da Sidebar NÃO encontrados!"); }
        
        document.querySelectorAll('.dashboard-card').forEach(card => {
            if(card){
                card.addEventListener('click', function() {
                    const target = this.dataset.target;
                    console.log(`DEBUG: Card do Dashboard clicado! Target: ${target}, ID do Card: ${this.id}`);
                    if(this.id === 'card-nova-os'){
                        const modalNovaOsEl = document.getElementById('modalNovaOS');
                        if(modalNovaOsEl) {
                            const formOS = document.getElementById('formNovaOS');
                            if(formOS) formOS.reset();
                            document.getElementById('os-id').value = ''; // Limpa ID para nova OS
                            const modalTitle = document.getElementById('modalNovaOSLabelDynamic');
                            if(modalTitle) modalTitle.textContent = 'Nova Ordem de Serviço';
                            document.getElementById('os-equip-tipo-outro').classList.add('d-none');
                            document.getElementById('os-equip-marca-outra').classList.add('d-none');
                            document.getElementById('os-garantia-extendida-valor-info').textContent = '';
                            document.getElementById('btn-notificar-admin-os').classList.add('d-none');
                            document.getElementById('btn-registrar-emprestimo-console-os').classList.add('d-none');
                            updateTermoGarantiaPreview();
                            populateClienteSelect();
                            updateOSPrazoInfo(null, null, false);
                            bootstrap.Modal.getOrCreateInstance(modalNovaOsEl).show();
                        } else console.error("DEBUG: Modal de Nova OS não encontrado para ser aberto pelo card.");
                    } else if (target) {
                        navigateToSection(target);
                    }
                });
            }
        });
        console.log("DEBUG: DOMContentLoaded - Listeners de clique para dashboard-card adicionados.");

        if (menuToggle && wrapper) { 
            menuToggle.addEventListener('click', function() { 
                console.log("DEBUG: Menu toggle clicado.");
                wrapper.classList.toggle('toggled'); 
            }); 
            console.log("DEBUG: DOMContentLoaded - Listener de clique para menuToggle adicionado.");
        } else { console.warn("DEBUG: DOMContentLoaded - Menu toggle ou wrapper NÃO encontrado."); }
        
        console.log("DEBUG: DOMContentLoaded - Chamando checkLoginState().");
        checkLoginState(); // Define o estado inicial da UI (login/dashboard) e chama setupAllModulesDynamic se logado.
        console.log("DEBUG: DOMContentLoaded - checkLoginState() concluído.");
        
        // Listeners para Modais (show/hidden)
        ['modalNovaOS', 'modalNovoCliente', 'modalNovoProduto', 'modalNovoServico', 'modalNovoItemRapidoPDV', 
         'modalSelecionarServicoParaTecnico', 'modalRegistrarEntrega', 'modalEmprestimoConsole'].forEach(modalId => {
            const modalEl = el(modalId);
            if (modalEl) {
                modalEl.addEventListener('hidden.bs.modal', function () {
                    console.log(`DEBUG: Modal ${modalId} escondido, resetando formulário.`);
                    const form = this.querySelector('form'); if (form) form.reset();
                    const idInput = form ? form.querySelector('input[type="hidden"]') : null; if (idInput) idInput.value = '';
                    
                    if(modalId === 'modalNovaOS') {
                        el('os-equip-tipo-outro').classList.add('d-none');
                        el('os-equip-marca-outra').classList.add('d-none');
                        el('os-garantia-extendida-valor-info').textContent = '';
                        updateTermoGarantiaPreview();
                        updateOSPrazoInfo(null, null, false);
                        el('btn-notificar-admin-os').classList.add('d-none');
                        el('btn-registrar-emprestimo-console-os').classList.add('d-none');
                    }
                    if(modalId === 'modalNovoItemRapidoPDV') { 
                        const itemEstoqueGroupEl = el('item-rapido-estoque-group'); 
                        const itemTipoSelectEl = el('item-rapido-tipo'); 
                        if (itemEstoqueGroupEl) itemEstoqueGroupEl.style.display = 'block'; 
                        if (itemTipoSelectEl) itemTipoSelectEl.value = 'produto'; 
                    }
                    const dynamicTitleModalIds = {
                        'modalNovaOS': 'modalNovaOSLabelDynamic',
                        'modalNovoCliente': 'modalNovoClienteLabelDynamic',
                        'modalNovoProduto': 'modalNovoProdutoLabelDynamic',
                        'modalNovoServico': 'modalNovoServicoLabelDynamic'
                    };
                    if (dynamicTitleModalIds[modalId]) {
                        const titleEl = document.getElementById(dynamicTitleModalIds[modalId]);
                        if(titleEl && titleEl.textContent.startsWith('Editando')) { // Só reseta se estava editando
                             titleEl.textContent = titleEl.textContent.replace(/Editando.*?:/, 'Novo');
                        }
                    }
                });
                if (modalId === 'modalNovaOS') {
                    modalEl.addEventListener('show.bs.modal', function (event) {
                        console.log(`DEBUG: Modal ${modalId} sendo exibido.`);
                        const relatedButton = event.relatedTarget;
                        const isNewEntry = !relatedButton || (relatedButton && (relatedButton.id === "btn-nova-os-modal" || relatedButton.id === "card-nova-os"));
                        
                        if (isNewEntry) { // Só reseta o título para 'Nova' se for realmente uma nova OS
                             const modalTitle = document.getElementById('modalNovaOSLabelDynamic');
                             if(modalTitle) modalTitle.textContent = 'Nova Ordem de Serviço';
                             document.getElementById('btn-notificar-admin-os').classList.add('d-none');
                             document.getElementById('btn-registrar-emprestimo-console-os').classList.add('d-none');
                             // Resetar o form aqui também é uma boa ideia para garantir
                             const formOS = document.getElementById('formNovaOS');
                             if(formOS) formOS.reset();
                             document.getElementById('os-id').value = '';
                             document.getElementById('os-equip-tipo-outro').classList.add('d-none');
                             document.getElementById('os-equip-marca-outra').classList.add('d-none');
                             document.getElementById('os-garantia-extendida-valor-info').textContent = '';
                             updateOSPrazoInfo(null, null, false);
                        }
                        updateTermoGarantiaPreview();
                        populateClienteSelect();
                        // A visibilidade do botão de empréstimo é tratada no editOS e na lógica de updateOSPrazoInfo
                    });
                }
            } else { console.warn(`DEBUG: DOMContentLoaded - Modal com ID ${modalId} NÃO encontrado para configurar listeners.`); }
        });
        console.log("DEBUG: DOMContentLoaded - Listeners de show/hidden para modais configurados.");
        
        console.log("DEBUG: DOMContentLoaded - FIM do try block. Inicialização principal completa.");
    } catch (error) {
        console.error("DEBUG: ERRO FATAL DURANTE A INICIALIZAÇÃO (DOMContentLoaded):", error);
        try { showToast("Erro crítico na inicialização. Verifique o console (F12).", "danger", "ERRO FATAL"); }
        catch (eInner) { alert("Erro crítico na inicialização. Verifique o console (F12). Detalhe: " + error.message); }
        
        const loginPrompt = document.getElementById('login-prompt');
        if (loginPrompt) { 
            loginPrompt.innerHTML = `<h1 class='text-danger display-4'>Erro Crítico na Aplicação</h1><p class='lead'>O sistema encontrou um problema e não pôde ser iniciado corretamente. Por favor, verifique o console do navegador (pressione F12) para detalhes técnicos.</p><p><small>Detalhe: ${error.message}</small></p>`; 
            loginPrompt.classList.remove('d-none'); 
        }
        document.querySelectorAll('.main-content, .admin-content').forEach(s => s.classList.add('d-none'));
    }
});

function loadAllData() {
    console.groupCollapsed("DEBUG: loadAllData - Iniciando carregamento de todos os dados.");
    try {
        loadAppConfig(); // Carrega STORE_CONFIG primeiro, aplica tema.
        loadTecnicos();
        loadClientes();
        loadProdutos();
        loadServicos();
        loadOrdensServico();
        loadVendas();
        loadEntregas();
        loadEmprestimosConsole();
        
        populateDiagDeviceTypes();
        // setupAllModulesDynamic é chamado após login ou em checkLoginState se já logado.
        // Se não logado, não deve tentar renderizar UIs que dependem de dados.

        console.log("DEBUG: loadAllData - Todos os dados carregados.");
    } catch(e) { console.error("DEBUG: Erro Crítico em loadAllData:", e); showToast("Falha crítica ao carregar todos os dados.", "danger");}
    console.groupEnd();
}

function navigateToSection(targetId, clickedLinkElement = null) {
    console.log(`DEBUG: navigateToSection - Tentando navegar para: ${targetId}`);
    // ... (lógica interna da função, já com logs se necessário) ...
    // Exemplo de log interno:
    // const targetSection = document.getElementById(targetId);
    // if (targetSection) {
    //     console.log(`DEBUG: navigateToSection - Exibindo seção ${targetId}`);
    // } else {
    //     console.error(`DEBUG: navigateToSection - Seção ${targetId} NÃO encontrada!`);
    // }
    // ...
    if (CURRENT_USER && CURRENT_USER.role) {
        console.log(`DEBUG: navigateToSection - Usuário logado, atualizando UI para seção: ${targetId}`);
        if(targetId === 'configuracoes') { updateStoreInfoUI(); renderTecnicosList(); /* populateTecnicoSelects() é chamado em updateStoreInfoUI e loadTecnicos */ }
        else if (targetId === 'os') { renderOSList(); populateClienteSelect(); }
        else if (targetId === 'clientes') renderClientList();
        else if (targetId === 'produtos') { renderProductList(); renderServiceList(); }
        else if (targetId === 'pdv'){ renderPdvItemList(); populatePdvClienteSelect(); fillPdvClientReceiptFields(); }
        else if (targetId === 'dashboard') renderDashboardOSRecentes();
        else if (targetId === 'admin-area' && CURRENT_USER.role === 'admin') renderAdminDashboard();
        else if (targetId === 'relatorios') { populateRelatoriosSelects(); renderEntregasList(); renderEmprestimosList(); }
        else if (targetId === 'assistente-diagnostico') { /* Nada específico ao navegar, já configurado por setup e loadAllData */ }
    }
    console.log(`DEBUG: navigateToSection - Navegação para ${targetId} concluída.`);
}

console.log("DEBUG: FIM DA PARTE 3 do script.js (com debugging) - Script completamente definido.");
// FIM DA PARTE 3 (E DO ARQUIVO SCRIPT.JS)
