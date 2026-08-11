const { withXcodeProject } = require('@expo/config-plugins');

// `expo prebuild` rigenera ios/ da zero: la fase "Bundle React Native code and
// images" invoca react-native-xcode.sh via backtick non quotato, che word-splitta
// il path se contiene spazi (vedi CLAUDE.md, "Note build iOS locale"). Patch qui
// invece che a mano nel .pbxproj perché quel file è gitignored/rigenerato.
const BROKEN_PATTERN = /`("\$NODE_BINARY"[^`]*react-native-xcode\.sh[^`]*)`/;

function withFixXcodeBundlePhase(config) {
  return withXcodeProject(config, (config) => {
    const phases = config.modResults.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    for (const phase of Object.values(phases)) {
      if (!phase || typeof phase !== 'object' || typeof phase.shellScript !== 'string') continue;
      if (!BROKEN_PATTERN.test(phase.shellScript)) continue;
      phase.shellScript = phase.shellScript.replace(
        BROKEN_PATTERN,
        'export REACT_NATIVE_XCODE_SH="$($1)"\n"$REACT_NATIVE_XCODE_SH"'
      );
    }
    return config;
  });
}

module.exports = withFixXcodeBundlePhase;
