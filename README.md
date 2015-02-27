# Sort By Name Tweak

Sort bookmarks by name tweaks for Firefox 29+.

This extension was originally developed for zh-CN and zh-TW users, because new version of [String.prototype.localeCompare()] (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) - one of [ECMAScript Internationalization(i18n) APIs] (https://bugzilla.mozilla.org/show_bug.cgi?id=853301) enabled in Firefox 29 - can break the build-in "Sort By Name" when the folder contains bookmarks whose titles have Chinese characters, as stated in [bug 1036383] (https://bugzilla.mozilla.org/show_bug.cgi?id=1036383).

It may still be useful for users of other locales, e.g. `sensitivity: base`, `numeric: true`.

See this [post] (https://hacks.mozilla.org/2014/12/introducing-the-javascript-internationalization-api/) for more details about those i18n APIs.

## License

GNU General Public License v3.0

http://www.gnu.org/copyleft/gpl.html
