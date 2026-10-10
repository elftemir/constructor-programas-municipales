/**
 * pdfExporter.js - Exportador Oficial a PDF a partir de Microsoft Word (.docx)
 * Constructor de Programas Municipales - Versión 2.0.1 (Fase 2)
 *
 * Flujo estricto: PROYECTO -> DOCX maestro -> Word / Conversor Validado -> PDF
 * Conserva al 100% el diseño visual, fuentes, portada y pie del DOCX.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const docxExporter = require('./docxExporter');

class PdfExporter {
  constructor() {
    this.sofficePaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      'soffice.exe'
    ];
  }

  detectConverters() {
    let wordAvailable = false;
    let libreOfficePath = null;

    // 1. Detectar Microsoft Word mediante PowerShell COM
    try {
      const psCommand = `try { $w = New-Object -ComObject Word.Application; $w.Quit(); [System.Runtime.InteropServices.Marshal]::ReleaseComObject($w) | Out-Null; Write-Output 'OK' } catch { Write-Output 'NO' }`;
      const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
        encoding: 'utf8',
        timeout: 6000,
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
        shell: false
      }).trim();
      if (out.includes('OK')) {
        wordAvailable = true;
      }
    } catch (e) {
      wordAvailable = false;
    }

    // 2. Detectar LibreOffice Writer validado
    for (const p of this.sofficePaths) {
      if (fs.existsSync(p)) {
        libreOfficePath = p;
        break;
      }
    }

    return {
      wordAvailable,
      libreOfficeAvailable: !!libreOfficePath,
      libreOfficePath,
      canConvert: wordAvailable || !!libreOfficePath
    };
  }

  detectConverter() {
    const res = this.detectConverters();
    return {
      available: res.canConvert,
      name: res.wordAvailable ? 'Microsoft Word' : (res.libreOfficeAvailable ? 'LibreOffice' : 'Ninguno'),
      path: res.wordAvailable ? 'COM (Word.Application)' : (res.libreOfficePath || null),
      ...res
    };
  }

  async exportProjectWithPdf(projectId, options = {}) {
    const ProjectService = require('./projectService');
    const project = await ProjectService.getProject(projectId);
    if (!project) throw new Error(`Proyecto ${projectId} no encontrado.`);
    const idioma = options.idioma || project?.idioma_principal || 'es';
    const isCa = idioma === 'ca';
    return await this.exportProjectToPdf(project, { ...options, idioma, isCa });
  }

  async exportProjectToPdf(project, options = {}) {
    const idioma = options.idioma || project?.idioma_principal || 'es';
    const isCa = idioma === 'ca';
    const converters = this.detectConverters();
    
    // 1. Generar primero el documento DOCX maestro
    const docxResult = await docxExporter.exportProjectToDocx(project, { ...options, idioma, isCa });
    const docxPath = docxResult.filePath;

    if (!converters.canConvert) {
      return {
        success: false,
        docxPath,
        docxFilename: docxResult.filename,
        pdfPath: null,
        converters,
        error: 'converter_not_available',
        message: 'Para generar el PDF oficial con diseño idéntico al documento maestro se requiere Microsoft Word (o LibreOffice instalados en el equipo). Puedes abrir el archivo Word generado y guardarlo en PDF directamente.'
      };
    }

    const outputDir = path.dirname(docxPath);
    const docxFilename = path.basename(docxPath);
    const pdfFilename = docxFilename.replace(/\.docx$/i, '.pdf');
    const pdfPath = path.join(outputDir, pdfFilename);

    // 2. Convertir DOCX a PDF
    try {
      if (converters.wordAvailable) {
        // Conversión nativa mediante Microsoft Word COM (sin interpolación en shell)
        const psScript = `
          $inDocx = $env:DOCX_CONVERT_INPUT
          $outPdf = $env:DOCX_CONVERT_OUTPUT
          $word = New-Object -ComObject Word.Application
          $word.Visible = $false
          $doc = $word.Documents.Open($inDocx)
          $doc.SaveAs([ref]$outPdf, [ref]17)
          $doc.Close()
          $word.Quit()
          [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
          [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
        `;
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
          env: {
            ...process.env,
            DOCX_CONVERT_INPUT: docxPath,
            DOCX_CONVERT_OUTPUT: pdfPath
          },
          stdio: 'pipe',
          timeout: 45000,
          windowsHide: true,
          shell: false
        });
      } else if (converters.libreOfficePath) {
        // Conversión validada mediante LibreOffice Headless (argumentos separados, shell: false)
        execFileSync(converters.libreOfficePath, [
          '--headless',
          '--convert-to',
          'pdf',
          '--outdir',
          outputDir,
          docxPath
        ], {
          stdio: 'pipe',
          timeout: 45000,
          windowsHide: true,
          shell: false
        });
      }

      if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1000) {
        return {
          success: true,
          docxPath,
          docxFilename,
          pdfPath,
          pdfFilename,
          converters
        };
      } else {
        throw new Error('El archivo PDF generado no se encontró o tiene tamaño nulo.');
      }
    } catch (err) {
      console.error('Error al convertir DOCX a PDF:', err);
      return {
        success: false,
        docxPath,
        docxFilename,
        pdfPath: null,
        converters,
        error: 'conversion_failed',
        message: `No se pudo completar la conversión automática a PDF: ${err.message}`
      };
    }
  }
}

module.exports = new PdfExporter();
