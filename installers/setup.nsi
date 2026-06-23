; Print Gateway NSIS Installer
; Build: makensis /DVERSION=1.0.0 /DSOURCE_DIR=... /DOUT_FILE=... setup.nsi

!include "MUI2.nsh"

!ifdef VERSION
  !define APP_VERSION "${VERSION}"
!else
  !define APP_VERSION "1.0.0"
!endif

!ifdef SOURCE_DIR
  !define SOURCE "${SOURCE_DIR}"
!else
  !define SOURCE "..\dist\release\win-x64"
!endif

!ifdef OUT_FILE
  !define OUTFILE "${OUT_FILE}"
!else
  !define OUTFILE "PrintGateway-Setup.exe"
!endif

Name "Print Gateway"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES\PrintGateway"
RequestExecutionLevel admin
Unicode true

!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${SOURCE}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Startup shortcut
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PrintGateway" '"$INSTDIR\print-gateway.exe"'

  ; Desktop shortcut - Open Setup
  CreateShortCut "$DESKTOP\Print Gateway Setup.lnk" "$INSTDIR\Open Setup.bat"

  ; Start Menu
  CreateDirectory "$SMPROGRAMS\Print Gateway"
  CreateShortCut "$SMPROGRAMS\Print Gateway\Print Gateway Setup.lnk" "$INSTDIR\Open Setup.bat"
  CreateShortCut "$SMPROGRAMS\Print Gateway\Stop Print Gateway.lnk" "$INSTDIR\Stop.bat"
  CreateShortCut "$SMPROGRAMS\Print Gateway\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  ; Create .env if missing
  IfFileExists "$INSTDIR\.env" +2 0
    CopyFiles "$INSTDIR\.env.example" "$INSTDIR\.env"

  ; Start service in background
  Exec 'cmd /c start /B "" "$INSTDIR\print-gateway.exe"'
  Sleep 3000
  ExecShell "open" "http://localhost:3000/setup"
SectionEnd

Section "Uninstall"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PrintGateway"
  ExecWait 'taskkill /F /IM print-gateway.exe' $0
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\Print Gateway Setup.lnk"
  RMDir /r "$SMPROGRAMS\Print Gateway"
SectionEnd
