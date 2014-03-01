(function(window) {

  var Matcher = function(root) {
    this.root = root;
    this.currValue;
    this.currResults;
    this.visited = [];
    this.results = [[root]];
    this.matcher = this.idMatcher;
    this.search = this.searchDescendents;
  };

  Matcher.Attr = {
    ID: "id",
    CLASS: "class",
    TAG: "tag"
  };

  Matcher.prototype.newMatch = function() {
    this.results.push([this.root]);
  };

  Matcher.prototype.getResults = function() {
    return [].concat.apply([], this.results);
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

  Matcher.prototype.searchCurrent = function(obj) {
    if (!obj) return;
    if (this.visited.indexOf(obj) >= 0) return;
    if (this.matcher(obj)) {
      this.currResults.push(obj);
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

  Matcher.prototype.searchElements = function(attr, value) {
    this.currValue = value;
    switch (attr) {
      case Matcher.Attr.ID:
        this.matcher = this.idMatcher;
      break;
      case Matcher.Attr.TAG:
        this.matcher = this.tagMatcher;
      break;
      case Matcher.Attr.CLASS:
        this.matcher = this.classMatcher;
      break;
    }
    // Get one at top of stack
    this.currResults = this.results[this.results.length-1];
    for (var i = 0, len = this.currResults.length; i < len; i++) {
      this.search(this.currResults.shift());
    }
    this.visited.length = 0;
  };

  Matcher.prototype.searchElementsById = function(value) {
    this.searchElements(Matcher.Attr.ID, value);
  };

  Matcher.prototype.searchElementsByClassName = function(value) {
    this.searchElements(Matcher.Attr.CLASS, value);
  };

  Matcher.prototype.searchElementsByTagName = function(value) {
    this.searchElements(Matcher.Attr.TAG, value);
  };

  Matcher.prototype.useCurrentSearch = function() {
    this.search = this.searchCurrent;
  };

  Matcher.prototype.useDescendentSearch = function() {
    this.search = this.searchDescendents;
  };

  Matcher.prototype.useChildrenSearch = function() {
    this.search = this.searchChildren;
  };

  window.Matcher = Matcher;
})(window);

(function(window) {

  var matcher, toks;

  var tokens = {
    IDENT: "ident",
    SPACE: "space",
    HASH:  "hash",
    CLASS: "class",
    COMMA: "comma"
  };

  var order = [
    tokens.IDENT,
    tokens.HASH,
    tokens.CLASS,
    tokens.SPACE,
    tokens.COMMA
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
    this[tokens.COMMA] = new RegExp("^" + w + "\\,");
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
    while (tok && tok.name === tokens.COMMA) {
      matcher.newMatch();
      tok = getTok();
      if (tok.name === tokens.SPACE) {
        selector(getTok());
      } else {
        selector(tok);
      }
      tok = getTok();
    }
  };

  var selector = function(tok) {
    matcher.useDescendentSearch();
    simpleSelectorSequence(tok);
    while (combinator(peekTok()) && eatTok()) {
      simpleSelectorSequence(getTok());
    }
  };

  var simpleSelectorSequence = function(tok) {
    if (typeSelector(tok) || specialSelector(tok)) {
      matcher.useCurrentSearch();
      while (specialSelector(peekTok()) && getTok());
    }
  };

  var typeSelector = function(tok) {
    if (!tok) return;
    if (tok.name === tokens.IDENT) {
      matcher.searchElementsByTagName(tok.value);
      return tok;
    }
  };

  var specialSelector = function(tok) {
    if (!tok) return;
    if (tok.name === tokens.HASH) {
      matcher.searchElementsById(tok.value);
      return tok;
    } else if (tok.name === tokens.CLASS) {
      matcher.searchElementsByClassName(tok.value);
      return tok;
    }
  };

  var combinator = function(tok) {
    if (!tok) return;
    if (tok.name === tokens.SPACE) {
      matcher.useDescendentSearch();
      return tok;
    }
  };

  window.Parser = {
    $: function(str, matchStrategy) {
      matcher = matchStrategy;
      toks = tokenize(str);
      selectorGroup(getTok());
      return matcher.getResults();
    }
  }
})(window);

var $ = function (selector) {
  return Parser.$(selector, new Matcher(document));
}

