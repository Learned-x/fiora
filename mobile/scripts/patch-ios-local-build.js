#!/usr/bin/env node
// Patch post-prebuild al progetto iOS generato, per poter buildare in
// locale (Xcode + cavo, Apple ID free) invece che solo via EAS.
// `ios/` è rigenerata ad ogni `expo prebuild` (gitignored), quindi queste
// patch vanno riapplicate ogni volta — non modificare i file sotto ios/
// direttamente, aggiornare questo script.
//
// 1) Rimuove la capability Push Notifications (entitlements + Info.plist).
//    Il provisioning profile di un Apple ID free (personal team) non la
//    supporta ("Personal development teams ... do not support the Push
//    Notifications capability"), ma expo-notifications la aggiunge sempre
//    in automatico durante il prebuild. Non fattibile come config plugin:
//    il base-mod entitlements di @expo/config-plugins ri-legge
//    `config.ios.entitlements` ad ogni step e lo fa vincere sul risultato
//    di eventuali mod custom (verificato: un delete dentro un plugin
//    veniva sistematicamente sovrascritto) — più affidabile patchare i
//    file XML già scritti su disco a fine prebuild.
//
// 2) Fix bug preesistente (vedi CLAUDE.md "Note build iOS locale"): la
//    fase "Bundle React Native code and images" in project.pbxproj ha un
//    backtick di command substitution non quotato attorno alla risoluzione
//    di react-native-xcode.sh — se il path del progetto contiene spazi
//    (qui: "Fiora TG"), il risultato del backtick viene word-splittato
//    dalla shell e lo script fallisce con "No such file or directory".
//    Stesso bug pattern già patchato per expo-constants via patch-package
//    (mobile/patches/expo-constants+18.0.13.patch), ma quello è dentro
//    node_modules (patchabile con patch-package); questo è dentro il
//    progetto Xcode generato, quindi va ripetuto qui ad ogni prebuild.
//
// Non tocca le build EAS/staging (mai lanciato in quel flusso, solo da
// `npm run ios:local`).

const fs = require('fs');
const path = require('path');

const iosDir = path.join(__dirname, '..', 'ios');
const projectName = 'mobile';

function stripPushCapability() {
  const entitlementsPath = path.join(iosDir, projectName, `${projectName}.entitlements`);
  const infoPlistPath = path.join(iosDir, projectName, 'Info.plist');

  if (fs.existsSync(entitlementsPath)) {
    let contents = fs.readFileSync(entitlementsPath, 'utf8');
    const before = contents;
    contents = contents.replace(/\s*<key>aps-environment<\/key>\s*<string>[^<]*<\/string>/, '');
    if (contents !== before) {
      fs.writeFileSync(entitlementsPath, contents);
      console.log(`[patch-ios-local-build] rimosso aps-environment da ${entitlementsPath}`);
    }
  } else {
    console.warn(`[patch-ios-local-build] non trovato: ${entitlementsPath}`);
  }

  if (fs.existsSync(infoPlistPath)) {
    let contents = fs.readFileSync(infoPlistPath, 'utf8');
    const before = contents;
    contents = contents.replace(/\s*<string>remote-notification<\/string>/, '');
    if (contents !== before) {
      fs.writeFileSync(infoPlistPath, contents);
      console.log(`[patch-ios-local-build] rimosso remote-notification da ${infoPlistPath}`);
    }
  } else {
    console.warn(`[patch-ios-local-build] non trovato: ${infoPlistPath}`);
  }
}

function fixUnquotedBundleScript() {
  const pbxprojPath = path.join(iosDir, `${projectName}.xcodeproj`, 'project.pbxproj');
  if (!fs.existsSync(pbxprojPath)) {
    console.warn(`[patch-ios-local-build] non trovato: ${pbxprojPath}`);
    return;
  }
  let contents = fs.readFileSync(pbxprojPath, 'utf8');
  const before = contents;
  const unquoted =
    "`\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\"`";
  const quoted =
    "\\\"$(\\\"$NODE_BINARY\\\" --print \\\"require('path').dirname(require.resolve('react-native/package.json')) + '/scripts/react-native-xcode.sh'\\\")\\\"";
  contents = contents.split(unquoted).join(quoted);
  if (contents !== before) {
    fs.writeFileSync(pbxprojPath, contents);
    console.log('[patch-ios-local-build] quotato backtick in "Bundle React Native code and images"');
  } else {
    console.warn(
      '[patch-ios-local-build] pattern backtick non trovato in project.pbxproj (formato cambiato? verificare a mano)'
    );
  }
}

stripPushCapability();
fixUnquotedBundleScript();
