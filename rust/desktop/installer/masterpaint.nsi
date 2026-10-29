; Installeur Windows de la version Rust de MasterPaint (NSIS 3).
; Produit par rust/build-all.sh windows :
;   makensis -DVERSION=x.y.z -DEXE=<exe portable> -DICON=<icon.ico> -DOUT=<setup.exe> masterpaint.nsi
; Installation par utilisateur (sans droits administrateur) dans %LOCALAPPDATA%\Programs\MasterPaint,
; raccourcis menu Démarrer / bureau, fichiers .illu associés, désinstallation dans « Applications ».

Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!include "MUI2.nsh"

!ifndef VERSION
  !define VERSION "0.0.0"
!endif
!define APP "MasterPaint"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\fr.masterpaint.app"

Name "${APP} ${VERSION}"
OutFile "${OUT}"
InstallDir "$LOCALAPPDATA\Programs\${APP}"
InstallDirRegKey HKCU "Software\${APP}" "InstallDir"
BrandingText "${APP} ${VERSION} — polocrafting"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\MasterPaint.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer MasterPaint"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

Section "MasterPaint" SecMain
  SectionIn RO
  ; une version ouverte garderait l'exe verrouillé
  nsExec::Exec 'taskkill /IM MasterPaint.exe /F'
  SetOutPath "$INSTDIR"
  File "/oname=MasterPaint.exe" "${EXE}"
  File "/oname=MasterPaint.ico" "${ICON}"
  WriteUninstaller "$INSTDIR\Desinstaller.exe"
  WriteRegStr HKCU "Software\${APP}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "polocrafting"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "https://masterpaint.fr/"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\MasterPaint.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Desinstaller.exe"'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  CreateShortcut "$SMPROGRAMS\${APP}.lnk" "$INSTDIR\MasterPaint.exe" "" "$INSTDIR\MasterPaint.ico"
SectionEnd

Section "Raccourci sur le bureau" SecDesktop
  CreateShortcut "$DESKTOP\${APP}.lnk" "$INSTDIR\MasterPaint.exe" "" "$INSTDIR\MasterPaint.ico"
SectionEnd

Section "Ouvrir les fichiers .illu avec MasterPaint" SecAssoc
  WriteRegStr HKCU "Software\Classes\.illu" "" "MasterPaint.illu"
  WriteRegStr HKCU "Software\Classes\MasterPaint.illu" "" "Projet MasterPaint"
  WriteRegStr HKCU "Software\Classes\MasterPaint.illu\DefaultIcon" "" "$INSTDIR\MasterPaint.ico"
  WriteRegStr HKCU "Software\Classes\MasterPaint.illu\shell\open\command" "" '"$INSTDIR\MasterPaint.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\MasterPaint.exe\shell\open\command" "" '"$INSTDIR\MasterPaint.exe" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM MasterPaint.exe /F'
  Delete "$INSTDIR\MasterPaint.exe"
  Delete "$INSTDIR\MasterPaint.ico"
  Delete "$INSTDIR\Desinstaller.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${APP}.lnk"
  Delete "$DESKTOP\${APP}.lnk"
  ReadRegStr $0 HKCU "Software\Classes\.illu" ""
  StrCmp $0 "MasterPaint.illu" 0 +2
    DeleteRegKey HKCU "Software\Classes\.illu"
  DeleteRegKey HKCU "Software\Classes\MasterPaint.illu"
  DeleteRegKey HKCU "Software\Classes\Applications\MasterPaint.exe"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APP}"
SectionEnd
