; Identidad permanente: conservar appId/productName y el GUID generado.
!define CPM_ROOT "Software\Microsoft\Windows\CurrentVersion\Uninstall"
!define CPM_GUID "d88b1329-31ed-5768-a1d9-d8e0626bf064"
!define CPM_NAME "Constructor de Programas Municipales Podemos"
!define CPM_PREFIX "Constructor de Programas Municipales"

!ifndef BUILD_UNINSTALLER
  Var cpmIndex
  Var cpmKey
  Var cpmName
  Var cpmCommand
  Var cpmExe
  Var cpmChar
  Var cpmPosition
  Var cpmQuoted
  Var cpmResult
  Var cpmLogMessage

  !macro cpmLog TEXT
    Push "${TEXT}"
    Call cpmWriteLog
  !macroend

  !macro cpmLogFunction
  Function cpmWriteLog
    Exch $cpmLogMessage
    Push $0
    Push $1
    ${If} ${Errors}
      StrCpy $1 1
    ${Else}
      StrCpy $1 0
    ${EndIf}
    ClearErrors
    FileOpen $0 "$TEMP\Constructor_instalacion_${VERSION}.log" a
    ${IfNot} ${Errors}
      FileSeek $0 0 END
      FileWrite $0 "$cpmLogMessage$\r$\n"
      FileClose $0
    ${EndIf}
    ${If} $1 == 1
      SetErrors
    ${Else}
      ClearErrors
    ${EndIf}
    Pop $1
    Pop $0
    Pop $cpmLogMessage
  FunctionEnd
  !macroend

  !macro cpmParseFunction
  Function cpmParseUninstaller
    ; Rutas entre comillas o antiguas sin comillas. Ignorar argumentos del registro.
    StrCpy $cpmExe ""
    StrCpy $cpmPosition 0
    StrCpy $cpmQuoted 0
    StrCpy $cpmChar $cpmCommand 1
    ${If} $cpmChar == '$\"'
      StrCpy $cpmQuoted 1
      StrCpy $cpmPosition 1
    ${EndIf}
    ${Do}
      StrCpy $cpmChar $cpmCommand 1 $cpmPosition
      ${If} $cpmChar == ""
        ${Break}
      ${EndIf}
      ${If} $cpmQuoted == 1
      ${AndIf} $cpmChar == '$\"'
        ${Break}
      ${EndIf}
      StrCpy $cpmExe "$cpmExe$cpmChar"
      IntOp $cpmPosition $cpmPosition + 1
      ${If} $cpmQuoted == 0
        StrCpy $cpmChar $cpmExe 4 -4
        ${If} $cpmChar == ".exe"
          ${Break}
        ${EndIf}
      ${EndIf}
    ${Loop}
  FunctionEnd
  !macroend

  !macro cpmCleanRegistry ROOT VIEW
    SetRegView ${VIEW}
    !insertmacro cpmLog "SCAN ${ROOT}/${VIEW}: inicio"
    StrCpy $cpmIndex 0
    ${Do}
      ClearErrors
      EnumRegKey $cpmKey ${ROOT} "${CPM_ROOT}" $cpmIndex
      ${If} ${Errors}
      ${OrIf} $cpmKey == ""
        ; EnumRegKey devuelve vacio SIN Errors al agotar las claves.
        ${Break}
      ${EndIf}
      ReadRegStr $cpmName ${ROOT} "${CPM_ROOT}\$cpmKey" DisplayName
      StrLen $cpmPosition "${CPM_PREFIX}"
      StrCpy $cpmName $cpmName $cpmPosition
      ${If} $cpmName == "${CPM_PREFIX}"
        ReadRegStr $cpmCommand ${ROOT} "${CPM_ROOT}\$cpmKey" UninstallString
        Call cpmParseUninstaller
        ${IfNot} ${FileExists} "$cpmExe"
          ClearErrors
          DeleteRegKey ${ROOT} "${CPM_ROOT}\$cpmKey"
          ${If} ${Errors}
            MessageBox MB_OK|MB_ICONSTOP "No se pudo retirar una entrada huérfana. Reinicia el instalador como administrador." /SD IDOK
            SetErrorLevel 2
            Quit
          ${EndIf}
          StrCpy $cpmIndex 0
          ${Continue}
        ${Else}
          ; Conservar una instalacion valida y sus metadatos hasta pulsar Instalar.
          ; electron-builder ya migra HKCU -> HKLM en installSection.nsh, usando
          ; /S /KEEP_APP_DATA --updated, _?= y ExecWait. No duplicar ese recorrido
          ; desde preInit, antes de inicializar el instalador.
          !insertmacro cpmLog "ACTIVE ${ROOT}/${VIEW}: $cpmExe; conservar para desinstalacion nativa"
        ${EndIf}
      ${EndIf}
      IntOp $cpmIndex $cpmIndex + 1
    ${Loop}
    !insertmacro cpmLog "SCAN ${ROOT}/${VIEW}: fin"
  !macroend

  !macro cpmCleanFunction
  Function cpmCleanBeforeInstall
    !insertmacro cpmLog "PREINIT ${VERSION}: inicio de limpieza de huerfanos"
    !insertmacro cpmCleanRegistry HKLM 64
    !insertmacro cpmCleanRegistry HKLM 32
    !insertmacro cpmCleanRegistry HKCU 64
    !insertmacro cpmCleanRegistry HKCU 32
    ; Una antigua instalacion compartida por HKCU/HKLM puede dejar HKLM huerfano.
    !insertmacro cpmCleanRegistry HKLM 64
    !insertmacro cpmCleanRegistry HKLM 32
    ; NO borrar InstallLocation/KeepShortcuts de una instalacion HKCU valida:
    ; el desinstalador nativo los necesita. Se retiran al completar customInstall.
    SetRegView 64
    SetShellVarContext all
    StrCpy $INSTDIR "$PROGRAMFILES64\${CPM_NAME}"
    SetOutPath $TEMP
    ${If} ${FileExists} "$INSTDIR\*.*"
    ${AndIfNot} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
      ; Nunca borrar una ruta tomada del registro: solo esta ruta fija.
      System::Call 'kernel32::GetFileAttributesW(w "$INSTDIR") i .r0'
      IntOp $0 $0 & 0x400
      ${If} $0 != 0
        MessageBox MB_OK|MB_ICONSTOP "La carpeta de instalación es un enlace o junction. No se borrará automáticamente." /SD IDOK
        SetErrorLevel 2
        Quit
      ${EndIf}
      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $cpmResult
      ${nsProcess::Unload}
      ${If} $cpmResult == 0
        MessageBox MB_OK|MB_ICONSTOP "Cierra el Constructor antes de reparar la instalación incompleta." /SD IDOK
        SetErrorLevel 2
        Quit
      ${EndIf}
      ClearErrors
      RMDir /r "$INSTDIR"
      ${If} ${Errors}
        MessageBox MB_OK|MB_ICONSTOP "No se pudo limpiar la instalación incompleta. Cierra la aplicación y vuelve a intentarlo." /SD IDOK
        SetErrorLevel 2
        Quit
      ${EndIf}
    ${EndIf}
  FunctionEnd
  !macroend
!endif

!macro customHeader
  ; El include se lee antes de common.nsh; emitir funciones tras cargar sus macros.
  !ifndef BUILD_UNINSTALLER
    !insertmacro cpmLogFunction
    !insertmacro cpmParseFunction
    !insertmacro cpmCleanFunction
  !endif
!macroend

!macro preInit
  ; customInit se ejecuta DESPUES de initMultiUser en electron-builder 26.15.3.
  ; preInit permite limpiar antes de detectar instalaciones anteriores.
  !ifndef BUILD_UNINSTALLER
    Call cpmCleanBeforeInstall
  !endif
!macroend

!macro customInit
  ; No aceptar una ruta heredada ni /D= para la nueva instalacion.
  SetRegView 64
  SetShellVarContext all
  StrCpy $installMode "all"
  StrCpy $INSTDIR "$PROGRAMFILES64\${CPM_NAME}"
  !insertmacro cpmLog "INIT: modo=all; destino=$INSTDIR"
!macroend

!macro cpmCheckUninstall RESULT_ROOT
  ; Comprobar Errors ANTES de escribir el log: FileOpen altera esa bandera.
  ${If} ${Errors}
    !insertmacro cpmLog "ERROR: no se pudo ejecutar desinstalador ${RESULT_ROOT}"
    MessageBox MB_OK|MB_ICONSTOP "No se pudo iniciar el desinstalador de la versión anterior (${RESULT_ROOT}). No se ha completado la instalación.$\r$\nConsulta: $TEMP\Constructor_instalacion_${VERSION}.log" /SD IDOK
    SetErrorLevel 2
    Quit
  ${ElseIf} $R0 != 0
    !insertmacro cpmLog "ERROR: desinstalador ${RESULT_ROOT} devolvio $R0"
    MessageBox MB_OK|MB_ICONSTOP "El desinstalador anterior devolvió el código $R0 (${RESULT_ROOT}).$\r$\nConsulta: $TEMP\Constructor_instalacion_${VERSION}.log" /SD IDOK
    SetErrorLevel 2
    Quit
  ${Else}
    !insertmacro cpmLog "UNINSTALL ${RESULT_ROOT}: correcto o sin instalacion anterior"
    ClearErrors
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro cpmCheckUninstall HKLM
!macroend

!macro customUnInstallCheckCurrentUser
  !insertmacro cpmCheckUninstall HKCU
!macroend

!macro cpmRemoveShortcuts
  SetShellVarContext current
  Delete "$DESKTOP\${CPM_NAME}.lnk"
  Delete "$SMPROGRAMS\${CPM_NAME}.lnk"
  Delete "$SMPROGRAMS\${CPM_NAME}\${CPM_NAME}.lnk"
  RMDir "$SMPROGRAMS\${CPM_NAME}"
  SetShellVarContext all
  Delete "$DESKTOP\${CPM_NAME}.lnk"
  Delete "$SMPROGRAMS\${CPM_NAME}.lnk"
  Delete "$SMPROGRAMS\${CPM_NAME}\${CPM_NAME}.lnk"
  RMDir "$SMPROGRAMS\${CPM_NAME}"
  ; Crucial: terminar en ALL para que SHELL_CONTEXT apunte a HKLM.
!macroend

!macro cpmEnsureDesktopShortcut
  ; Reutilizar el creador nativo, incluido su icono y AppUserModelID.
  ; No conservar la ausencia de un acceso al reinstalar o actualizar.
  SetShellVarContext all
  SetOutPath "$INSTDIR"
  StrCpy $appExe "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  StrCpy $newDesktopLink "$DESKTOP\${CPM_NAME}.lnk"
  ; En esta version del builder, addDesktopLink lee la variable global.
  Push $keepShortcuts
  StrCpy $keepShortcuts "false"
  !insertmacro addDesktopLink $keepShortcuts
  Pop $keepShortcuts
  ${IfNot} ${isNoDesktopShortcut}
    ${If} ${FileExists} "$newDesktopLink"
      !insertmacro cpmLog "SHORTCUT: acceso de escritorio creado en $newDesktopLink"
    ${Else}
      !insertmacro cpmLog "ERROR SHORTCUT: no se pudo crear $newDesktopLink"
      MessageBox MB_OK|MB_ICONEXCLAMATION "La aplicación se ha instalado, pero Windows no ha permitido crear el acceso directo del escritorio.$\r$\nConsulta: $TEMP\Constructor_instalacion_${VERSION}.log" /SD IDOK
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  !insertmacro cpmLog "FILES: archivos instalados; finalizando registro y accesos directos"
  ; electron-builder crea los accesos publicos. Retirar duplicados personales.
  SetShellVarContext current
  Delete "$DESKTOP\${CPM_NAME}.lnk"
  Delete "$SMPROGRAMS\${CPM_NAME}.lnk"
  SetShellVarContext all
  !insertmacro cpmEnsureDesktopShortcut
  SetRegView 32
  DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
  SetRegView 64
  DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
  WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" DisplayVersion "${VERSION}"
  WriteRegStr HKLM "${UNINSTALL_REGISTRY_KEY}" Publisher "${COMPANY_NAME}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  !insertmacro cpmLog "SUCCESS ${VERSION}: $INSTDIR"
!macroend

!macro customUnInstall
  Var /GLOBAL cpmDeleteData
  StrCpy $cpmDeleteData 0
  ${IfNot} ${isUpdated}
    ${IfNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "¿Quieres borrar también tus proyectos y datos?$\r$\n$\r$\nSi respondes No, se conservan en:$\r$\n%APPDATA%\${CPM_NAME}$\r$\n%APPDATA%\constructor-programas-municipales$\r$\n$\r$\nSi respondes Sí, se borrarán también las copias internas, configuración, modelos de IA y caché de actualización de este usuario." /SD IDNO IDNO +2
      StrCpy $cpmDeleteData 1
    ${EndIf}
  ${EndIf}
  ; Al actualizar, respetar la conservacion de accesos del desinstalador nativo.
  ${IfNot} ${isUpdated}
    !insertmacro cpmRemoveShortcuts
  ${EndIf}
  SetShellVarContext all
  SetRegView 64
!macroend

!macro customUnInstallSection
  ; Despues del borrado estandar: mantener el borrado atomico y rollback al actualizar.
  Section "un.CPMCleanup"
    SectionIn RO
    ${IfNot} ${isUpdated}
    ${AndIf} $cpmDeleteData == 1
      SetShellVarContext current
      RMDir /r "$APPDATA\${CPM_NAME}"
      RMDir /r "$APPDATA\constructor-programas-municipales"
      RMDir /r "$LOCALAPPDATA\${CPM_NAME}"
      RMDir /r "$LOCALAPPDATA\constructor-programas-municipales-updater"
    ${EndIf}
    SetShellVarContext all
    SetRegView 32
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
    SetRegView 64
    DeleteRegKey HKLM "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${UNINSTALL_REGISTRY_KEY}"
    DeleteRegKey HKLM "${INSTALL_REGISTRY_KEY}"
    DeleteRegKey HKCU "${INSTALL_REGISTRY_KEY}"
    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  SectionEnd
!macroend
