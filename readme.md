## JavaScript Selection Engine 0.1

### Description

This program consists of the selection engine (`Selection`), the lexer (`Lexer`), and the parser (`Parser`). The grammar is a pared down version of the official grammar , but it's extensible.

### Features

* Selector grouping

    Example: `#some_id, .some_class`

* Selection chaining

    Example: `img.some_class`

* basic combinators

    Example: `div #some_id`

### Comments

* I added a couple of extra tests for the grouping feature
* This was a pretty fun exercise!
