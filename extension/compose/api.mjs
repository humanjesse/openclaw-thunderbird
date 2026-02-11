const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");

class API extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      composeMcp: {
        async sendMail(details) {
          // Delegated to server/api.js which handles compose operations directly
          throw new Error("sendMail should be called via the server module");
        },
        async composeMail(details) {
          throw new Error("composeMail should be called via the server module");
        },
      },
    };
  }
}

export default API;
