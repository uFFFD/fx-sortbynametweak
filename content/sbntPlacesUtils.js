/*  This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 *  Copyright (c) 2014-2015 uFFFD
 *
 *  Alternatively, the contents of this file may be used under the terms
 *  of the GNU General Public License Version 3+, as described below:
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

// original source from:
// http://mxr.mozilla.org/mozilla-central/source/toolkit/components/places/PlacesUtils.jsm
// resource://gre/modules/PlacesUtils.jsm

"use strict";

this.EXPORTED_SYMBOLS = [
  "SBNTPlacesUtils",
  "SBNTSortFolderByNameTransaction"
];

this.SBNTPlacesUtils = {
  SORT_BY_LOCALES: 0,
  SORT_BY_SQL: 1,
  SORT_BY_URL: 2,
};

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils", "resource://gre/modules/PlacesUtils.jsm");

/**
 * Used to cache bookmark information in transactions.
 *
 * @note To avoid leaks any non-primitive property should be copied.
 * @note Used internally, DO NOT EXPORT.
 */
function TransactionItemCache()
{
}

TransactionItemCache.prototype = {
  set id(v)
    this._id = (parseInt(v) > 0 ? v : null),
  get id()
    this._id || -1,
  set parentId(v)
    this._parentId = (parseInt(v) > 0 ? v : null),
  get parentId()
    this._parentId || -1,
  keyword: null,
  title: null,
  dateAdded: null,
  lastModified: null,
  postData: null,
  itemType: null,
  set uri(v)
    this._uri = (v instanceof Ci.nsIURI ? v.clone() : null),
  get uri()
    this._uri || null,
  set feedURI(v)
    this._feedURI = (v instanceof Ci.nsIURI ? v.clone() : null),
  get feedURI()
    this._feedURI || null,
  set siteURI(v)
    this._siteURI = (v instanceof Ci.nsIURI ? v.clone() : null),
  get siteURI()
    this._siteURI || null,
  set index(v)
    this._index = (parseInt(v) >= 0 ? v : null),
  // Index can be 0.
  get index()
    this._index != null ? this._index : PlacesUtils.bookmarks.DEFAULT_INDEX,
  set annotations(v)
    this._annotations = Array.isArray(v) ? Cu.cloneInto(v, {}) : null,
  get annotations()
    this._annotations || null,
  set tags(v)
    this._tags = (v && Array.isArray(v) ? Array.slice(v) : null),
  get tags()
    this._tags || null,
};


/**
 * Base transaction implementation.
 *
 * @note used internally, DO NOT EXPORT.
 */
function BaseTransaction()
{
}

BaseTransaction.prototype = {
  name: null,
  set childTransactions(v)
    this._childTransactions = (Array.isArray(v) ? Array.slice(v) : null),
  get childTransactions()
    this._childTransactions || null,
  doTransaction: function BTXN_doTransaction() {},
  redoTransaction: function BTXN_redoTransaction() this.doTransaction(),
  undoTransaction: function BTXN_undoTransaction() {},
  merge: function BTXN_merge() false,
  get isTransient() false,
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsITransaction
  ]),
};

/**
 * Transaction for sorting a folder by name
 *
 * @param folderId
 *        id of the folder to sort
 *
 * @param sortBy
 *        SORT_BY_LOCALES or SORT_BY_SQL
 *
 * @param locales
 *        locales for localeCompare
 *
 * @param options
 *        options for localeCompare
 *
 * @return nsITransaction object
 */
this.SBNTSortFolderByNameTransaction =
 function SBNTSortFolderByNameTransaction(folderId, sortBy, locales, options)
{
  this.item = new TransactionItemCache();
  this.item.id = folderId;
  this.item.sortBy = sortBy;
  this.item.locales = locales;
  this.item.options = options;
}

// AMO says "Using __proto__ or setPrototypeOf to set a prototype is now deprecated."
// see https://bugzilla.mozilla.org/show_bug.cgi?id=948227
// "Particularly with IE11 adding support for this, we need to act on this now"
// though PlacesUtils.jsm is still making heavy use of __proto__ now
// let's fix it here anyway
SBNTSortFolderByNameTransaction.prototype = Object.create(BaseTransaction.prototype);
SBNTSortFolderByNameTransaction.prototype.constructor = SBNTSortFolderByNameTransaction;

SBNTSortFolderByNameTransaction.prototype.getOrderBySQL = function SFBNT_getOrderBySQL() {
  const order = {};
  const historyService = Cc["@mozilla.org/browser/nav-history-service;1"].
                        getService(Ci.nsINavHistoryService);
  const bookmarkService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].
                         getService(Ci.nsINavBookmarksService);
  const query = historyService.getNewQuery();
  query.setFolders([this.item.id], 1);
  const options = historyService.getNewQueryOptions();
  options.queryType = options.QUERY_TYPE_BOOKMARKS;
  options.sortingMode = options.SORT_BY_TITLE_ASCENDING;
  const result = historyService.executeQuery(query, options);
  const resultContainerNode = result.root;
  resultContainerNode.containerOpen = true;
  for (let i = 0; i < resultContainerNode.childCount; i++) {
    order[resultContainerNode.getChild(i).itemId] = i;
  }
  resultContainerNode.containerOpen = false;
  return order;
}

SBNTSortFolderByNameTransaction.prototype.doTransaction = function SFBNTXN_doTransaction() {
  this._oldOrder = [];

  let contents =
    PlacesUtils.getFolderContents(this.item.id, false, false).root;

  let count = contents.childCount;

  const sortBy = this.item.sortBy;
  let locales;
  let options;
  let orderBySQL;
  switch (sortBy) {
    case SBNTPlacesUtils.SORT_BY_LOCALES:
      locales = this.item.locales;
      options = this.item.options;
      break;
    case SBNTPlacesUtils.SORT_BY_SQL:
      orderBySQL = this.getOrderBySQL();
      break;
  }

  // sort between separators
  let newOrder = [];
  let preSep = []; // temporary array for sorting each group of items
  let urlCompare = (a, b, locales, options) => {
    // don't sort sub folder by location
    if (PlacesUtils.nodeIsContainer(a))
      return 0;
    let http = /^https?:/;
    if (http.test(a.uri) && http.test(b.uri))
      return a.uri.replace(http, "").localeCompare(b.uri.replace(http, ""), locales, options);
    return a.uri.localeCompare(b.uri, locales, options);
  };
  let sortingMethod =
    function (a, b) {
      if (PlacesUtils.nodeIsContainer(a) && !PlacesUtils.nodeIsContainer(b))
        return -1;
      if (!PlacesUtils.nodeIsContainer(a) && PlacesUtils.nodeIsContainer(b))
        return 1;

      switch (sortBy) {
        case SBNTPlacesUtils.SORT_BY_LOCALES:
          // bug 853301
          // Enable ECMAScript Internationalization API for desktop Firefox
          // str.localeCompare(compareString [, locales [, options]])
          return a.title.localeCompare(b.title, locales, options);
        case SBNTPlacesUtils.SORT_BY_SQL:
          return orderBySQL[a.itemId] - orderBySQL[b.itemId];
        case SBNTPlacesUtils.SORT_BY_URL:
          return urlCompare(a, b, locales, options);
        default:
          return a.title.localeCompare(b.title);
      }
    };

  for (let i = 0; i < count; ++i) {
    let item = contents.getChild(i);
    this._oldOrder[item.itemId] = i;
    if (PlacesUtils.nodeIsSeparator(item)) {
      if (preSep.length > 0) {
        preSep.sort(sortingMethod);
        newOrder = newOrder.concat(preSep);
        preSep.splice(0, preSep.length);
      }
      newOrder.push(item);
    }
    else
      preSep.push(item);
  }
  contents.containerOpen = false;

  if (preSep.length > 0) {
    preSep.sort(sortingMethod);
    newOrder = newOrder.concat(preSep);
  }

  // set the new indexes
  let callback = {
    runBatched: function() {
      for (let i = 0; i < newOrder.length; ++i) {
        PlacesUtils.bookmarks.setItemIndex(newOrder[i].itemId, i);
      }
    }
  };
  PlacesUtils.bookmarks.runInBatchMode(callback, null);
}

SBNTSortFolderByNameTransaction.prototype.undoTransaction = function SFBNTXN_undoTransaction() {
  let callback = {
    _self: this,
    runBatched: function() {
      for (let item in this._self._oldOrder)
        PlacesUtils.bookmarks.setItemIndex(item, this._self._oldOrder[item]);
    }
  };
  PlacesUtils.bookmarks.runInBatchMode(callback, null);
}
