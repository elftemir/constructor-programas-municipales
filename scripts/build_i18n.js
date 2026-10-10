const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const esPath = path.join(rootDir, 'src', 'renderer', 'locales', 'es.json');
const caPath = path.join(rootDir, 'src', 'renderer', 'locales', 'ca.json');
const outPath = path.join(rootDir, 'src', 'renderer', 'js', 'i18n.js');

const esJson = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const caJson = JSON.parse(fs.readFileSync(caPath, 'utf8'));

// Format JSON strings
const esStr = JSON.stringify(esJson, null, 2);
const caStr = JSON.stringify(caJson, null, 2);

const template = `/**
 * i18n.js - Sistema centralizado de internacionalización (Castellano / Català)
 * Constructor de Programas Municipales - Versión 1.4.2
 * 
 * Soporta claves jerárquicas completas (ej. common.save, navigation.basic_data)
 * y compatibilidad hacia atrás con claves planas anteriores.
 */

const LOCALES = {
  es: ${esStr},
  ca: ${caStr}
};

// Mapeos de compatibilidad plana -> jerárquica para código existente
const LEGACY_ALIASES = {
  'brand.app_name': 'navigation.brand_short',
  'brand.tooltip': 'navigation.brand_tip',
  'top.quick_save': 'topbar.quick_save',
  'top.quick_save_tip': 'topbar.quick_save_tip',
  'top.close_project': 'topbar.close_project',
  'top.close_project_tip': 'topbar.close_project_tip',
  'top.saved': 'topbar.saved',
  'top.saving': 'topbar.saving',

  'sidebar.nav_marco': 'sidebar.nav_framework',
  'sidebar.nav_opciones': 'sidebar.nav_options',
  'sidebar.nav_ayuda': 'sidebar.nav_help',

  'home.card_progress': 'home.progress',
  'home.new_modal_mun_label': 'home.new_modal_mun_label',
  'home.new_modal_mun_placeholder': 'home.new_modal_mun_placeholder',
  'home.new_modal_btn_create': 'home.new_modal_btn_create',

  'municipality.field_municipio': 'basic.field_municipio',
  'municipality.field_municipio_hint': 'basic.field_municipio_hint',
  'municipality.field_provincia': 'basic.field_provincia',
  'municipality.field_comunidad': 'basic.field_comunidad',
  'municipality.field_partido': 'basic.field_partido',
  'municipality.field_mandato': 'basic.field_mandato',
  'municipality.field_organizacion': 'basic.field_organizacion',
  'municipality.field_organizacion_hint': 'basic.field_organizacion_hint',
  'municipality.field_lema': 'basic.field_lema',
  'municipality.field_lema_hint': 'basic.field_lema_hint',
  'municipality.btn_next': 'basic.btn_next',
  'municipality.btn_next_choose': 'basic.btn_next',

  'general.presentation': 'general.sec_pres',
  'general.closing': 'general.sec_cierre',

  'welcome.btn.start': 'welcome.btn_start',
  'welcome.btn.tour': 'welcome.btn_tour'
};

const EMERGENCY_HUMAN_FALLBACKS = {
  'sidebar.nav_framework': { es: 'Ver Programa Marco', ca: 'Veure Programa Marc' },
  'sidebar.nav_options': { es: 'Opciones', ca: 'Opcions' },
  'sidebar.nav_help': { es: 'Ayuda y tutorial', ca: 'Ajuda i tutorial' },
  'welcome.title': { es: 'Tutorial de bienvenida', ca: 'Tutorial de benvinguda' },
  'welcome.desc': { es: 'Conoce las funciones principales del Constructor de Programas Municipales y aprende a crear tu programa paso a paso.', ca: 'Coneix les funcions principals del Constructor de Programes Municipals i aprèn a crear el teu programa pas a pas.' },
  'welcome.btn_start': { es: 'Ahora no', ca: 'Ara no' },
  'welcome.btn.start': { es: 'Ahora no', ca: 'Ara no' },
  'welcome.btn_tour': { es: 'Iniciar tutorial guiado', ca: 'Iniciar tutorial guiat' },
  'welcome.btn.tour': { es: 'Iniciar tutorial guiado', ca: 'Iniciar tutorial guiat' },
  'basic.btn_next': { es: 'Continuar a Elegir medidas →', ca: 'Continuar a Triar mesures →' },
  'basic.field_municipio': { es: 'Municipio', ca: 'Municipi' },
  'basic.field_municipio_hint': { es: 'Escribe para autocompletar entre los 947 municipios de Cataluña por nombre, INE o código postal.', ca: 'Escriu per autocompletar entre els 947 municipis de Catalunya per nom, INE o codi postal.' },
  'basic.field_provincia': { es: 'Provincia', ca: 'Província' },
  'basic.field_comunidad': { es: 'Comunidad Autónoma', ca: 'Comunitat autònoma' },
  'basic.field_partido': { es: 'Partido político', ca: 'Partit polític' },
  'basic.field_mandato': { es: 'Mandato electoral', ca: 'Mandat electoral' },
  'basic.field_organizacion': { es: 'Nombre de la candidatura / Organización local', ca: 'Nom de la candidatura / Organització local' },
  'basic.field_organizacion_hint': { es: 'Nombre de la agrupación local para metadatos y portada del documento.', ca: 'Nom de l\\'agrupació local per a metadades i portada del document.' },
  'basic.field_lema': { es: 'Lema', ca: 'Lema' },
  'basic.field_lema_hint': { es: 'Aparece destacado en la portada de Word en gran bloque tipográfico.', ca: 'Apareix destacat a la portada de Word en un gran bloc tipogràfic.' },
  'help.btn_start_tour': { es: 'Iniciar tutorial guiado', ca: 'Iniciar tutorial guiat' },
  'general.sec_pres': { es: 'Presentación política', ca: 'Presentació política' },
  'general.sec_areas': { es: 'Introducciones por área', ca: 'Introduccions per àrea' },
  'general.sec_cierre': { es: 'Texto de cierre', ca: 'Text de cloenda' }
};

const I18N = {
  currentLang: 'es',
  locales: LOCALES,

  getLang() {
    return this.currentLang || 'es';
  },

  setLang(lang) {
    if (!lang || !this.locales[lang]) {
      lang = 'es';
    }
    this.currentLang = lang;
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
    }
    this.updateStaticElements();
  },

  /**
   * Obtiene un texto traducido mediante clave con notación de punto.
   * Regla obligatoria: NUNCA mostrar una clave técnica interna al usuario.
   */
  t(key, params = {}) {
    if (!key) return '';
    const lang = this.currentLang || 'es';

    // 1. Intentar resolver la clave directamente en el idioma actual
    let val = this.resolvePath(this.locales[lang], key);

    // 2. Si no existe directamente, probar mediante alias
    if (val === undefined && LEGACY_ALIASES[key]) {
      val = this.resolvePath(this.locales[lang], LEGACY_ALIASES[key]);
    }

    // 3. Fallback al idioma español (si el actual es catalán)
    if (val === undefined && lang !== 'es') {
      val = this.resolvePath(this.locales.es, key);
      if (val === undefined && LEGACY_ALIASES[key]) {
        val = this.resolvePath(this.locales.es, LEGACY_ALIASES[key]);
      }
    }

    // 4. Si la clave no se encuentra: NUNCA mostrar la clave técnica al usuario
    if (val === undefined) {
      console.error(\`[i18n ERROR] Clave no encontrada: "\${key}" en idioma: "\${lang}"\`);
      val = this.generateHumanFallback(key, lang);
    }

    let text = String(val);
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(\`\\\\{+\${k}\\\\}}+\`, 'g'), v);
    }
    return text;
  },

  generateHumanFallback(key, lang) {
    const langCode = lang === 'ca' ? 'ca' : 'es';
    if (EMERGENCY_HUMAN_FALLBACKS[key] && EMERGENCY_HUMAN_FALLBACKS[key][langCode]) {
      return EMERGENCY_HUMAN_FALLBACKS[key][langCode];
    }

    // Fallback humano limpio: eliminar prefijos técnicos y capitalizar
    const parts = key.split('.');
    const last = parts[parts.length - 1];
    const cleaned = last.replace(/^(field_|btn_|sec_|nav_|chk_|tab_|lbl_)/, '').replace(/_/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  },

  resolvePath(obj, pathStr) {
    if (!obj || !pathStr) return undefined;
    const parts = pathStr.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr && typeof curr === 'object' && p in curr) {
        curr = curr[p];
      } else {
        return undefined;
      }
    }
    return typeof curr === 'string' ? curr : undefined;
  },

  updateStaticElements() {
    if (typeof document === 'undefined') return;

    // Top bar static elements
    const brandTitleEl = document.querySelector('#nav-brand-title');
    if (brandTitleEl) brandTitleEl.textContent = this.t('navigation.brand_short');
    const brandContainer = document.querySelector('#nav-brand');
    if (brandContainer) brandContainer.title = this.t('navigation.brand_tip');

    const btnQuickSave = document.querySelector('#btn-quick-save');
    if (btnQuickSave) {
      btnQuickSave.textContent = this.t('topbar.quick_save');
      btnQuickSave.title = this.t('topbar.quick_save_tip');
    }

    const btnCloseProj = document.querySelector('#btn-close-project');
    if (btnCloseProj) {
      btnCloseProj.textContent = this.t('topbar.close_project');
      btnCloseProj.title = this.t('topbar.close_project_tip');
    }

    // Sidebar static elements (Nuevo diseño 7/10 y compatibilidad)
    const sidebarTitle = document.querySelector('#sidebar-proj-title');
    if (sidebarTitle) sidebarTitle.textContent = this.t('sidebar.steps_title');

    const navInicio = document.querySelector('#nav-inicio span:nth-child(2)');
    if (navInicio) navInicio.textContent = this.t('nav.home');

    const navMisProg = document.querySelector('#nav-mis-programas span:nth-child(2)');
    if (navMisProg) navMisProg.textContent = this.t('nav.my_programs');

    const navAreas = document.querySelector('#nav-areas-medidas span:nth-child(2)');
    if (navAreas) navAreas.textContent = this.t('nav.areas_measures');

    const navVistaPrevia = document.querySelector('#nav-vista-previa span:nth-child(2)');
    if (navVistaPrevia) navVistaPrevia.textContent = this.t('nav.preview');

    const navGenDocs = document.querySelector('#nav-generar-docs span:nth-child(2)');
    if (navGenDocs) navGenDocs.textContent = this.t('nav.generate_docs');

    const navIa = document.querySelector('#nav-ia span:nth-child(2)');
    if (navIa) navIa.textContent = this.t('nav.ai');

    const badgeIa = document.querySelector('#badge-ia-optional');
    if (badgeIa) badgeIa.textContent = this.t('nav.ai_optional');

    const navAyuda = document.querySelector('#nav-ayuda span:nth-child(2)');
    if (navAyuda) navAyuda.textContent = this.t('nav.help');

    const navConfig = document.querySelector('#nav-configuracion span:nth-child(2)');
    if (navConfig) navConfig.textContent = this.t('nav.settings');

    const step1 = document.querySelector('.step-item[data-step="datos-basicos"] span:nth-child(2)');
    if (step1) step1.textContent = this.t('sidebar.step_1');

    const step2 = document.querySelector('.step-item[data-step="elegir-medidas"] span:nth-child(2)');
    if (step2) step2.textContent = this.t('sidebar.step_2');

    const step3 = document.querySelector('.step-item[data-step="adaptar-medidas"] span:nth-child(2)');
    if (step3) step3.textContent = this.t('sidebar.step_3');

    const step4 = document.querySelector('.step-item[data-step="textos-generales"] span:nth-child(2)');
    if (step4) step4.textContent = this.t('sidebar.step_4');

    const step5 = document.querySelector('.step-item[data-step="revisar-exportar"] span:nth-child(2)');
    if (step5) step5.textContent = this.t('sidebar.step_5');

    const navMarco = document.querySelector('#nav-marco span:nth-child(2)');
    if (navMarco) navMarco.textContent = this.t('sidebar.nav_framework');

    const navOpciones = document.querySelector('#nav-opciones span:nth-child(2)');
    if (navOpciones) navOpciones.textContent = this.t('sidebar.nav_options');

    const noticeBox = document.querySelector('.sidebar-bottom .notice-box');
    if (noticeBox) {
      noticeBox.innerHTML = \`
        <b>\${this.t('sidebar.offline_title')}</b><br>
        \${this.t('sidebar.offline_desc')}<br>
        \${this.t('sidebar.catalog_version')}
      \`;
    }
  }
};

if (typeof window !== 'undefined') {
  window.i18n = I18N;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18N;
}
`;

fs.writeFileSync(outPath, template, 'utf8');
console.log(`[build_i18n] Successfully bundled i18n to ${outPath}`);
