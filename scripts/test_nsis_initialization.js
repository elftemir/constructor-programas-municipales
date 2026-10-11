// Execute the actual custom NSIS functions with mocked registry primitives.
// No real registry keys, installation folders or user profiles are modified.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(root, 'scratch/nsis-initialization-'));
const localRoots = [process.env.LOCALAPPDATA, path.join(require('os').homedir(), 'AppData/Local')].filter(Boolean);
const candidates = localRoots.map(base => path.join(base, 'electron-builder/Cache/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/Bin/makensis.exe'));
const compiler = process.env.CPM_NSIS_COMPILER || candidates.find(file => fs.existsSync(file));
if (!compiler || !fs.existsSync(compiler)) throw Error('NSIS compiler unavailable. Build first or set CPM_NSIS_COMPILER.');
let include = fs.readFileSync(path.join(root, 'build/installer.nsh'), 'utf8');
include = include.replace(/^(\s*)(EnumRegKey|ReadRegStr|DeleteRegKey|WriteRegStr|SetRegView)\s/gm, '$1!insertmacro Mock$2 ')
  .replaceAll('$PROGRAMFILES64', '$EXEDIR\\Programs').replaceAll('$TEMP', '$EXEDIR\\temp');
fs.mkdirSync(path.join(dir, 'temp'));
fs.writeFileSync(path.join(dir, 'installer-test.nsh'), include);
const harness = String.raw`
Unicode true
RequestExecutionLevel user
SilentInstall silent
Name "NSIS isolated regression"
OutFile "${path.join(dir, 'test.exe')}"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!define VERSION "${JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version}"
!define UNINSTALL_FILENAME "Uninstall Constructor de Programas Municipales Podemos.exe"
!define APP_EXECUTABLE_FILENAME "Constructor de Programas Municipales Podemos.exe"
!define UNINSTALL_REGISTRY_KEY "Software\Mock\Uninstall\guid"
!define INSTALL_REGISTRY_KEY "Software\Mock\guid"
!define COMPANY_NAME "elftemir"
Var installMode
Var testMode
Var testAlive
Var testView
Var testDeletes
Var testControlDeletes

!macro MockSetRegView VIEW
  StrCpy $testView ${'${VIEW}'}
!macroend
!macro MockEnumRegKey OUT ROOT SUB INDEX
  ClearErrors
  StrCpy ${'${OUT}'} ""
  !if "${'${ROOT}'}" == "HKCU"
    ${'${If}'} $testView == 64
    ${'${AndIf}'} $testAlive == 1
    ${'${AndIf}'} ${'${INDEX}'} == 0
      StrCpy ${'${OUT}'} "guid"
    ${'${EndIf}'}
  !endif
!macroend
!macro MockReadRegStr OUT ROOT SUB VALUE
  ClearErrors
  !if "${'${VALUE}'}" == "DisplayName"
    ${'${If}'} $testMode == 3
      StrCpy ${'${OUT}'} "Unrelated app"
    ${'${Else}'}
      StrCpy ${'${OUT}'} "Constructor de Programas Municipales Podemos 3.5.2"
    ${'${EndIf}'}
  !else
    StrCpy ${'${OUT}'} '$\"$EXEDIR\fake-uninstaller.exe$\" /currentuser'
  !endif
!macroend
!macro MockDeleteRegKey ROOT SUB
  ClearErrors
  !if "${'${SUB}'}" == "Software\d88b1329-31ed-5768-a1d9-d8e0626bf064"
    IntOp $testControlDeletes $testControlDeletes + 1
  !else
    StrCpy $testAlive 0
    IntOp $testDeletes $testDeletes + 1
  !endif
!macroend
!macro MockWriteRegStr ROOT SUB VALUE DATA
!macroend
!define nsProcess::FindProcess "!insertmacro MockFindProcess"
!macro MockFindProcess NAME OUT
  StrCpy ${'${OUT}'} 1
!macroend
!define nsProcess::Unload "!insertmacro MockUnload"
!macro MockUnload
!macroend
!include "${path.join(dir, 'installer-test.nsh')}"
!insertmacro customHeader
Section
  ; Native primitive, read only: exhaustion returns empty without Errors.
  ClearErrors
  EnumRegKey $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" 2147483647
  ${'${If}'} $0 != ""
  ${'${OrIf}'} ${'${Errors}'}
    SetErrorLevel 27
    Quit
  ${'${EndIf}'}
  StrCpy $testMode 0
  ${'${Do}'}
    StrCpy $testAlive 1
    StrCpy $testDeletes 0
    StrCpy $testControlDeletes 0
    Delete "$EXEDIR\fake-uninstaller.exe"
    ${'${If}'} $testMode == 0
      StrCpy $testAlive 0
    ${'${ElseIf}'} $testMode == 1
    ${'${OrIf}'} $testMode == 3
      FileOpen $0 "$EXEDIR\fake-uninstaller.exe" w
      FileClose $0
    ${'${EndIf}'}
    Call cpmCleanBeforeInstall
    ${'${If}'} $testMode == 2
      ${'${If}'} $testDeletes != 1
      ${'${OrIf}'} $testAlive != 0
        SetErrorLevel 21
        Quit
      ${'${EndIf}'}
    ${'${Else}'}
      ${'${If}'} $testDeletes != 0
        SetErrorLevel 22
        Quit
      ${'${EndIf}'}
    ${'${EndIf}'}
    ${'${If}'} $testControlDeletes != 0
      SetErrorLevel 23
      Quit
    ${'${EndIf}'}
    IntOp $testMode $testMode + 1
  ${'${LoopUntil}'} $testMode == 4

  ; Logging must preserve registers and NSIS error flags used by the builder.
  StrCpy $0 "sentinel0"
  StrCpy $1 "sentinel1"
  SetErrors
  !insertmacro cpmLog "error-flag preservation"
  ${'${IfNot}'} ${'${Errors}'}
    SetErrorLevel 24
    Quit
  ${'${EndIf}'}
  ${'${If}'} $0 != "sentinel0"
  ${'${OrIf}'} $1 != "sentinel1"
    SetErrorLevel 25
    Quit
  ${'${EndIf}'}
  ClearErrors
  !insertmacro cpmLog "clear-flag preservation"
  ${'${If}'} ${'${Errors}'}
    SetErrorLevel 26
    Quit
  ${'${EndIf}'}
  SetErrorLevel 0
SectionEnd
`;
fs.writeFileSync(path.join(dir, 'test.nsi'), harness);
const compile = spawnSync(compiler, ['/V2', path.join(dir, 'test.nsi')], { windowsHide: true, encoding: 'utf8' });
assert.equal(compile.status, 0, String(compile.error || '') + compile.stdout + compile.stderr);
const run = spawnSync(path.join(dir, 'test.exe'), ['/S'], { windowsHide: true, encoding: 'utf8', timeout: 5000 });
assert.equal(run.status, 0, 'NSIS regression exit=' + run.status + ' ' + (run.error || '') + run.stdout + run.stderr);
const log = fs.readFileSync(path.join(dir, 'temp', `Constructor_instalacion_${JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version}.log`), 'utf8');
assert(log.includes('PREINIT ') && log.includes('SCAN HKLM/64: fin') && log.includes('error-flag preservation') && log.includes('clear-flag preservation'), 'Log must retain all appended stages');
console.log('PASS native NSIS: native read-only EnumRegKey exhaustion; clean start, orphan deletion, active per-user metadata preserved, unrelated entry untouched; logger appends and preserves registers/error flags.');
console.log('Only isolated fixture files were used: ' + dir);
