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
Components.utils.import("chrome://sortbynametweak/content/sbntPlacesUtils.js");
Components.utils.import("chrome://sortbynametweak/content/sbntUtils.js");

XPCOMUtils.defineLazyModuleGetter(this, "console", "resource://gre/modules/devtools/Console.jsm");

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
        this.popupshowing(evt);
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

  popupshowing: function(evt) {
    const sortByName = document.getElementById("placesContext_sortBy:name");
    const sortByLocales = document.getElementById("sortbynametweak_sortByLocales");
    const sortBySQL = document.getElementById("sortbynametweak_sortBySQL");
    if (sortByName && sortByLocales && sortBySQL) {
      switch (this.settings.showPlacesCM) {
        case 1: // show sort by name and sort by locales
          sortBySQL.setAttribute("hidden", "true");
          break;
        case 2: // show sort by name and sort by sql
          sortByLocales.setAttribute("hidden", "true");
          break;
        case 3: // show sort by locales
        case 5: // replace sort by name with sort by locales
          sortByName.setAttribute("hidden", "true");
          sortBySQL.setAttribute("hidden", "true");
          break;
        case 4: // show sort by sql
        case 6: // replace sort by name with sort by sql
          sortByName.setAttribute("hidden", "true");
          sortByLocales.setAttribute("hidden", "true");
          break;
        default:
          break;
      }
    }
    if (this.isCmdEnabled) {
      this.setMenuEnabled("sortbynametweak_sortByLocales", true);
      this.setMenuEnabled("sortbynametweak_sortBySQL", true);
      goSetCommandEnabled("sortbynametweakCmd_sortByLocales", true);
      goSetCommandEnabled("sortbynametweakCmd_sortBySQL", true);
    }
    else {
      this.setMenuEnabled("sortbynametweak_sortByLocales", false);
      this.setMenuEnabled("sortbynametweak_sortBySQL", false);
      goSetCommandEnabled("sortbynametweakCmd_sortByLocales", false);
      goSetCommandEnabled("sortbynametweakCmd_sortBySQL", false);
    }
  },

  setMenuEnabled: function(id, status) {
    if (status) {
      document.getElementById(id).removeAttribute("disabled");
    }
    else {
      document.getElementById(id).setAttribute("disabled", "true");
    }
  },

  get isCmdEnabled () {
    if (Services.vc.compare(Services.appinfo.platformVersion, "35.*") > 0) {
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1068671
      // they replaced PlacesUtils.nodeIsReadOnly with PlacesUIUtils.isContentsReadOnly
      // and claimed that "DO NOT USE THIS API IN ADDONS."
      // see http://hg.mozilla.org/mozilla-central/file/112e932d34a5/browser/components/places/PlacesUIUtils.jsm#l627
      // so let's check if placesCmd_sortBy:name is enabled as a workaround
      const placesCmd_sortBy_name = document.getElementById("placesCmd_sortBy:name");
      if (placesCmd_sortBy_name) {
        return !(placesCmd_sortBy_name.hasAttribute("disabled") && placesCmd_sortBy_name.getAttribute("disabled") == "true");
      }
      else {
        return false; // or should it return true? I'm not sure
      }
    }
    else {
      // firefox 29~35
      // chrome://browser/content/places/controller.js
      if (PlacesUIUtils.useAsyncTransactions) {
        return false;
      }
      const view = this.view;
      if (!view) {
        return false;
      }
      const selectedNode = view.selectedNode;
      return selectedNode &&
             PlacesUtils.nodeIsFolder(selectedNode) &&
             !PlacesUtils.nodeIsReadOnly(selectedNode) &&
             view.result.sortingMode == Ci.nsINavHistoryQueryOptions.SORT_BY_NONE;
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
    const txn = new SBNTSortFolderByNameTransaction(itemId, SBNTPlacesUtils.SORT_BY_LOCALES, locales, options);
    PlacesUtils.transactionManager.doTransaction(txn);
  },

  sortBySQL: function() {
    const itemId = this.itemId;
    if (itemId === null) {
      return;
    }
    const txn = new SBNTSortFolderByNameTransaction(itemId, SBNTPlacesUtils.SORT_BY_SQL);
    PlacesUtils.transactionManager.doTransaction(txn);
  },
};

window.addEventListener("load", sortbynametweak, false);
