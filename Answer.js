"use strict";

(function(window) {

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

  Selection.AttrType = {
    ID: "id",
    CLASS: "class",
    TAG: "tag"
  };

  var selection;

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
        case Selection.AttrType.ID:
          this.predicate = function(obj) {
            if (!obj.id) return false;
            return obj.id === value;
          };
        break;
        case Selection.AttrType.CLASS:
          this.predicate = function(obj) {
            if (!obj.classList) return false;
            return obj.classList.contains(value);
          };
        break;
        case Selection.AttrType.TAG:
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
      this.getElements(Selection.AttrType.ID, value);
    },

    getElementsByClassName: function(value) {
      this.getElements(Selection.AttrType.CLASS, value);
    },

    getElementsByTagName: function(value) {
      this.getElements(Selection.AttrType.TAG, value);
    }
  };

  var tokens = [];

  var getTok = function() {
    return tokens.shift();
  };

  var peekTok = function() {
    return tokens[0];
  };

  var TokenType = {
    IDENT: "ident",
    SPACE: "space",
    HASH:  "hash",
    CLASS: "class",
    COMMA: "comma"
  };

  var Token = function(name, value) {
    this.name = name;
    switch (name) {
      case TokenType.SPACE:
        this.value = " ";
      break;
      case TokenType.HASH:
        this.value = value.slice(1);
      break;
      case TokenType.CLASS:
        this.value = value.slice(1);
      break;
      default:
        this.value = value;
      break;
    }
  };

  var TokenPattern = (function() {
    // Basic patterns
    var nmstart = "[_a-z]";
    var nmchar = "[_a-z0-9-]";
    var name = nmchar + "+";
    var ident = "[-]?" + nmstart + nmchar + "*";
    var space = "[ \\t\\r\\n\\f]+";
    var w = "[ \\t\\r\\n\\f]*";
    // Token patterns
    var patterns = {};
    patterns[TokenType.IDENT] = new RegExp("^" + ident),
    patterns[TokenType.SPACE] = new RegExp("^" + space),
    patterns[TokenType.HASH] = new RegExp("^#" + name),
    patterns[TokenType.CLASS] = new RegExp("^\\." + name),
    patterns[TokenType.COMMA] = new RegExp("^" + w + "\\,")
    return patterns;
  })();

  var tokenize = function(str) {
    var tokens = [];
    while (str.length) {
      var hasSelection = false;
      for (var k in TokenType) {
        var tokName = TokenType[k];
        var match = str.match(TokenPattern[tokName]);
        if (match) {
          hasSelection = true;
          var val = match[0];
          tokens.push(new Token(tokName, val));
          str = str.slice(val.length);
          break;
        }
      }

      if (!hasSelection) break;
    }
    return tokens;
  }

  var selectorGroup = function(tok) {
    selector(tok);
    tok = getTok();
    while (tok && tok.name === TokenType.COMMA) {
      selection.newSelection();
      tok = getTok();
      if (tok.name === TokenType.SPACE) {
        selector(getTok());
      } else {
        selector(tok);
      }
      tok = getTok();
    }
  };

  var selector = function(tok) {
    selection.setDescendentFilter();
    simpleSelectorSequence(tok);
    while (combinator(peekTok())
        && getTok()
        && simpleSelectorSequence(peekTok())
        && getTok());
  };

  var simpleSelectorSequence = function(tok) {
    if (typeSelector(tok) || specialSelector(tok)) {
      selection.setCurrentFilter();
      while (specialSelector(peekTok()) && getTok());
    }
  };

  var typeSelector = function(tok) {
    if (!tok) return;
    if (tok.name === TokenType.IDENT) {
      selection.getElementsByTagName(tok.value);
      return tok;
    }
  };

  var specialSelector = function(tok) {
    if (!tok) return;
    if (tok.name === TokenType.HASH) {
      selection.getElementsById(tok.value);
      return tok;
    } else if (tok.name === TokenType.CLASS) {
      selection.getElementsByClassName(tok.value);
      return tok;
    }
  };

  var combinator = function(tok) {
    if (!tok) return;
    if (tok.name === TokenType.SPACE) {
      selection.setDescendentFilter();
      return tok;
    }
  };

  window.Parser = {
    $: function(str) {
      selection = new Selection(document);
      tokens = tokenize(str);
      selectorGroup(getTok());
      return selection.getResults();
    }
  }
})(window);

var $ = function (selector) {
  return Parser.$(selector);
}

