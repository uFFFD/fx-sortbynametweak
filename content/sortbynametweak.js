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
        case "general.useragent.locale":
          this.settings.firefoxLocale = this.getFirefoxLocale();
          break;
        case "extensions.sortbynametweak@uFFFD.useFirefoxLocale":
          this.settings.useFirefoxLocale = this.getBoolPref("extensions.sortbynametweak@uFFFD.useFirefoxLocale", true);
          break;
        case "extensions.sortbynametweak@uFFFD.customLocales":
          this.settings.customLocales = this.getUCharPref("extensions.sortbynametweak@uFFFD.customLocales", "");
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_localeMatcher":
          this.settings.included_options.localeMatcher = this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_localeMatcher", true);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_usage":
          this.settings.included_options.usage = this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_usage", true);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_sensitivity":
          this.settings.included_options.sensitivity = this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_sensitivity", true);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_ignorePunctuation":
          this.settings.included_options.ignorePunctuation = this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_ignorePunctuation", true);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_numeric":
          this.settings.included_options.numeric = this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_numeric", true);
          break;
        case "extensions.sortbynametweak@uFFFD.use_localeCompareOptions_caseFirst":
          this.settings.included_options.caseFirst = this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_caseFirst", true);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_localeMatcher":
          this.settings.options.localeMatcher = this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_localeMatcher", "best fit");
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_usage":
          this.settings.options.usage = this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_usage", "sort");
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_sensitivity":
          this.settings.options.sensitivity = this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_sensitivity", "variant");
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_ignorePunctuation":
          this.settings.options.ignorePunctuation = this.getBoolPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_ignorePunctuation", false);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_numeric":
          this.settings.options.numeric = this.getBoolPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_numeric", false);
          break;
        case "extensions.sortbynametweak@uFFFD.localeCompareOptions_caseFirst":
          this.settings.options.caseFirst = this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_caseFirst", "false");
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
      firefoxLocale: this.getFirefoxLocale(),
      useFirefoxLocale: this.getBoolPref("extensions.sortbynametweak@uFFFD.useFirefoxLocale", true),
      customLocales: this.getUCharPref("extensions.sortbynametweak@uFFFD.customLocales", ""),
      included_options: {
        localeMatcher: this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_localeMatcher", true),
        usage: this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_usage", true),
        sensitivity: this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_sensitivity", true),
        ignorePunctuation: this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_ignorePunctuation", true),
        numeric: this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_numeric", true),
        caseFirst: this.getBoolPref("extensions.sortbynametweak@uFFFD.use_localeCompareOptions_caseFirst", true)
      },
      options: {
        localeMatcher: this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_localeMatcher", "best fit"),
        usage: this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_usage", "sort"),
        sensitivity: this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_sensitivity", "variant"),
        ignorePunctuation: this.getBoolPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_ignorePunctuation", false),
        numeric: this.getBoolPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_numeric", false),
        caseFirst: this.getUCharPref("extensions.sortbynametweak@uFFFD.localeCompareOptions_caseFirst", "false")
      }
    };
    Services.prefs.addObserver("extensions.sortbynametweak@uFFFD.", this, false);
    Services.prefs.addObserver("general.useragent.locale", this, false);
    document.getElementById("placesContext").addEventListener("popupshowing", this, false);
  },

  unload: function(evt) {
    window.removeEventListener("unload", this, false);
    Services.prefs.removeObserver("extensions.sortbynametweak@uFFFD.", this);
    Services.prefs.removeObserver("general.useragent.locale", this);
    document.getElementById("placesContext").removeEventListener("popupshowing", this, false);
  },

  popupshowing: function(evt) {
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
    ["localeMatcher", "usage", "sensitivity", "ignorePunctuation", "numeric", "caseFirst"].forEach(e => {
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
