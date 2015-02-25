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
// http://mxr.mozilla.org/mozilla-central/source/toolkit/components/places/PlacesTransactions.jsm
// resource://gre/modules/PlacesTransactions.jsm

"use strict";

this.EXPORTED_SYMBOLS = ["SBNTPlacesTransactions"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "Promise",
                                  "resource://gre/modules/Promise.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "Task",
                                  "resource://gre/modules/Task.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "NetUtil",
                                  "resource://gre/modules/NetUtil.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
                                  "resource://gre/modules/PlacesUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "console",
                                  "resource://gre/modules/devtools/Console.jsm");

Components.utils.importGlobalProperties(["URL"]);

let TransactionsHistory = [];
TransactionsHistory.__proto__ = {
  __proto__: Array.prototype,

  // The index of the first undo entry (if any) - See the documentation
  // at the top of this file.
  _undoPosition: 0,
  get undoPosition() this._undoPosition,

  // Handy shortcuts
  get topUndoEntry() this.undoPosition < this.length ?
                     this[this.undoPosition] : null,
  get topRedoEntry() this.undoPosition > 0 ?
                     this[this.undoPosition - 1] : null,

  // Outside of this module, the API of transactions is inaccessible, and so
  // are any internal properties.  To achieve that, transactions are proxified
  // in their constructors.  This maps the proxies to their respective raw
  // objects.
  proxifiedToRaw: new WeakMap(),

  /**
   * Proxify a transaction object for consumers.
   * @param aRawTransaction
   *        the raw transaction object.
   * @return the proxified transaction object.
   * @see getRawTransaction for retrieving the raw transaction.
   */
  proxifyTransaction: function (aRawTransaction) {
    let proxy = Object.freeze({
      transact() TransactionsManager.transact(this)
    });
    this.proxifiedToRaw.set(proxy, aRawTransaction);
    return proxy;
  },

  /**
   * Check if the given object is a the proxy object for some transaction.
   * @param aValue
   *        any JS value.
   * @return true if aValue is the proxy object for some transaction, false
   * otherwise.
   */
  isProxifiedTransactionObject:
  function (aValue) this.proxifiedToRaw.has(aValue),

  /**
   * Get the raw transaction for the given proxy.
   * @param aProxy
   *        the proxy object
   * @return the transaction proxified by aProxy; |undefined| is returned if
   * aProxy is not a proxified transaction.
   */
  getRawTransaction(aProxy) this.proxifiedToRaw.get(aProxy),

  /**
   * Add a transaction either as a new entry, if forced or if there are no undo
   * entries, or to the top undo entry.
   *
   * @param aProxifiedTransaction
   *        the proxified transaction object to be added to the transaction
   *        history.
   * @param [optional] aForceNewEntry
   *        Force a new entry for the transaction. Default: false.
   *        If false, an entry will we created only if there's no undo entry
   *        to extend.
   */
  add(aProxifiedTransaction, aForceNewEntry = false) {
    if (!this.isProxifiedTransactionObject(aProxifiedTransaction))
      throw new Error("aProxifiedTransaction is not a proxified transaction");

    if (this.length == 0 || aForceNewEntry) {
      this.clearRedoEntries();
      this.unshift([aProxifiedTransaction]);
    }
    else {
      this[this.undoPosition].unshift(aProxifiedTransaction);
    }
  },

  /**
   * Clear all undo entries.
   */
  clearUndoEntries() {
    if (this.undoPosition < this.length)
      this.splice(this.undoPosition);
  },

  /**
   * Clear all redo entries.
   */
  clearRedoEntries() {
    if (this.undoPosition > 0) {
      this.splice(0, this.undoPosition);
      this._undoPosition = 0;
    }
  },

  /**
   * Clear all entries.
   */
  clearAllEntries() {
    if (this.length > 0) {
      this.splice(0);
      this._undoPosition = 0;
    }
  }
};


let SBNTPlacesTransactions = {
  /**
   * @see Batches in the module documentation.
   */
  batch(aToBatch) {
    let batchFunc;
    if (Array.isArray(aToBatch)) {
      if (aToBatch.length == 0)
        throw new Error("aToBatch must not be an empty array");

      if (aToBatch.some(
           o => !TransactionsHistory.isProxifiedTransactionObject(o))) {
        throw new Error("aToBatch contains non-transaction element");
      }
      return TransactionsManager.batch(function* () {
        for (let txn of aToBatch) {
          try {
            yield txn.transact();
          }
          catch(ex) {
            console.error(ex);
          }
        }
      });
    }
    if (typeof(aToBatch) == "function") {
      return TransactionsManager.batch(aToBatch);
    }

    throw new Error("aToBatch must be either a function or a transactions array");
  },

  /**
   * Asynchronously undo the transaction immediately after the current undo
   * position in the transactions history in the reverse order, if any, and
   * adjusts the undo position.
   *
   * @return {Promises).  The promise always resolves.
   * @note All undo manager operations are queued. This means that transactions
   * history may change by the time your request is fulfilled.
   */
  undo() TransactionsManager.undo(),

  /**
   * Asynchronously redo the transaction immediately before the current undo
   * position in the transactions history, if any, and adjusts the undo
   * position.
   *
   * @return {Promises).  The promise always resolves.
   * @note All undo manager operations are queued. This means that transactions
   * history may change by the time your request is fulfilled.
   */
  redo() TransactionsManager.redo(),

  /**
   * Asynchronously clear the undo, redo, or all entries from the transactions
   * history.
   *
   * @param [optional] aUndoEntries
   *        Whether or not to clear undo entries.  Default: true.
   * @param [optional] aRedoEntries
   *        Whether or not to clear undo entries.  Default: true.
   *
   * @return {Promises).  The promise always resolves.
   * @throws if both aUndoEntries and aRedoEntries are false.
   * @note All undo manager operations are queued. This means that transactions
   * history may change by the time your request is fulfilled.
   */
  clearTransactionsHistory(aUndoEntries = true, aRedoEntries = true)
    TransactionsManager.clearTransactionsHistory(aUndoEntries, aRedoEntries),

  /**
   * The numbers of entries in the transactions history.
   */
  get length() TransactionsHistory.length,

  /**
   * Get the transaction history entry at a given index.  Each entry consists
   * of one or more transaction objects.
   *
   * @param aIndex
   *        the index of the entry to retrieve.
   * @return an array of transaction objects in their undo order (that is,
   * reversely to the order they were executed).
   * @throw if aIndex is invalid (< 0 or >= length).
   * @note the returned array is a clone of the history entry and is not
   * kept in sync with the original entry if it changes.
   */
  entry(aIndex) {
    if (!Number.isInteger(aIndex) || aIndex < 0 || aIndex >= this.length)
      throw new Error("Invalid index");

    return TransactionsHistory[aIndex];
  },

  /**
   * The index of the top undo entry in the transactions history.
   * If there are no undo entries, it equals to |length|.
   * Entries past this point
   * Entries at and past this point are redo entries.
   */
  get undoPosition() TransactionsHistory.undoPosition,

  /**
   * Shortcut for accessing the top undo entry in the transaction history.
   */
  get topUndoEntry() TransactionsHistory.topUndoEntry,

  /**
   * Shortcut for accessing the top redo entry in the transaction history.
   */
  get topRedoEntry() TransactionsHistory.topRedoEntry
};

/**
 * Helper for serializing the calls to TransactionsManager methods. It allows
 * us to guarantee that the order in which TransactionsManager asynchronous
 * methods are called also enforces the order in which they're executed, and
 * that they are never executed in parallel.
 *
 * In other words: Enqueuer.enqueue(aFunc1); Enqueuer.enqueue(aFunc2) is roughly
 * the same as Task.spawn(aFunc1).then(Task.spawn(aFunc2)).
 */
function Enqueuer() {
  this._promise = Promise.resolve();
}
Enqueuer.prototype = {
  /**
   * Spawn a functions once all previous functions enqueued are done running,
   * and all promises passed to alsoWaitFor are no longer pending.
   *
   * @param   aFunc
   *          @see Task.spawn.
   * @return  a promise that resolves once aFunc is done running. The promise
   *          "mirrors" the promise returned by aFunc.
   */
  enqueue(aFunc) {
    let promise = this._promise.then(Task.async(aFunc));

    // Propagate exceptions to the caller, but dismiss them internally.
    this._promise = promise.catch(console.error);
    return promise;
  },

  /**
   * Same as above, but for a promise returned by a function that already run.
   * This is useful, for example, for serializing transact calls with undo calls,
   * even though transact has its own Enqueuer.
   *
   * @param aPromise
   *        any promise.
   */
  alsoWaitFor(aPromise) {
    // We don't care if aPromise resolves or rejects, but just that is not
    // pending anymore.
    let promise = aPromise.catch(console.error);
    this._promise = Promise.all([this._promise, promise]);
  },

  /**
   * The promise for this queue.
   */
  get promise() this._promise
};

let TransactionsManager = {
  // See the documentation at the top of this file. |transact| calls are not
  // serialized with |batch| calls.
  _mainEnqueuer: new Enqueuer(),
  _transactEnqueuer: new Enqueuer(),

  // Is a batch in progress? set when we enter a batch function and unset when
  // it's execution is done.
  _batching: false,

  // If a batch started, this indicates if we've already created an entry in the
  // transactions history for the batch (i.e. if at least one transaction was
  // executed successfully).
  _createdBatchEntry: false,

  // Transactions object should never be recycled (that is, |execute| should
  // only be called once (or not at all) after they're constructed.
  // This keeps track of all transactions which were executed.
  _executedTransactions: new WeakSet(),

  transact(aTxnProxy) {
    let rawTxn = TransactionsHistory.getRawTransaction(aTxnProxy);
    if (!rawTxn)
      throw new Error("|transact| was called with an unexpected object");

    if (this._executedTransactions.has(rawTxn))
      throw new Error("Transactions objects may not be recycled.");

    // Add it in advance so one doesn't accidentally do
    // sameTxn.transact(); sameTxn.transact();
    this._executedTransactions.add(rawTxn);

    let promise = this._transactEnqueuer.enqueue(function* () {
      // Don't try to catch exceptions. If execute fails, we better not add the
      // transaction to the undo stack.
      let retval = yield rawTxn.execute();

      let forceNewEntry = !this._batching || !this._createdBatchEntry;
      TransactionsHistory.add(aTxnProxy, forceNewEntry);
      if (this._batching)
        this._createdBatchEntry = true;

      this._updateCommandsOnActiveWindow();
      return retval;
    }.bind(this));
    this._mainEnqueuer.alsoWaitFor(promise);
    return promise;
  },

  batch(aTask) {
    return this._mainEnqueuer.enqueue(function* () {
      this._batching = true;
      this._createdBatchEntry = false;
      let rv;
      try {
        // We should return here, but bug 958949 makes that impossible.
        rv = (yield Task.spawn(aTask));
      }
      finally {
        this._batching = false;
        this._createdBatchEntry = false;
      }
      return rv;
    }.bind(this));
  },

  /**
   * Undo the top undo entry, if any, and update the undo position accordingly.
   */
  undo() {
    let promise = this._mainEnqueuer.enqueue(function* () {
      let entry = TransactionsHistory.topUndoEntry;
      if (!entry)
        return;

      for (let txnProxy of entry) {
        try {
          yield TransactionsHistory.getRawTransaction(txnProxy).undo();
        }
        catch(ex) {
          // If one transaction is broken, it's not safe to work with any other
          // undo entry.  Report the error and clear the undo history.
          console.error(ex,
                        "Couldn't undo a transaction, clearing all undo entries.");
          TransactionsHistory.clearUndoEntries();
          return;
        }
      }
      TransactionsHistory._undoPosition++;
      this._updateCommandsOnActiveWindow();
    }.bind(this));
    this._transactEnqueuer.alsoWaitFor(promise);
    return promise;
  },

  /**
   * Redo the top redo entry, if any, and update the undo position accordingly.
   */
  redo() {
    let promise = this._mainEnqueuer.enqueue(function* () {
      let entry = TransactionsHistory.topRedoEntry;
      if (!entry)
        return;

      for (let i = entry.length - 1; i >= 0; i--) {
        let transaction = TransactionsHistory.getRawTransaction(entry[i]);
        try {
          if (transaction.redo)
            yield transaction.redo();
          else
            yield transaction.execute();
        }
        catch(ex) {
          // If one transaction is broken, it's not safe to work with any other
          // redo entry. Report the error and clear the undo history.
          console.error(ex,
                        "Couldn't redo a transaction, clearing all redo entries.");
          TransactionsHistory.clearRedoEntries();
          return;
        }
      }
      TransactionsHistory._undoPosition--;
      this._updateCommandsOnActiveWindow();
    }.bind(this));

    this._transactEnqueuer.alsoWaitFor(promise);
    return promise;
  },

  clearTransactionsHistory(aUndoEntries, aRedoEntries) {
    let promise = this._mainEnqueuer.enqueue(function* () {
      if (aUndoEntries && aRedoEntries)
        TransactionsHistory.clearAllEntries();
      else if (aUndoEntries)
        TransactionsHistory.clearUndoEntries();
      else if (aRedoEntries)
        TransactionsHistory.clearRedoEntries();
      else
        throw new Error("either aUndoEntries or aRedoEntries should be true");
    }.bind(this));

    this._transactEnqueuer.alsoWaitFor(promise);
    return promise;
  },

  // Updates commands in the undo group of the active window commands.
  // Inactive windows commands will be updated on focus.
  _updateCommandsOnActiveWindow() {
    // Updating "undo" will cause a group update including "redo".
    try {
      let win = Services.focus.activeWindow;
      if (win)
        win.updateCommands("undo");
    }
    catch(ex) { console.error(ex, "Couldn't update undo commands"); }
  }
};

/**
 * Internal helper for defining the standard transactions and their input.
 * It takes the required and optional properties, and generates the public
 * constructor (which takes the input in the form of a plain object) which,
 * when called, creates the argument-less "public" |execute| method by binding
 * the input properties to the function arguments (required properties first,
 * then the optional properties).
 *
 * If this seems confusing, look at the consumers.
 *
 * This magic serves two purposes:
 * (1) It completely hides the transactions' internals from the module
 *     consumers.
 * (2) It keeps each transaction implementation to what is about, bypassing
 *     all this bureaucracy while still validating input appropriately.
 */
function DefineTransaction(aRequiredProps = [], aOptionalProps = []) {
  for (let prop of [...aRequiredProps, ...aOptionalProps]) {
    if (!DefineTransaction.inputProps.has(prop))
      throw new Error("Property '" + prop + "' is not defined");
  }

  let ctor = function (aInput) {
    // We want to support both syntaxes:
    // let t = new PlacesTransactions.NewBookmark(),
    // let t = PlacesTransactions.NewBookmark()
    if (this == SBNTPlacesTransactions)
      return new ctor(aInput);

    if (aRequiredProps.length > 0 || aOptionalProps.length > 0) {
      // Bind the input properties to the arguments of execute.
      let input = DefineTransaction.verifyInput(aInput, aRequiredProps,
                                                aOptionalProps);
      let executeArgs = [this,
                         ...[input[prop] for (prop of aRequiredProps)],
                         ...[input[prop] for (prop of aOptionalProps)]];
      this.execute = Function.bind.apply(this.execute, executeArgs);
    }
    return TransactionsHistory.proxifyTransaction(this);
  };
  return ctor;
}

function simpleValidateFunc(aCheck) {
  return v => {
    if (!aCheck(v))
      throw new Error("Invalid value");
    return v;
  };
}

DefineTransaction.strValidate = simpleValidateFunc(v => typeof(v) == "string");
DefineTransaction.strOrNullValidate =
  simpleValidateFunc(v => typeof(v) == "string" || v === null);
DefineTransaction.indexValidate =
  simpleValidateFunc(v => Number.isInteger(v) &&
                          v >= PlacesUtils.bookmarks.DEFAULT_INDEX);
DefineTransaction.guidValidate =
  simpleValidateFunc(v => /^[a-zA-Z0-9\-_]{12}$/.test(v));

function isPrimitive(v) {
  return v === null || (typeof(v) != "object" && typeof(v) != "function");
}

DefineTransaction.annotationObjectValidate = function (obj) {
  let checkProperty = (aPropName, aRequired, aCheckFunc) => {
    if (aPropName in obj)
      return aCheckFunc(obj[aPropName]);

    return !aRequired;
  };

  if (obj &&
      checkProperty("name", true, v => typeof(v) == "string" && v.length > 0) &&
      checkProperty("expires", false, Number.isInteger) &&
      checkProperty("flags", false, Number.isInteger) &&
      checkProperty("value", false, isPrimitive) ) {
    // Nothing else should be set
    let validKeys = ["name", "value", "flags", "expires"];
    if (Object.keys(obj).every( (k) => validKeys.indexOf(k) != -1 ))
      return obj;
  }
  throw new Error("Invalid annotation object");
};

DefineTransaction.urlValidate = function(url) {
  // When this module is updated to use Bookmarks.jsm, we should actually
  // convert nsIURIs/spec to URL objects.
  if (url instanceof Components.interfaces.nsIURI)
    return url;
  let spec = url instanceof URL ? url.href : url;
  return NetUtil.newURI(spec);
};

DefineTransaction.inputProps = new Map();
DefineTransaction.defineInputProps =
function (aNames, aValidationFunction, aDefaultValue) {
  for (let name of aNames) {
    // Workaround bug 449811.
    let propName = name;
    this.inputProps.set(propName, {
      validateValue: function (aValue) {
        if (aValue === undefined)
          return aDefaultValue;
        try {
          return aValidationFunction(aValue);
        }
        catch(ex) {
          throw new Error(`Invalid value for input property ${propName}`);
        }
      },

      validateInput: function (aInput, aRequired) {
        if (aRequired && !(propName in aInput))
          throw new Error(`Required input property is missing: ${propName}`);
        return this.validateValue(aInput[propName]);
      },

      isArrayProperty: false
    });
  }
};

DefineTransaction.defineArrayInputProp =
function (aName, aBasePropertyName) {
  let baseProp = this.inputProps.get(aBasePropertyName);
  if (!baseProp)
    throw new Error(`Unknown input property: ${aBasePropertyName}`);

  this.inputProps.set(aName, {
    validateValue: function (aValue) {
      if (aValue == undefined)
        return [];

      if (!Array.isArray(aValue))
        throw new Error(`${aName} input property value must be an array`);

      // This also takes care of abandoning the global scope of the input
      // array (through Array.prototype).
      return [for (e of aValue) baseProp.validateValue(e)];
    },

    // We allow setting either the array property itself (e.g. urls), or a
    // single element of it (url, in that example), that is then transformed
    // into a single-element array.
    validateInput: function (aInput, aRequired) {
      if (aName in aInput) {
        // It's not allowed to set both though.
        if (aBasePropertyName in aInput) {
          throw new Error(`It is not allowed to set both ${aName} and
                          ${aBasePropertyName} as  input properties`);
        }
        let array = this.validateValue(aInput[aName]);
        if (aRequired && array.length == 0) {
          throw new Error(`Empty array passed for required input property:
                           ${aName}`);
        }
        return array;
      }
      // If the property is required and it's not set as is, check if the base
      // property is set.
      if (aRequired && !(aBasePropertyName in aInput))
        throw new Error(`Required input property is missing: ${aName}`);

      if (aBasePropertyName in aInput)
        return [baseProp.validateValue(aInput[aBasePropertyName])];

      return [];
    },

    isArrayProperty: true
  });
};

DefineTransaction.validatePropertyValue =
function (aProp, aInput, aRequired) {
  return this.inputProps.get(aProp).validateInput(aInput, aRequired);
};

DefineTransaction.getInputObjectForSingleValue =
function (aInput, aRequiredProps, aOptionalProps) {
  // The following input forms may be deduced from a single value:
  // * a single required property with or without optional properties (the given
  //   value is set to the required property).
  // * a single optional property with no required properties.
  if (aRequiredProps.length > 1 ||
      (aRequiredProps.length == 0 && aOptionalProps.length > 1)) {
    throw new Error("Transaction input isn't an object");
  }

  let propName = aRequiredProps.length == 1 ?
                 aRequiredProps[0] : aOptionalProps[0];
  let propValue =
    this.inputProps.get(propName).isArrayProperty && !Array.isArray(aInput) ?
    [aInput] : aInput;
  return { [propName]: propValue };
};

DefineTransaction.verifyInput =
function (aInput, aRequiredProps = [], aOptionalProps = []) {
  if (aRequiredProps.length == 0 && aOptionalProps.length == 0)
    return {};

  // If there's just a single required/optional property, we allow passing it
  // as is, so, for example, one could do PlacesTransactions.RemoveItem(myGuid)
  // rather than PlacesTransactions.RemoveItem({ guid: myGuid}).
  // This shortcut isn't supported for "complex" properties - e.g. one cannot
  // pass an annotation object this way (note there is no use case for this at
  // the moment anyway).
  let input = aInput;
  let isSinglePropertyInput =
    isPrimitive(aInput) ||
    Array.isArray(aInput) ||
    (aInput instanceof Components.interfaces.nsISupports);
  if (isSinglePropertyInput) {
    input =  this.getInputObjectForSingleValue(aInput,
                                               aRequiredProps,
                                               aOptionalProps);
  }

  let fixedInput = { };
  for (let prop of aRequiredProps) {
    fixedInput[prop] = this.validatePropertyValue(prop, input, true);
  }
  for (let prop of aOptionalProps) {
    fixedInput[prop] = this.validatePropertyValue(prop, input, false);
  }

  return fixedInput;
};

// Update the documentation at the top of this module if you add or
// remove properties.
DefineTransaction.defineInputProps(["url", "feedUrl", "siteUrl"],
                                   DefineTransaction.urlValidate, null);
DefineTransaction.defineInputProps(["guid", "parentGuid", "newParentGuid"],
                                   DefineTransaction.guidValidate);
DefineTransaction.defineInputProps(["title"],
                                   DefineTransaction.strOrNullValidate, null);
DefineTransaction.defineInputProps(["keyword", "postData", "tag",
                                    "excludingAnnotation"],
                                   DefineTransaction.strValidate, "");
DefineTransaction.defineInputProps(["index", "newIndex"],
                                   DefineTransaction.indexValidate,
                                   PlacesUtils.bookmarks.DEFAULT_INDEX);
DefineTransaction.defineInputProps(["annotation"],
                                   DefineTransaction.annotationObjectValidate);
DefineTransaction.defineArrayInputProp("guids", "guid");
DefineTransaction.defineArrayInputProp("urls", "url");
DefineTransaction.defineArrayInputProp("tags", "tag");
DefineTransaction.defineArrayInputProp("annotations", "annotation");
DefineTransaction.defineArrayInputProp("excludingAnnotations",
                                       "excludingAnnotation");

// added for SortByLocales
DefineTransaction.localeCompareLocalesValidate = locales => {
  let localeCompareSupportsLocales = l => {
    try {
      "a".localeCompare("a", l);
    }
    catch (e) {
      return e.name != "RangeError";
    }
    return true;
  };
  let validateF =
    simpleValidateFunc(v => v === "undefined" ||
                            ((typeof(v) == "string" ||
                              (Array.isArray(v) &&
                              v.every(e => typeof(e) == "string"))) &&
                            localeCompareSupportsLocales(v)));
  return validateF(locales);
};
DefineTransaction.defineInputProps(["localeCompareLocales"],
                                   DefineTransaction.localeCompareLocalesValidate, undefined);

DefineTransaction.localeCompareOptionsValidate = obj => {
  let checkProperty = (aPropName, aRequired, aCheckFunc) => {
    if (aPropName in obj)
      return aCheckFunc(obj[aPropName]);
    return !aRequired;
  };

  let inArray = (e, arr) => arr.indexOf(e) != -1;

  if (obj &&
      checkProperty("localeMatcher", false, v => inArray(v, [undefined, "lookup", "best fit"])) &&
      checkProperty("usage", false, v => inArray(v, [undefined, "sort", "search"])) &&
      checkProperty("sensitivity", false, v => inArray(v, [undefined, "base", "accent", "case", "variant"])) &&
      checkProperty("ignorePunctuation", false, v => inArray(v, [undefined, true, false])) &&
      checkProperty("numeric", false, v => inArray(v, [undefined, true, false])) &&
      checkProperty("caseFirst", false, v => inArray(v, [undefined, "upper", "lower", "false"]))) {
    // Nothing else should be set
    let validKeys = ["localeMatcher", "usage", "sensitivity", "ignorePunctuation", "numeric", "caseFirst"];
    if (Object.keys(obj).every( (k) => validKeys.indexOf(k) != -1 ))
      return obj;
  }
  throw new Error("Invalid localeCompare options");
};
DefineTransaction.defineInputProps(["localeCompareOptions"],
                                   DefineTransaction.localeCompareOptionsValidate, undefined);

/*****************************************************************************
 * The SBNT Places Transactions.
 *****************************************************************************/

let SBNTPT = SBNTPlacesTransactions;

/**
 * Transaction for sorting a folder by locales.
 *
 * Required Input Properties: guid
 * Optional Input Properties: locales, options.
 */
SBNTPT.SortByLocales = DefineTransaction(["guid"], ["localeCompareLocales", "localeCompareOptions"]);
SBNTPT.SortByLocales.prototype = {
  execute: function* (aGuid, aLocales, aOptions) {
    let itemId = yield PlacesUtils.promiseItemId(aGuid),
        oldOrder = [],  // [itemId] = old index
        contents = PlacesUtils.getFolderContents(itemId, false, false).root,
        count = contents.childCount;

    // Sort between separators.
    let newOrder = [], // nodes, in the new order.
        preSep   = []; // Temporary array for sorting each group of nodes.
    let sortingMethod = (a, b) => {
      if (PlacesUtils.nodeIsContainer(a) && !PlacesUtils.nodeIsContainer(b))
        return -1;
      if (!PlacesUtils.nodeIsContainer(a) && PlacesUtils.nodeIsContainer(b))
        return 1;
      return a.title.localeCompare(b.title, aLocales, aOptions);
    };

    for (let i = 0; i < count; ++i) {
      let node = contents.getChild(i);
      oldOrder[node.itemId] = i;
      if (PlacesUtils.nodeIsSeparator(node)) {
        if (preSep.length > 0) {
          preSep.sort(sortingMethod);
          newOrder = newOrder.concat(preSep);
          preSep.splice(0, preSep.length);
        }
        newOrder.push(node);
      }
      else
        preSep.push(node);
    }
    contents.containerOpen = false;

    if (preSep.length > 0) {
      preSep.sort(sortingMethod);
      newOrder = newOrder.concat(preSep);
    }

    // Set the nex indexes.
    let callback = {
      runBatched: function() {
        for (let i = 0; i < newOrder.length; ++i) {
          PlacesUtils.bookmarks.setItemIndex(newOrder[i].itemId, i);
        }
      }
    };
    PlacesUtils.bookmarks.runInBatchMode(callback, null);

    this.undo = () => {
      let callback = {
        runBatched: function() {
          for (let item in oldOrder) {
            PlacesUtils.bookmarks.setItemIndex(item, oldOrder[item]);
          }
        }
      };
      PlacesUtils.bookmarks.runInBatchMode(callback, null);
    };
  }
};

/**
 * Transaction for sorting a folder by sql.
 *
 * Required Input Properties: guid.
 */
SBNTPT.SortBySQL = DefineTransaction(["guid"]);
SBNTPT.SortBySQL.prototype = {
  getOrderBySQL: function (itemId) {
    let order = {};
    const historyService = Components.classes["@mozilla.org/browser/nav-history-service;1"].
                           getService(Components.interfaces.nsINavHistoryService);
    const query = historyService.getNewQuery();
    query.setFolders([itemId], 1);
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
  },

  execute: function* (aGuid) {
    let itemId = yield PlacesUtils.promiseItemId(aGuid),
        oldOrder = [],  // [itemId] = old index
        contents = PlacesUtils.getFolderContents(itemId, false, false).root,
        count = contents.childCount;

    let sqlOrder = this.getOrderBySQL(itemId);

    // Sort between separators.
    let newOrder = [], // nodes, in the new order.
        preSep   = []; // Temporary array for sorting each group of nodes.
    let sortingMethod = (a, b) => {
      if (PlacesUtils.nodeIsContainer(a) && !PlacesUtils.nodeIsContainer(b))
        return -1;
      if (!PlacesUtils.nodeIsContainer(a) && PlacesUtils.nodeIsContainer(b))
        return 1;
      return sqlOrder[a.itemId] - sqlOrder[b.itemId];
    };

    for (let i = 0; i < count; ++i) {
      let node = contents.getChild(i);
      oldOrder[node.itemId] = i;
      if (PlacesUtils.nodeIsSeparator(node)) {
        if (preSep.length > 0) {
          preSep.sort(sortingMethod);
          newOrder = newOrder.concat(preSep);
          preSep.splice(0, preSep.length);
        }
        newOrder.push(node);
      }
      else
        preSep.push(node);
    }
    contents.containerOpen = false;

    if (preSep.length > 0) {
      preSep.sort(sortingMethod);
      newOrder = newOrder.concat(preSep);
    }

    // Set the nex indexes.
    let callback = {
      runBatched: function() {
        for (let i = 0; i < newOrder.length; ++i) {
          PlacesUtils.bookmarks.setItemIndex(newOrder[i].itemId, i);
        }
      }
    };
    PlacesUtils.bookmarks.runInBatchMode(callback, null);

    this.undo = () => {
      let callback = {
        runBatched: function() {
          for (let item in oldOrder) {
            PlacesUtils.bookmarks.setItemIndex(item, oldOrder[item]);
          }
        }
      };
      PlacesUtils.bookmarks.runInBatchMode(callback, null);
    };
  }
};
