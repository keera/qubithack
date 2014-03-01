(function(window) {

  var Match = function(root) {
    this.root = root;
    this.currValue;
    this.currResults;
    this.visited = [];
    this.results = [[root]];
    this.matcher = this.idMatch;
    this.search = this.searchDescendents;
  };

  Match.Attr = {
    ID: "id",
    CLASS: "class",
    TAG: "tag"
  };

  Match.prototype.newMatch = function() {
    this.results.push([this.root]);
  };

  Match.prototype.getResults = function() {
    return [].concat.apply([], this.results);
  };

  Match.prototype.idMatch = function(obj) {
    if (!obj.id) return false;
    return obj.id === this.currValue;
  };

  Match.prototype.tagMatch = function(obj) {
    if (!obj.tagName) return false;
    return obj.tagName.toLowerCase() === this.currValue.toLowerCase();
  };

  Match.prototype.classMatch = function(obj) {
    if (!obj.className) return false;
    return obj.classList.contains(this.currValue);
  };

  Match.prototype.searchCurrent = function(obj) {
    if (!obj) return;
    if (this.visited.indexOf(obj) >= 0) return;
    if (this.matcher(obj)) {
      this.currResults.push(obj);
      this.visited.push(obj);
    }
  };

  Match.prototype.searchDescendents = function(obj) {
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

  Match.prototype.searchChildren = function(obj) {
    if (!obj) return;
    var children = obj.childNodes;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      this.searchCurrent(child);
    }
  };

  Match.prototype.searchElements = function(attr, value) {
    this.currValue = value;
    switch (attr) {
      case Match.Attr.ID:
        this.matcher = this.idMatch;
      break;
      case Match.Attr.TAG:
        this.matcher = this.tagMatch;
      break;
      case Match.Attr.CLASS:
        this.matcher = this.classMatch;
      break;
    }
    // Get one at top of stack
    this.currResults = this.results[this.results.length-1];
    for (var i = 0, len = this.currResults.length; i < len; i++) {
      this.search(this.currResults.shift());
    }
    this.visited.length = 0;
  };

  Match.prototype.searchElementsById = function(value) {
    this.searchElements(Match.Attr.ID, value);
  };

  Match.prototype.searchElementsByClassName = function(value) {
    this.searchElements(Match.Attr.CLASS, value);
  };

  Match.prototype.searchElementsByTagName = function(value) {
    this.searchElements(Match.Attr.TAG, value);
  };

  Match.prototype.useCurrentSearch = function() {
    this.search = this.searchCurrent;
  };

  Match.prototype.useDescendentSearch = function() {
    this.search = this.searchDescendents;
  };

  Match.prototype.useChildrenSearch = function() {
    this.search = this.searchChildren;
  };

  window.Match = Match;
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
    while (combinator(peekTok())
        && getTok()
        && simpleSelectorSequence(peekTok())
        && getTok());
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
  return Parser.$(selector, new Match(document));
}

