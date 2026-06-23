; Print Gateway Portable NSIS Installer

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

Name "Print Gateway ${APP_VERSION}"
OutFile "${OUTFILE}"
InstallDir "$PROGRAMFILES\PrintGateway"
RequestExecutionLevel admin
Unicode True

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

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PrintGateway" '"$INSTDIR\Start.bat"'

  CreateShortCut "$DESKTOP\Print Gateway Setup.lnk" "$INSTDIR\Open Setup.bat"
  CreateDirectory "$SMPROGRAMS\Print Gateway"
  CreateShortCut "$SMPROGRAMS\Print Gateway\Setup.lnk" "$INSTDIR\Open Setup.bat"
  CreateShortCut "$SMPROGRAMS\Print Gateway\Stop.lnk" "$INSTDIR\Stop.bat"
  CreateShortCut "$SMPROGRAMS\Print Gateway\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

  IfFileExists "$INSTDIR\app\.env" +2 0
    CopyFiles "$INSTDIR\app\.env.example" "$INSTDIR\app\.env"

  Exec 'cmd /c "$INSTDIR\Start.bat"'
  Sleep 3000
  ExecShell "open" "http://localhost:3000/setup"
SectionEnd

Section "Uninstall"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "PrintGateway"
  ExecWait 'taskkill /F /IM node.exe' $0
  RMDir /r "$INSTDIR"
  Delete "$DESKTOP\Print Gateway Setup.lnk"
  RMDir /r "$SMPROGRAMS\Print Gateway"
SectionEnd
