// Native Windows .lnk regression, entirely inside scratch; never installs the app.
const fs = require('fs'); const path = require('path'); const assert = require('assert');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const dir = fs.mkdtempSync(path.join(root, 'scratch/nsis-shortcuts-'));
const cache = [process.env.LOCALAPPDATA, path.join(require('os').homedir(), 'AppData/Local')].filter(Boolean);
const compiler = process.env.CPM_NSIS_COMPILER || cache.map(p => path.join(p, 'electron-builder/Cache/nsis-3.0.4.1/nsis-3.0.4.1-1mx3n/Bin/makensis.exe')).find(fs.existsSync);
assert(compiler, 'NSIS compiler unavailable');
const name = 'Constructor de Programas Municipales Podemos';
const appDir = path.join(dir, 'Programs', name);
for (const d of ['PublicDesktop', 'CurrentDesktop', 'PublicStart', 'CurrentStart', 'temp']) fs.mkdirSync(path.join(dir, d), { recursive: true });
fs.mkdirSync(appDir, { recursive: true });
fs.writeFileSync(path.join(appDir, name + '.exe'), 'fixture target; never executed');
let custom = fs.readFileSync(path.join(root, 'build/installer.nsh'), 'utf8');
custom = custom.replaceAll('$DESKTOP', '$testDesktop').replaceAll('$SMPROGRAMS', '$testStart')
  .replaceAll('$TEMP', '$EXEDIR\\temp').replace(/^(\s*)SetShellVarContext\s+/gm, '$1!insertmacro MockShellContext ');
fs.writeFileSync(path.join(dir, 'custom.nsh'), custom);
// Reuse the exact desktop-creation macro from this project's electron-builder.
let native = fs.readFileSync(path.join(root, 'node_modules/app-builder-lib/templates/nsis/include/installer.nsh'), 'utf8')
  .match(/!macro addDesktopLink keepShortcuts[\s\S]*?!macroend/)[0];
native = native.replace(/WinShell::SetLnkAUMI[^\r\n]*/g, 'StrCpy $testAumi "${APP_ID}"')
  .replace(/WinShell::UninstShortcut[^\r\n]*/g, '; plugin bookkeeping only');
fs.writeFileSync(path.join(dir, 'native.nsh'), native);
const harness = String.raw`
Unicode true
RequestExecutionLevel user
SilentInstall silent
Name "Isolated desktop shortcut regression"
OutFile "${path.join(dir, 'test.exe')}"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!define VERSION "${JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version}"
!define APP_EXECUTABLE_FILENAME "${name}.exe"
!define APP_DESCRIPTION "Constructor de Programas Municipales"
!define APP_ID "org.podemos.constructor.municipal"
!define RECREATE_DESKTOP_SHORTCUT
!define isNoDesktopShortcut '$testNoDesktop == 1'
!define isUpdated '$testUpdated == 1'
Var appExe
Var newDesktopLink
Var oldDesktopLink
Var keepShortcuts
Var testDesktop
Var testStart
Var testUpdated
Var testNoDesktop
Var testAumi
Var testCase
!macro MockShellContext MODE
  !if "${'${MODE}'}" == "all"
    StrCpy $testDesktop "$EXEDIR\PublicDesktop"
    StrCpy $testStart "$EXEDIR\PublicStart"
  !else
    StrCpy $testDesktop "$EXEDIR\CurrentDesktop"
    StrCpy $testStart "$EXEDIR\CurrentStart"
  !endif
!macroend
!include "${path.join(dir, 'native.nsh')}"
!include "${path.join(dir, 'custom.nsh')}"
!insertmacro cpmLogFunction
Function testUninstall
  !insertmacro customUnInstall
FunctionEnd
Section
  StrCpy $INSTDIR "$EXEDIR\Programs\${name}"
  StrCpy $oldDesktopLink "$EXEDIR\PublicDesktop\${name}.lnk"
  StrCpy $testNoDesktop 0
  StrCpy $testCase 0
  StrCpy $keepShortcuts "true"
  ${'${Do}'}
    StrCpy $testUpdated 0
    ${'${If}'} $testCase >= 2
      StrCpy $testUpdated 1
    ${'${EndIf}'}
    ${'${If}'} $testCase == 0
    ${'${OrIf}'} $testCase == 2
      Delete "$oldDesktopLink"
    ${'${Else}'}
      CreateShortCut "$oldDesktopLink" "$EXEDIR\obsolete.exe"
    ${'${EndIf}'}
    !insertmacro cpmEnsureDesktopShortcut
    !insertmacro cpmLog "TEST case=$testCase old=$oldDesktopLink new=$newDesktopLink keep=$keepShortcuts"
    ${'${IfNot}'} ${'${FileExists}'} "$oldDesktopLink"
      SetErrorLevel 31
      Quit
    ${'${EndIf}'}
    ${'${If}'} $testAumi != "${'${APP_ID}'}"
      SetErrorLevel 32
      Quit
    ${'${EndIf}'}
    CopyFiles /SILENT "$oldDesktopLink" "$EXEDIR\case-$testCase.lnk"
    IntOp $testCase $testCase + 1
  ${'${LoopUntil}'} $testCase == 4
  CreateShortCut "$EXEDIR\CurrentDesktop\${name}.lnk" "$INSTDIR\${name}.exe"
  StrCpy $testUpdated 1
  Call testUninstall
  ${'${IfNot}'} ${'${FileExists}'} "$oldDesktopLink"
  ${'${OrIfNot}'} ${'${FileExists}'} "$EXEDIR\CurrentDesktop\${name}.lnk"
    SetErrorLevel 33
    Quit
  ${'${EndIf}'}
  StrCpy $testUpdated 0
  Call testUninstall
  ${'${If}'} ${'${FileExists}'} "$oldDesktopLink"
  ${'${OrIf}'} ${'${FileExists}'} "$EXEDIR\CurrentDesktop\${name}.lnk"
    SetErrorLevel 34
    Quit
  ${'${EndIf}'}
  SetErrorLevel 0
SectionEnd
`;
fs.writeFileSync(path.join(dir, 'test.nsi'), harness.replaceAll('${name}', name));
const compile = spawnSync(compiler, ['/V2', path.join(dir, 'test.nsi')], { windowsHide: true, encoding: 'utf8' });
assert.equal(compile.status, 0, String(compile.error || '') + compile.stdout + compile.stderr);
const run = spawnSync(path.join(dir, 'test.exe'), ['/S'], { windowsHide: true, encoding: 'utf8', timeout: 10000 });
assert.equal(run.status, 0, 'Native shortcut regression: ' + run.status + ' ' + (run.error || ''));
const ps = String.raw`$taskShell = New-Object -ComObject WScript.Shell; $taskResults = 0..3 | ForEach-Object { $taskLink = $taskShell.CreateShortcut((Join-Path $env:CPM_SHORTCUT_TEST_DIR "case-$_.lnk")); [PSCustomObject]@{ target=$taskLink.TargetPath; icon=$taskLink.IconLocation; working=$taskLink.WorkingDirectory } }; ConvertTo-Json -InputObject @($taskResults) -Compress`;
const checked = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, encoding: 'utf8', env: { ...process.env, CPM_SHORTCUT_TEST_DIR: dir } });
assert.equal(checked.status, 0, checked.stderr);
const links = JSON.parse(checked.stdout.trim()); assert.equal(links.length, 4);
for (const link of links) {
  assert.equal(link.target.toLowerCase(), path.join(appDir, name + '.exe').toLowerCase());
  assert.equal(link.working.toLowerCase(), appDir.toLowerCase());
  assert(link.icon.toLowerCase().startsWith(path.join(appDir, name + '.exe').toLowerCase()));
}
console.log('PASS native shortcuts: clean install, reinstall, update with missing link, obsolete target replaced; correct target/icon/working directory; update preserves links; manual uninstall removes current and public links.');
console.log('Only fixture files inside ' + dir + ' were modified; no real desktop, registry or installation changes.');
