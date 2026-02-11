const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

class API extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      messagesMcp: {
        async getMessage(messageId, folderPath) {
          // Delegated to server/api.js which has direct access to MsgHdrToMimeMessage
          // This schema exists for manifest registration; actual impl is in server module
          throw new Error("getMessage should be called via the server module");
        },
        async searchMessages(query, startDate, endDate, maxResults, sortOrder) {
          throw new Error("searchMessages should be called via the server module");
        },
      },
    };
  }
}

export default API;
