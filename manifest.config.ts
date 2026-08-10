import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "Warpkey",
  description: "Press a key, warp to the thing you always click.",
  version: "0.1.0",
  icons: {
    16: "public/icons/icon16.png",
    32: "public/icons/icon32.png",
    48: "public/icons/icon48.png",
    128: "public/icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  // activeTab (not the broader "tabs" permission) grants tab.url access only for
  // the tab the user invokes the popup on - exactly what's needed to read its hostname.
  permissions: ["storage", "activeTab"],
});
