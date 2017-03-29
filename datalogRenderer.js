meh.declareModule('datalogRenderer', function(datalog, customElement, browser) {

  // Helper methods

  function makeSpan(/* child1, child2, ... */) {
    var span = document.createElement('span')
    for (var idx = 0; idx < arguments.length; idx++) {
      var firstChar = arguments[idx].innerHTML[0].toLowerCase()
      if (firstChar === '[' ||
          firstChar === ']' ||
          'a' <= firstChar && firstChar <= 'z' ||
          '0' <= firstChar && firstChar <= '9')
        span.appendChild(document.createTextNode(' '))
      span.appendChild(arguments[idx])
    }
    return span
  }

  function delimWith(arr, cons) {
    var ans = []
    for (var idx = 0; idx < arr.length; idx++) {
      if (idx > 0)
        ans.push(cons())
      ans.push(arr[idx])
    }
    return ans
  }

  // Elements for displaying tokens

  customElement.newType('clauseName')
  customElement.newType('var')
  customElement.newType('value')
  customElement.newType('aggregate').withInitializer(function(name) {
    this.appendChild(customElement.create('dot', '.'))
    this.appendChild(document.createTextNode(name))
  })
  customElement.newType('dot')
  customElement.newType('beginList').withInitializer(function() {
    this.appendChild(document.createTextNode('['))
  })
  customElement.newType('comma').withInitializer(function() {
    this.appendChild(document.createTextNode(', '))
  })
  customElement.newType('endList').withInitializer(function() {
    this.appendChild(document.createTextNode(']'))
  })
  customElement.newType('not').withInitializer(function() {
    this.appendChild(document.createTextNode('~'))
  })
  customElement.newType('spaces')
  customElement.newType('other')
  customElement.newType('if').withInitializer(function() {
    this.appendChild(document.createTextNode('if'))
  })
  customElement.newType('and').withInitializer(function() {
    this.appendChild(document.createTextNode('and'))
  })

  // Helpers for rendering

  function renderRule(rule) {
    var parts = [renderClause(rule.head)]
    for (var idx = 0; idx < rule.conditions.length; idx++) {
      if (idx == 0)
        parts.push(customElement.create('if'))
      else
        parts.push(customElement.create('and'))
      parts.push(renderClause(rule.conditions[idx]))
    }
    var line = document.createElement('line')
    line.appendChild(makeSpan.apply(this, parts))
    return line
  }
 
  function renderClause(clause) {
    if (clause instanceof datalog.Not) {
      var not = clause
      return makeSpan(customElement.create('not'), renderClause(not.clause))
    } else {
      var parts = []
      var nameIdx = 0
      var argIdx = 0
      while (nameIdx < clause.name.length) {
        if (clause.name[nameIdx] == '@') {
          nameIdx++
          parts.push(renderExpr(clause.args[argIdx++]))
        } else {
          var namePart = ''
          while (nameIdx < clause.name.length && clause.name[nameIdx] != '@')
            namePart += clause.name[nameIdx++]
          parts.push(customElement.create('clauseName', namePart))
        }
      }
      return makeSpan.apply(this, parts)
    }
  }

  function renderExpr(expr) {
    if (expr instanceof datalog.Variable)
      return customElement.create('var', expr.name)
    else if (expr instanceof datalog.Wildcard)
      return customElement.create('var', '_')
    else if (expr instanceof datalog.Aggregate)
      return makeSpan(renderExpr(expr.term), customElement.create('aggregate', expr.name))
    else if (expr instanceof datalog.Value)
      return renderValue(expr)
    else
      browser.error('invalid expression', expr)
  }

  function renderValue(expr) {
    var value = expr.value
    if (value instanceof Array) {
      var renderedElements = delimWith(
        value.map(function(x) { return renderExpr(new datalog.Value(x)) }),
        function() { return customElement.create('comma') }
      )
      renderedElements = makeSpan.apply(this, renderedElements)
      return makeSpan(customElement.create('beginList'), renderedElements, customElement.create('endList'))
    } else
      return customElement.create('value', '' + value)
  }

  // Public methods

  this.render = function(db) {
    var ans = document.createElement('section')
    for (var idx = 0; idx < db.rules.length; idx++) {
      var rule = db.rules[idx]
      if (idx > 0)
        ans.appendChild(document.createElement('sep'))
      ans.appendChild(renderRule(rule))
    }
    return ans
  }
})

