const { ExtensionCommon } = ChromeUtils.import("resource://gre/modules/ExtensionCommon.jsm");
const { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

class API extends ExtensionCommon.ExtensionAPI {
  getAPI(context) {
    return {
      contactsMcp: {
        async search(query) {
          try {
            const results = [];
            const lower = query.toLowerCase();
            const MAX = 50;
            for (const book of MailServices.ab.directories) {
              for (const card of book.childCards) {
                if (card.isMailList) continue;
                const email = (card.primaryEmail || "").toLowerCase();
                const displayName = (card.displayName || "").toLowerCase();
                const firstName = (card.firstName || "").toLowerCase();
                const lastName = (card.lastName || "").toLowerCase();
                if (
                  email.includes(lower) ||
                  displayName.includes(lower) ||
                  firstName.includes(lower) ||
                  lastName.includes(lower)
                ) {
                  results.push({
                    id: card.UID,
                    displayName: card.displayName,
                    email: card.primaryEmail,
                    firstName: card.firstName,
                    lastName: card.lastName,
                    addressBook: book.dirName,
                  });
                }
                if (results.length >= MAX) break;
              }
              if (results.length >= MAX) break;
            }
            return results;
          } catch (e) {
            console.error("contactsMcp.search error", e);
            throw e;
          }
        },
      },
    };
  }
}

export default API;
