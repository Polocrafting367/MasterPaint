; MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
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

; type de fichier ${EXT} : ProgID MasterPaint.${EXT}, MasterPaint dans « Ouvrir avec » et dans
; Paramètres › Applications par défaut ; ${DEF} = 1 : application par défaut si aucune autre ne l'est
!macro Assoc EXT DESC DEF
  WriteRegStr HKCU "Software\Classes\MasterPaint.${EXT}" "" "${DESC}"
  WriteRegStr HKCU "Software\Classes\MasterPaint.${EXT}\DefaultIcon" "" "$INSTDIR\MasterPaint.ico"
  WriteRegStr HKCU "Software\Classes\MasterPaint.${EXT}\shell\open\command" "" '"$INSTDIR\MasterPaint.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\.${EXT}\OpenWithProgids" "MasterPaint.${EXT}" ""
  WriteRegStr HKCU "Software\Classes\Applications\MasterPaint.exe\SupportedTypes" ".${EXT}" ""
  WriteRegStr HKCU "Software\${APP}\Capabilities\FileAssociations" ".${EXT}" "MasterPaint.${EXT}"
  !if ${DEF} == 1
    ReadRegStr $0 HKCR ".${EXT}" ""
    StrCmp $0 "" 0 +2
      WriteRegStr HKCU "Software\Classes\.${EXT}" "" "MasterPaint.${EXT}"
  !endif
!macroend

!macro Unassoc EXT
  ReadRegStr $0 HKCU "Software\Classes\.${EXT}" ""
  StrCmp $0 "MasterPaint.${EXT}" 0 +2
    DeleteRegValue HKCU "Software\Classes\.${EXT}" ""
  DeleteRegValue HKCU "Software\Classes\.${EXT}\OpenWithProgids" "MasterPaint.${EXT}"
  DeleteRegKey HKCU "Software\Classes\MasterPaint.${EXT}"
!macroend

Section "Ouvrir les projets et images avec MasterPaint (double-clic, Ouvrir avec)" SecAssoc
  ; projets MasterPaint et Paint.NET : MasterPaint par défaut (si aucune autre application)
  !insertmacro Assoc "illu" "Projet MasterPaint" 1
  !insertmacro Assoc "pdn" "Image Paint.NET" 1
  ; Photoshop, images, photos RAW : proposé dans « Ouvrir avec » sans prendre la place de
  ; l'application déjà choisie
  !insertmacro Assoc "psd" "Image Photoshop" 0
  !insertmacro Assoc "psb" "Image Photoshop (grand format)" 0
  !insertmacro Assoc "png" "Image PNG" 0
  !insertmacro Assoc "jpg" "Image JPEG" 0
  !insertmacro Assoc "jpeg" "Image JPEG" 0
  !insertmacro Assoc "webp" "Image WebP" 0
  !insertmacro Assoc "bmp" "Image BMP" 0
  !insertmacro Assoc "gif" "Image GIF" 0
  !insertmacro Assoc "tif" "Image TIFF" 0
  !insertmacro Assoc "tiff" "Image TIFF" 0
  !insertmacro Assoc "tga" "Image TGA" 0
  !insertmacro Assoc "svg" "Dessin SVG" 0
  !insertmacro Assoc "dng" "Photo RAW" 0
  !insertmacro Assoc "cr2" "Photo RAW Canon" 0
  !insertmacro Assoc "cr3" "Photo RAW Canon" 0
  !insertmacro Assoc "nef" "Photo RAW Nikon" 0
  !insertmacro Assoc "arw" "Photo RAW Sony" 0
  !insertmacro Assoc "raf" "Photo RAW Fujifilm" 0
  !insertmacro Assoc "orf" "Photo RAW Olympus" 0
  !insertmacro Assoc "rw2" "Photo RAW Panasonic" 0
  WriteRegStr HKCU "Software\Classes\Applications\MasterPaint.exe\shell\open\command" "" '"$INSTDIR\MasterPaint.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\MasterPaint.exe" "FriendlyAppName" "MasterPaint"
  WriteRegStr HKCU "Software\${APP}\Capabilities" "ApplicationName" "MasterPaint"
  WriteRegStr HKCU "Software\${APP}\Capabilities" "ApplicationDescription" "Éditeur d'images, retouche photo et dessin"
  WriteRegStr HKCU "Software\RegisteredApplications" "${APP}" "Software\${APP}\Capabilities"
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
  !insertmacro Unassoc "illu"
  !insertmacro Unassoc "pdn"
  !insertmacro Unassoc "psd"
  !insertmacro Unassoc "psb"
  !insertmacro Unassoc "png"
  !insertmacro Unassoc "jpg"
  !insertmacro Unassoc "jpeg"
  !insertmacro Unassoc "webp"
  !insertmacro Unassoc "bmp"
  !insertmacro Unassoc "gif"
  !insertmacro Unassoc "tif"
  !insertmacro Unassoc "tiff"
  !insertmacro Unassoc "tga"
  !insertmacro Unassoc "svg"
  !insertmacro Unassoc "dng"
  !insertmacro Unassoc "cr2"
  !insertmacro Unassoc "cr3"
  !insertmacro Unassoc "nef"
  !insertmacro Unassoc "arw"
  !insertmacro Unassoc "raf"
  !insertmacro Unassoc "orf"
  !insertmacro Unassoc "rw2"
  DeleteRegKey HKCU "Software\Classes\Applications\MasterPaint.exe"
  DeleteRegValue HKCU "Software\RegisteredApplications" "${APP}"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APP}"
SectionEnd
