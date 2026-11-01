// The demo folder holds two kinds of MP4:
//  - bundled clips named by KB id (<kb-id>.mp4, <kb-id>__2.mp4) — required at build time;
//  - published clips named by exercise display name, e.g.
//    "Dumbbell Bench Press - Dumbbell-2.mp4". Those are discovered from GitHub at
//    runtime by src/kb/VideoCatalogProvider.tsx and must NOT be bundled.
// Block only the non-KB-id MP4s; leave the bundled slugs in the asset graph.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.blockList = [
  /assets[\\/]exercises[\\/]demos[\\/](?![a-z0-9]+(?:-[a-z0-9]+)*(?:__[2-9]\d*)?\.mp4$).*\.mp4$/,
];
module.exports = config;
