!macro customInstall
  Delete "$DESKTOP\Constructor de Programas Municipales Podemos.lnk"
  SetShellVarContext all
  Delete "$DESKTOP\Constructor de Programas Municipales Podemos.lnk"
  SetShellVarContext current
  CreateShortCut "$DESKTOP\Constructor de Programas Municipales Podemos.lnk" "$INSTDIR\Constructor de Programas Municipales Podemos.exe" "" "$INSTDIR\app.ico" 0
  SetShellVarContext all
  CreateShortCut "$DESKTOP\Constructor de Programas Municipales Podemos.lnk" "$INSTDIR\Constructor de Programas Municipales Podemos.exe" "" "$INSTDIR\app.ico" 0
  SetShellVarContext current
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  Exec '"$SYSDIR\ie4uinit.exe" -show'
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Constructor de Programas Municipales Podemos.lnk"
  SetShellVarContext all
  Delete "$DESKTOP\Constructor de Programas Municipales Podemos.lnk"
  SetShellVarContext current
  System::Call 'shell32.dll::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
