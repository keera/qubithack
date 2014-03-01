"use strict";

(function(window, undefined) {

  /**
   * Initialize `Selection` with given root node for traversing
   *
   * @param {Object} root
   */

  var Selection = function(root) {
    this.root = root;
    this.currFilter;
    this.currPredicate;
    this.currResults;
    this.visited = [];
    this.resultSet = [[root]];
  };

  /**
   * Selection prototype
   */

  Selection.prototype = {

    /**
     * Save original constructor
     */

    constructor: Selection,

    /**
     * Checks if DOM element already exists in current selection
     *
     * @param {Object} obj
     * @return {Boolean}
     */

    contains: function(obj) {
      return this.resultSet.some(function(results) {
        return (results.indexOf(obj) >= 0);
      });
    },

    /**
     * new selection due to group selector
     */

    newSelection: function() {
      this.resultSet.push([this.root]);
    },

    /**
     * Combination of multiple selection results
     */

    getResults: function() {
      return [].concat.apply([], this.resultSet);
    },

    /**
     * Filter elements by predicate using an attribute type and target value
     *
     * @param {String} type
     * @param {String} value
     */

    setPredicate: function(type, value) {
      switch (type) {
        case "id":
          this.predicate = function(obj) {
            if (!obj.id) return false;
            return obj.id === value;
          };
        break;
        case "class":
          this.predicate = function(obj) {
            if (!obj.classList) return false;
            return obj.classList.contains(value);
          };
        break;
        case "tag":
          this.predicate = function(obj) {
            if (!obj.tagName) return false;
            return obj.tagName.toLowerCase() === value.toLowerCase();
          };
        break;
      }
    },

    /**
     * Filtering strategy that applies predicate to current node
     *
     * @param {Object} obj
     */

    filterCurrent: function(obj) {
      if (!obj || this.contains(obj)) return;
      if (this.predicate(obj)) {
        this.currResults.push(obj);
        this.visited.push(obj);
      }
    },

    /**
     * Filtering strategy that applies predicate to descendent nodes
     *
     * @param {Object} obj
     */

    filterDescendents: function(obj) {
      if (!obj) return;
      this.filterCurrent(obj);
      var children = obj.childNodes;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.nodeType == Node.ELEMENT_NODE) {
          this.filterDescendents(child);
        }
      }
    },

    /**
     * Filtering strategy that applies predicate to child nodes
     *
     * @param {Object} obj
     */

    filterChildren: function(obj) {
      if (!obj) return;
      var children = obj.childNodes;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        this.filterCurrent(child);
      }
    },

    setCurrentFilter: function() {
      this.currFilter = this.filterCurrent;
    },

    setDescendentFilter: function() {
      this.currFilter = this.filterDescendents;
    },

    setChildrenFilter: function() {
      this.currFilter = this.filterChildren;
    },

    /**
     * Get the matching elements using a predicate and a filter strategy
     *
     * @param {String} attr
     * @param {String} value
     */

    getElements: function(attr, value) {
      this.setPredicate(attr, value);
      // Get most recent results at top of stack
      this.currResults = this.resultSet[this.resultSet.length-1];
      for (var i = 0, len = this.currResults.length; i < len; i++) {
        this.currFilter(this.currResults.shift());
      }
      // Clear visit cache for subsequence search
      this.visited.length = 0;
    },

    getElementsById: function(value) {
      this.getElements("id", value);
    },

    getElementsByClassName: function(value) {
      this.getElements("class", value);
    },

    getElementsByTagName: function(value) {
      this.getElements("tag", value);
    }
  };

  /**
   * Initialize `Lexer` with token list
   */

  var Lexer = function() {
    this.tokens = [];
  }

  /**
   * Lexer prototype
   */

  Lexer.prototype = {

    /**
     * Save original constructor
     */

    constructor: Lexer,

    TokenTypes: [
      "ident",
      "space",
      "hash",
      "class",
      "comma"
    ],

    /**
     * Create a new token
     *
     * @param {String} type
     * @param {String} value
     */

    newTok: function(type, value) {
      switch (type) {
        case "space":
          value = " ";
        break;
        case "hash":
          // Ignore hash
          value = value.slice(1);
        break;
        case "class":
          // Ignore period
          value = value.slice(1);
        break;
        default:
          value = value;
        break;
      }
      return {
        type: type,
        value: value
      };
    },

    /**
     * Set up token patterns for matching
     */

    TokenPattern: (function() {
      // Basic patterns
      var nmstart = "[_a-z]";
      var nmchar = "[_a-z0-9-]";
      var name = nmchar + "+";
      var ident = "[-]?" + nmstart + nmchar + "*";
      var space = "[ \\t\\r\\n\\f]+";
      var w = "[ \\t\\r\\n\\f]*";
      // Token patterns
      var patterns = {};
      patterns["ident"] = new RegExp("^" + ident),
      patterns["space"] = new RegExp("^" + space),
      patterns["hash"] = new RegExp("^#" + name),
      patterns["class"] = new RegExp("^\\." + name),
      patterns["comma"] = new RegExp("^" + w + "\\,")
      return patterns;
    })(),

    /**
     * Split input string into tokens
     *
     * @param {String} str
     */

    tokenize: function(str) {
      this.tokens = [];
      while (str.length) {
        var hasSelection = false;
        for (var i in this.TokenTypes) {
          var tokType = this.TokenTypes[i];
          var match = str.match(this.TokenPattern[tokType]);
          if (match) {
            hasSelection = true;
            var val = match[0];
            this.tokens.push(this.newTok(tokType, val));
            // Consume tok
            str = str.slice(val.length);
            break;
          }
        }

        if (!hasSelection) break;
      }
      return this.tokens;
    }
  };

  /**
   * Initialize `Parser` with lexer
   */

  var Parser = function() {
    this.lexer = new Lexer();
    this.selection;
    this.tokens = [];
  }

  /**
   * Parser prototype
   */

  Parser.prototype = {

    /**
     * Save original constructor
     */

    constructor: Parser,

    /**
     * Consumes a token
     *
     * @return {Object}
     */

    eatTok: function() {
      return this.tokens.shift();
    },

    /**
     * Lookahead one token
     *
     * @return {Object}
     */

    peekTok: function() {
      return this.tokens[0];
    },

    /**
     * selectors_group
     * : selector [ COMMA S* selector ]*
     */

    selectorGroup: function(tok) {
      this.selector(tok);
      tok = this.eatTok();
      while (tok && tok.type === 'comma') {
        this.selection.newSelection();
        tok = this.eatTok();
        if (tok && tok.type === 'space') {
          this.selector(this.eatTok());
        } else {
          this.selector(tok);
        }
        tok = this.eatTok();
      }
    },

    /**
     * selector
     * : simple_selector_sequence [ combinator simple_selector_sequence ]*
     */

    selector: function(tok) {
      this.selection.setDescendentFilter();
      this.simpleSelectorSequence(tok);
      while (this.combinator(this.peekTok())
          && this.eatTok()
          && this.simpleSelectorSequence(this.peekTok())
          && this.eatTok());
    },

    /**
     * simple_selector_sequence
     * : [ type_selector ]
     *   [ special_selector ]*
     * | [ special_selector ]+
     */

    simpleSelectorSequence: function(tok) {
      if (this.typeSelector(tok) || this.specialSelector(tok)) {
        this.selection.setCurrentFilter();
        while (this.specialSelector(this.peekTok()) && this.eatTok());
      }
    },

    /**
     * type_selector
     * : IDENT
     */

    typeSelector: function(tok) {
      if (!tok) return;
      if (tok.type === "ident") {
        this.selection.getElementsByTagName(tok.value);
        return tok;
      }
    },

    /**
     * special_selector
     * : [ HASH | class ]+
     */

    specialSelector: function(tok) {
      if (!tok) return;
      if (tok.type === "hash") {
        this.selection.getElementsById(tok.value);
        return tok;
      } else if (tok.type === "class") {
        this.selection.getElementsByClassName(tok.value);
        return tok;
      }
    },

    /**
     * combinator
     * : S+
     */

    combinator: function(tok) {
      if (!tok) return;
      if (tok.type === "space") {
        this.selection.setDescendentFilter();
        return tok;
      }
    },

    /**
     * Parse the selector input
     *
     * @param {String} input
     */

    parse: function(input) {
      this.selection = new Selection(document);
      this.tokens = this.lexer.tokenize(input);
      this.selectorGroup(this.eatTok());
      return this.selection.getResults();
    }
  }

  window.Parser = Parser;
})(window);

var parser = new Parser();
var $ = function (selector) {
  return parser.parse(selector);
}

