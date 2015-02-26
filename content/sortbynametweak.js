/*  Sort By Name Tweak
 *  Copyright (c) 2014-2015 uFFFD
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "console", "resource://gre/modules/devtools/Console.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "LocalesSupported",
                                  "chrome://sortbynametweak/content/sbntUtils.js");
XPCOMUtils.defineLazyModuleGetter(this, "SBNTPlacesUtils",
                                  "chrome://sortbynametweak/content/sbntPlacesUtils.js");
XPCOMUtils.defineLazyModuleGetter(this, "SBNTSortFolderByNameTransaction",
                                  "chrome://sortbynametweak/content/sbntPlacesUtils.js");
XPCOMUtils.defineLazyModuleGetter(this, "SBNTPlacesTransactions",
                                  "chrome://sortbynametweak/content/sbntPlacesTransactions.js");

let sortbynametweak = {
  get optionList () {
    return ["localeMatcher", "usage", "sensitivity", "ignorePunctuation", "numeric", "caseFirst"];
  },

  handleEvent: function(evt) {
    switch (evt.type) {
      case "load":
        this.init(evt);
        break;
      case "unload":
        this.unload(evt);
        break;
      case "popupshowing":
        this.onpopupshowing(evt);
        break;
    }
  },

  observe: function(subject, topic, data) {
    if (topic == "nsPref:changed") {
      switch (data) {
        case "extensions.sortbynametweak@uFFFD.showPlacesContextMenu":
          this.settings.showPlacesCM = this.getPref(data);
          this.updatePlacesContextMenu();
          break;
        case "general.useragent.locale":
          this.settings.firefoxLocale = this.getFirefoxLocale();
          break;
        case "extensions.sortbynametweak@uFFFD.useFirefoxLocale":
          this.settings.useFirefoxLocale = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.customLocales":
          this.settings.customLocales = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_localeMatcher":
          this.settings.included_options.localeMatcher = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_usage":
          this.settings.included_options.usage = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_sensitivity":
          this.settings.included_options.sensitivity = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_ignorePunctuation":
          this.settings.included_options.ignorePunctuation = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_numeric":
          this.settings.included_options.numeric = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_caseFirst":
          this.settings.included_options.caseFirst = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_localeMatcher":
          this.settings.options.localeMatcher = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_usage":
          this.settings.options.usage = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_sensitivity":
          this.settings.options.sensitivity = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_ignorePunctuation":
          this.settings.options.ignorePunctuation = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_numeric":
          this.settings.options.numeric = this.getPref(data);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_caseFirst":
          this.settings.options.caseFirst = this.getPref(data);
          break;
        default:
          break;
      }
    }
  },

  getBoolPref: function(prefName, defValue) {
    let value = null;
    try {
      value = Services.prefs.getBoolPref(prefName);
    }
    finally {
      return value == null ? defValue : value;
    }
  },

  getIntPref: function(prefName, defValue) {
    let value = null;
    try {
      value = Services.prefs.getIntPref(prefName);
    }
    finally {
      return value == null ? defValue : value;
    }
  },

  getUCharPref: function(prefName, defValue) {
    let value = null;
    try {
      value = Services.prefs.getComplexValue(prefName, Ci.nsISupportsString).data;
    }
    finally {
      return value || defValue;
    }
  },

  getLocalizedPref: function(prefName, defValue) {
    let value = null;
    try {
      value = Services.prefs.getComplexValue(prefName, Ci.nsIPrefLocalizedString).data;
    }
    finally {
      return value || defValue;
    }
  },

  getPref: function(prefName) {
    switch (prefName) {
      case "extensions.sortbynametweak@uFFFD.showPlacesContextMenu":
        return this.getIntPref(prefName, 0);
      case "extensions.sortbynametweak@uFFFD.useFirefoxLocale":
        return this.getBoolPref(prefName, true);
      case "extensions.sortbynametweak@uFFFD.customLocales":
        return this.getUCharPref(prefName, "");
      case "extensions.sortbynametweak@uFFFD.localeCompareOptions_localeMatcher":
        return this.getUCharPref(prefName, "best fit");
      case "extensions.sortbynametweak@uFFFD.localeCompareOptions_usage":
        return this.getUCharPref(prefName, "sort");
      case "extensions.sortbynametweak@uFFFD.localeCompareOptions_sensitivity":
        return this.getUCharPref(prefName, "variant");
      case "extensions.sortbynametweak@uFFFD.localeCompareOptions_ignorePunctuation":
        return this.getBoolPref(prefName, false);
      case "extensions.sortbynametweak@uFFFD.localeCompareOptions_numeric":
        return this.getBoolPref(prefName, false);
      case "extensions.sortbynametweak@uFFFD.localeCompareOptions_caseFirst":
        return this.getUCharPref(prefName, "false");
      case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_localeMatcher":
      case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_usage":
      case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_sensitivity":
      case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_ignorePunctuation":
      case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_numeric":
      case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_caseFirst":
        return this.getBoolPref(prefName, true);
      default:
        return undefined;
    }
  },

  getFirefoxLocale: function() {
    let locale = this.getUCharPref("general.useragent.locale", "");
    if (locale == "chrome://global/locale/intl.properties") {
      locale = this.getLocalizedPref("general.useragent.locale", "");
    }
    return locale;
  },

  init: function(evt) {
    window.removeEventListener("load", this, false);
    window.addEventListener("unload", this, false);
    XPCOMUtils.defineLazyGetter(this, "strings", function() {
      return Services.strings.createBundle("chrome://sortbynametweak/locale/sortbynametweak.properties");
    });
    this.settings = {
      showPlacesCM: this.getPref("extensions.sortbynametweak@uFFFD.showPlacesContextMenu"),
      firefoxLocale: this.getFirefoxLocale(),
      useFirefoxLocale: this.getPref("extensions.sortbynametweak@uFFFD.useFirefoxLocale"),
      customLocales: this.getPref("extensions.sortbynametweak@uFFFD.customLocales"),
      included_options: {},
      options: {}
    };
    this.optionList.forEach(e => {
      this.settings.included_options[e] = this.getPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_" + e);
      this.settings.options[e] = this.getPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_" + e);
    });
    this.updatePlacesContextMenu();
    Services.prefs.addObserver("extensions.sortbynametweak@uFFFD.", this, false);
    Services.prefs.addObserver("general.useragent.locale", this, false);
    let placesCM = document.getElementById("placesContext");
    if (placesCM) {
      placesCM.addEventListener("popupshowing", this, false);
    }
  },

  unload: function(evt) {
    window.removeEventListener("unload", this, false);
    Services.prefs.removeObserver("extensions.sortbynametweak@uFFFD.", this);
    Services.prefs.removeObserver("general.useragent.locale", this);
    let placesCM = document.getElementById("placesContext");
    if (placesCM) {
      placesCM.removeEventListener("popupshowing", this, false);
    }
  },

  updatePlacesContextMenu: function() {
    const sortByName = document.getElementById("placesContext_sortBy:name");
    const sortByLocales = document.getElementById("sortbynametweak_sortByLocales");
    const sortBySQL = document.getElementById("sortbynametweak_sortBySQL");
    if (sortByName && sortByLocales && sortBySQL) {
      sortByLocales.setAttribute("label", sortByLocales.getAttribute("value"));
      sortByLocales.removeAttribute("accesskey");
      sortBySQL.setAttribute("label", sortBySQL.getAttribute("value"));
      sortBySQL.removeAttribute("accesskey");
      switch (this.settings.showPlacesCM) {
        case 5: // replace sort by name with sort by locales
          sortByLocales.setAttribute("label", sortByName.getAttribute("label"));
          sortByLocales.setAttribute("accesskey", sortByName.getAttribute("accesskey"));
          break;
        case 6: // replace sort by name with sort by sql
          sortBySQL.setAttribute("label", sortByName.getAttribute("label"));
          sortBySQL.setAttribute("accesskey", sortByName.getAttribute("accesskey"));
          break;
        default:
          break;
      }
    }
  },

  onpopupshowing: function(evt) {
    const sortByName = document.getElementById("placesContext_sortBy:name");
    const sortByLocales = document.getElementById("sortbynametweak_sortByLocales");
    const sortBySQL = document.getElementById("sortbynametweak_sortBySQL");
    switch (this.settings.showPlacesCM) {
      case 1: // show sort by name and sort by locales
        if (sortBySQL) {
          sortBySQL.setAttribute("hidden", "true");
        }
        break;
      case 2: // show sort by name and sort by sql
        if (sortByLocales) {
          sortByLocales.setAttribute("hidden", "true");
        }
        break;
      case 3: // show sort by locales
      case 5: // replace sort by name with sort by locales
        if (sortByName) {
          sortByName.setAttribute("hidden", "true");
        }
        if (sortBySQL) {
          sortBySQL.setAttribute("hidden", "true");
        }
        break;
      case 4: // show sort by sql
      case 6: // replace sort by name with sort by sql
        if (sortBySQL) {
          sortByName.setAttribute("hidden", "true");
        }
        if (sortByLocales) {
          sortByLocales.setAttribute("hidden", "true");
        }
        break;
      default:
        break;
    }
    this.setMenuEnabled(this.isCmdEnabled);
  },

  setMenuEnabled: function(enabled) {
    [
      "sortbynametweak_sortByLocales",
      "sortbynametweak_sortBySQL",
      "sortbynametweakCmd_sortByLocales",
      "sortbynametweakCmd_sortBySQL"
    ].forEach(e => this.setNodeEnabled(e, enabled));
  },

  setNodeEnabled: function(id, enabled) {
    let node = document.getElementById(id);
    if (node) {
      if (enabled) {
        node.removeAttribute("disabled");
      }
      else {
        node.setAttribute("disabled", "true");
      }
    }
  },

  get isCmdEnabled () {
    const placesCmd_sortBy_name = document.getElementById("placesCmd_sortBy:name");
    if (placesCmd_sortBy_name) {
      return !(placesCmd_sortBy_name.hasAttribute("disabled") && placesCmd_sortBy_name.getAttribute("disabled") == "true");
    }
    else {
      return false;
    }
  },

  get view () {
    let popupNode;
    try {
      popupNode = document.popupNode;
    }
    catch (e) {
      return null;
    }
    if (popupNode) {
      const view = PlacesUIUtils.getViewForNode(popupNode);
      if (view && view._contextMenuShown) {
        return view;
      }
    }
    return null;
  },

  get itemId () {
    const view = this.view;
    if (view) {
      const selectedNode = view.selectedNode;
      return PlacesUtils.getConcreteItemId(selectedNode);
    }
    return null;
  },

  get usePromise () {
    // Bug 983623 - Async transactions: Add a preference for turning it, implement undo & redo commands
    // https://bugzilla.mozilla.org/show_bug.cgi?id=983623
    // Bug 984900 - Places async transactions: Implement "sort by name" ui command
    // https://bugzilla.mozilla.org/show_bug.cgi?id=984900
    //
    // Only enable async transactions in firefox 34+
    // because current async implement requires some new features added in firefox 34+
    // e.g. ES6 Method Definitions, ES6 computed property names, ES6 template strings, etc...
    // I'm too lazy too backport these to older versions
    return Services.vc.compare(Services.appinfo.platformVersion, "33.*") > 0;
  },

  get promiseItemGuid () {
    // workaround for firefox 34
    // Bug 1069235 - make guid and parentGuid naming consistent
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1069235
    if (Services.vc.compare(Services.appinfo.platformVersion, "34.*") > 0)
      return PlacesUtils.promiseItemGuid;
    else
      return PlacesUtils.promiseItemGUID;
  },

  sortByLocales: function() {
    const itemId = this.itemId;
    if (itemId === null) {
      return;
    }
    let locales;
    if (this.settings.useFirefoxLocale) {
      locales = this.settings.firefoxLocale;
    }
    else {
      locales = this.settings.customLocales;
      if (locales.indexOf(",") >= 0) {
        locales = locales.split(/\s*,\s*/);
      }
    }
    if (locales === "") {
      locales = undefined;
    }
    if (!LocalesSupported(locales)) {
      alert(this.strings.formatStringFromName("message.invalidLanguageTag", [ locales !== "" ? locales : "Empty string" ], 1));
      return;
    }
    let options = {};
    this.optionList.forEach(e => {
      if (this.settings.included_options[e]) {
        options[e] = this.settings.options[e];
      }
    });
    if (this.usePromise) {
      this.sortByLocalesPromised(itemId, locales, options)
    }
    else {
      this.sortByLocalesLegacy(itemId, locales, options);
    }
  },

  sortByLocalesLegacy: function(itemId, locales, options) {
    const txn = new SBNTSortFolderByNameTransaction(itemId, SBNTPlacesUtils.SORT_BY_LOCALES, locales, options);
    PlacesUtils.transactionManager.doTransaction(txn);
  },

  sortByLocalesPromised: function(itemId, locales, options) {
    const that = this;
    let task = Task.async(function* () {
      if (!PlacesUIUtils.useAsyncTransactions) {
        that.sortByLocalesLegacy(itemId, locales, options);
        return;
      }
      let guid = yield that.promiseItemGuid(itemId);
      yield SBNTPlacesTransactions.SortByLocales({ guid: guid, localeCompareLocales: locales, localeCompareOptions: options }).transact();
    });
    task().then(null, Components.utils.reportError);
  },

  sortBySQL: function() {
    const itemId = this.itemId;
    if (itemId === null) {
      return;
    }
    if (this.usePromise) {
      this.sortBySQLPromised(itemId)
    }
    else {
      this.sortBySQLLegacy(itemId);
    }
  },

  sortBySQLLegacy: function(itemId) {
    const txn = new SBNTSortFolderByNameTransaction(itemId, SBNTPlacesUtils.SORT_BY_SQL);
    PlacesUtils.transactionManager.doTransaction(txn);
  },

  sortBySQLPromised: function(itemId) {
    const that = this;
    let task = Task.async(function* () {
      if (!PlacesUIUtils.useAsyncTransactions) {
        that.sortBySQLLegacy(itemId);
        return;
      }
      let guid = yield that.promiseItemGuid(itemId);
      yield SBNTPlacesTransactions.SortBySQL(guid).transact();
    });
    task().then(null, Components.utils.reportError);
  },

  sortByURL: function() {
    const itemId = this.itemId;
    if (itemId === null) {
      return;
    }
    let locales;
    if (this.settings.useFirefoxLocale) {
      locales = this.settings.firefoxLocale;
    }
    else {
      locales = this.settings.customLocales;
      if (locales.indexOf(",") >= 0) {
        locales = locales.split(/\s*,\s*/);
      }
    }
    if (locales === "") {
      locales = undefined;
    }
    if (!LocalesSupported(locales)) {
      alert(this.strings.formatStringFromName("message.invalidLanguageTag", [ locales !== "" ? locales : "Empty string" ], 1));
      return;
    }
    let options = {};
    this.optionList.forEach(e => {
      if (this.settings.included_options[e]) {
        options[e] = this.settings.options[e];
      }
    });
    if (this.usePromise) {
      this.sortByURLPromised(itemId, locales, options)
    }
    else {
      this.sortByURLLegacy(itemId, locales, options);
    }
  },

  sortByURLLegacy: function(itemId, locales, options) {
    const txn = new SBNTSortFolderByNameTransaction(itemId, SBNTPlacesUtils.SORT_BY_URL, locales, options);
    PlacesUtils.transactionManager.doTransaction(txn);
  },

  sortByURLPromised: function(itemId, locales, options) {
    const that = this;
    let task = Task.async(function* () {
      if (!PlacesUIUtils.useAsyncTransactions) {
        that.sortByURLLegacy(itemId, locales, options);
        return;
      }
      let guid = yield that.promiseItemGuid(itemId);
      yield SBNTPlacesTransactions.SortByURL({ guid: guid, localeCompareLocales: locales, localeCompareOptions: options }).transact();
    });
    task().then(null, Components.utils.reportError);
  },
};

window.addEventListener("load", sortbynametweak, false);
