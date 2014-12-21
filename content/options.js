/*  Sort By Name Tweak
 *  Copyright (c) 2014 uFFFD
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

Components.utils.import("chrome://sortbynametweak/content/sbntUtils.js");
XPCOMUtils.defineLazyModuleGetter(this, "console", "resource://gre/modules/devtools/Console.jsm");

const $ = (id) => document.getElementById(id);

const sort = (str, separator, locales, options) => {
  if (str === "") {
    return "";
  }
  const list = str.split(separator);
  const result = list.sort(function(a, b) {
    return a.localeCompare(b, locales, options);
  });
  return result.join(separator);
};

const sbntOptions = {
  init: function() {
    this._useFirefoxLocale = $("sbnt_pref_useFirefoxLocale").value;
    this.checkLocales();
    this._options = {};
    this._options["localeMatcher"] = $("sbnt_pref_lco_localeMatcher").value;
    this._options["usage"] = $("sbnt_pref_lco_usage").value;
    this._options["sensitivity"] = $("sbnt_pref_lco_sensitivity").value;
    this._options["ignorePunctuation"] = $("sbnt_pref_lco_ignorePunctuation").value;
    this._options["numeric"] = $("sbnt_pref_lco_numeric").value;
    this._options["caseFirst"] = $("sbnt_pref_lco_caseFirst").value;
    this._testStrings = $("sbnt_pref_testStrings").value;
    this.testLocales();
  },

  unload: function() {
  },

  checkLocales: function() {
    let locales;
    if (this._useFirefoxLocale) {
      locales = $("general_useragent_locale").value;
    }
    else {
      locales = $("sbnt_pref_customLocales").value;
      if (locales.indexOf(",") >= 0) {
        locales = locales.split(/\s*,\s*/);
      }
    }
    if (locales === "") {
      locales = undefined;
    }
    this._locales = locales;
    this._localesSupported = LocalesSupported(this._locales);
    if (this._useFirefoxLocale) {
      $("firefoxLocaleNotSupported").setAttribute("hidden", this._localesSupported);
      $("customLocalesNotSupported").setAttribute("hidden", true);
      $("sbnt_firefoxLocale").disabled = false;
      $("sbnt_customLocales").disabled = true;
    }
    else {
      $("firefoxLocaleNotSupported").setAttribute("hidden", true);
      $("customLocalesNotSupported").setAttribute("hidden", this._localesSupported);
      $("sbnt_firefoxLocale").disabled = true;
      $("sbnt_customLocales").disabled = false;
    }
  },

  testLocales: function() {
    if (this._localesSupported) {
      $("sbnt_testStringsResult").value = sort(this._testStrings, "\n", this._locales, this._options);
    }
    else {
      $("sbnt_testStringsResult").value = "";
    }
  },

  reset: function() {
    const prefs_ids = [
      "sbnt_pref_lco_localeMatcher",
      "sbnt_pref_lco_usage",
      "sbnt_pref_lco_sensitivity",
      "sbnt_pref_lco_ignorePunctuation",
      "sbnt_pref_lco_numeric",
      "sbnt_pref_lco_caseFirst",
      "sbnt_pref_testStrings"
    ];
    prefs_ids.forEach(function(id) {
      const e = $(id);
      e.value = e.defaultValue;
    });
    this.testLocales();
  },

  onchange: function(evt) {
    const id = evt.target.id;
    switch (id) {
      case "sbnt_pref_useFirefoxLocale":
        this._useFirefoxLocale = $(id).value;
      case "general_useragent_locale":
      case "sbnt_pref_customLocales":
        this.checkLocales();
        break;
      case "sbnt_pref_lco_localeMatcher":
        this._options["localeMatcher"] = $(id).value;
        break;
      case "sbnt_pref_lco_usage":
        this._options["usage"] = $(id).value;
        break;
      case "sbnt_pref_lco_sensitivity":
        this._options["sensitivity"] = $(id).value;
        break;
      case "sbnt_pref_lco_ignorePunctuation":
        this._options["ignorePunctuation"] = $(id).value;
        break;
      case "sbnt_pref_lco_numeric":
        this._options["numeric"] = $(id).value;
        break;
      case "sbnt_pref_lco_caseFirst":
        this._options["caseFirst"] = $(id).value;
        break;
      case "sbnt_pref_testStrings":
        this._testStrings = $(id).value;
        break;
      default:
        break;
    }
    this.testLocales();
  },
};
