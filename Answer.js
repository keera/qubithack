(function(window) {

  var Matcher = function(root) {
    this.currValue;
    this.visited = [];
    this.results = [root];
    this.matcher = this.idMatcher;
    this.search = this.searchDescendents;
  };

  Matcher.prototype.idMatcher = function(obj) {
    if (!obj.id) return false;
    return obj.id === this.currValue;
  };

  Matcher.prototype.tagMatcher = function(obj) {
    if (!obj.tagName) return false;
    return obj.tagName.toLowerCase() === this.currValue.toLowerCase();
  };

  Matcher.prototype.classMatcher = function(obj) {
    if (!obj.className) return false;
    return obj.classList.contains(this.currValue);
  };

  Matcher.prototype.searchElements = function(type, value) {
    this.currValue = value;
    switch (type) {
      case "id":
        this.matcher = this.idMatcher;
      break;
      case "tag":
        this.matcher = this.tagMatcher;
      break;
      case "class":
        this.matcher = this.classMatcher;
      break;
    }
    for (var i = 0, len = this.results.length; i < len; i++) {
      this.search(this.results.shift());
    }
    this.visited.length = 0;
  };

  Matcher.prototype.searchCurrent = function(obj) {
    if (!obj) return;
    if (this.visited.indexOf(obj) >= 0) return;
    if (this.matcher(obj)) {
      this.results.push(obj);
      this.visited.push(obj);
    }
  };

  Matcher.prototype.searchDescendents = function(obj) {
    if (!obj) return;
    this.searchCurrent(obj);
    var children = obj.childNodes;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType == Node.ELEMENT_NODE) {
        this.searchDescendents(child);
      }
    }
  };

  Matcher.prototype.searchChildren = function(obj) {
    if (!obj) return;
    var children = obj.childNodes;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      this.searchCurrent(child);
    }
  };

  window.Matcher = Matcher;
})(window);

(function(window, Matcher) {

  var matcher, toks;

  var tokens = {
    IDENT: "ident",
    SPACE: "space",
    HASH:  "hash",
    CLASS: "class"
  };

  var order = [
    tokens.IDENT,
    tokens.HASH,
    tokens.CLASS,
    tokens.SPACE
  ];

  var TokenPattern = function() {
    // Basic patterns
    var nmstart = "[_a-z]";
    var nmchar = "[_a-z0-9-]";
    var name = nmchar + "+";
    var ident = "[-]?" + nmstart + nmchar + "*";
    var space = "[ \\t\\r\\n\\f]+";
    var w = "[ \\t\\r\\n\\f]*";
    // Token patterns
    this[tokens.IDENT] = new RegExp("^" + ident);
    this[tokens.SPACE] = new RegExp("^" + space);
    this[tokens.HASH] = new RegExp("^#" + name);
    this[tokens.CLASS] = new RegExp("^\\." + name);
  };

  var Token = function(name, value) {
    this.name = name;
    switch (name) {
      case tokens.SPACE:
        this.value = " ";
      break;
      case tokens.HASH:
        this.value = value.slice(1);
      break;
      case tokens.CLASS:
        this.value = value.slice(1);
      break;
      default:
        this.value = value;
      break;
    }
  };

  var tokPattern = new TokenPattern();

  var tokenize = function(str) {
    var matches = [];
    while (str.length) {
      var hasMatch = false;
      for (var k in order) {
        var tokName = order[k];
        var match = str.match(tokPattern[tokName]);
        if (match) {
          hasMatch = true;
          var val = match[0];
          matches.push(new Token(tokName, val));
          str = str.slice(val.length);
          break;
        }
      }

      if (!hasMatch) break;
    }
    return matches;
  }

  // Parsing
  var getTok = function() {
    return toks.shift();
  };

  var peekTok = function() {
    return toks[0];
  };

  var selectorGroup = function(tok) {
    selector(tok);
    tok = getTok();
    while (tok && tok.name === 'comma') {
      tok = getTok();
      if (tok.name == tokens.SPACE) {
        selector(getTok());
      } else {
        selector(tok);
      }
      tok = getTok();
    }
  };

  var selector = function(tok) {
    matcher.search = matcher.searchDescendents;
    simpleSelectorSequence(tok);
    tok = getTok();
    while (combinator(tok)) {
      simpleSelectorSequence(getTok());
      tok = getTok();
    }
  };

  var simpleSelectorSequence = function(tok) {
    if (typeSelector(tok) || specialSelector(tok)) {
      matcher.search = matcher.searchCurrent;
      while (specialSelector(peekTok()) && getTok());
    }
  };

  var typeSelector = function(tok) {
    if (!tok) return;
    if (tok.name === tokens.IDENT) {
      matcher.searchElements("tag", tok.value);
      return tok;
    }
  };

  var specialSelector = function(tok) {
    if (!tok) return;
    if (tok.name === tokens.HASH) {
      matcher.searchElements("id", tok.value);
      return tok;
    } else if (tok.name === tokens.CLASS) {
      matcher.searchElements("class", tok.value);
      return tok;
    }
  };

  var combinator = function(tok) {
    if (!tok) return;
    if (tok.name === tokens.SPACE) {
      matcher.search = matcher.searchDescendents;
      return tok;
    }
  };

  window.Parser = {
    $: function(str) {
      var root = window.document;
      matcher = new Matcher(root);
      toks = tokenize(str);
      selectorGroup(getTok());
      return matcher.results;
    }
  }
})(window, Matcher);

var $ = function (selector) {
  return Parser.$(selector);
}

