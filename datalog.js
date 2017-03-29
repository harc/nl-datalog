meh.declareModule('datalog', function(objectUtils, equals) {

  // ----------------------------------------------------------------
  // Finding strongly-connected components
  // ----------------------------------------------------------------

  function reverseEdges(graph) {
    var newGraph = {}
    objectUtils.keysDo(graph, function(n) {
      newGraph[n] = []
    })

    objectUtils.keysDo(graph, function(s) {
      var edges = graph[s]
      edges.forEach(function(d) {
        if (newGraph[d].indexOf(s) < 0)
        newGraph[d].push(s)
      })
    })
    return newGraph
  }

  function findOrder(graph) {
    var visited = []
    var stack = []

    function dfs(n) {
      if (visited.indexOf(n) >= 0)
        return
      visited.push(n)

      var edges = graph[n]
      edges.forEach(dfs)

      stack.push(n)
    }

    objectUtils.keysDo(graph, dfs)
    return stack 
  }

  function findSCCs(graph) {
    var visited = []
    var sccs = {}
    var src

    function dfs(n) {
      if (sccs[n] !== undefined)
        return
      sccs[n] = src

      var edges = graph[n]
      edges.forEach(dfs)
    }

    ensureNoUndefinedRuleReferences(graph)

    var stack = findOrder(graph)
    graph = reverseEdges(graph)
    while (stack.length > 0) {
      src = stack.pop()
      dfs(src)
    }

    return sccs
  }

  function ensureNoUndefinedRuleReferences(graph) {
    var undefinedReferences = {}
    objectUtils.keysAndValuesDo(graph, function(ruleName, depNames) {
      depNames.forEach(function(depName) {
        if (graph[depName] === undefined)
          undefinedReferences[depName] = true
      })
    })
    undefinedReferences = objectUtils.keys(undefinedReferences)
    if (undefinedReferences.length > 0)
      throw 'undefined rules: ' + undefinedReferences
  }

  // ----------------------------------------------------------------
  // Stratification
  // ----------------------------------------------------------------

  function stratify(graph) {
    var sccs = findSCCs(graph)
    var strataByName = buildStratumDict(sccs)
    computeDeps(strataByName, sccs, graph)
    return sortStrata(strataByName)
  }

  function sortStrata(strataByName) {
    var strata = objectUtils.values(strataByName)
    var sortedStrata = []
    while (strata.length > 0) {
      var idx = 0
      while (idx < strata.length) {
        var stratum = strata[idx]
        if (onlyDependsOnEarlierStrata(stratum, strataByName, sortedStrata)) {
          sortedStrata.push(stratum)
          strata.splice(idx, 1)
        } else
          idx++
      }
    }
    return sortedStrata
  }

  function onlyDependsOnEarlierStrata(stratum, strataByName, sortedStrata) {
    return stratum.deps.every(function(otherStratumName) {
      return sortedStrata.indexOf(strataByName[otherStratumName]) >= 0
    })
  }

  function buildStratumDict(sccs) {
    var strataByName = {}
    objectUtils.keysDo(sccs, function(n) {
      var leader = sccs[n]
      var stratum = strataByName[leader]
      if (stratum == undefined)
        stratum = strataByName[leader] = []
      stratum.push(n)
    })
    return strataByName
  }

  function computeDeps(strataByName, sccs, graph) {
    objectUtils.keysDo(strataByName, function(stratumName) {
      var stratum = strataByName[stratumName]
      stratum.deps = []
      stratum.forEach(function(n) {
        var edges = graph[n]
        edges.forEach(function(m) {
          var otherStratumName = sccs[m]
          if (otherStratumName != stratumName &&
              stratum.deps.indexOf(otherStratumName) < 0)
            stratum.deps.push(otherStratumName)
        })
      })
    })
  }

  // ----------------------------------------------------------------
  // Data structures
  // ----------------------------------------------------------------

  var Database = this.Database = function(optRules) {
    this.rules = optRules ? optRules.slice(0) : []
  }

  var Rule = this.Rule = function(head, conditions) {
    this.head = head
    this.conditions = conditions
  }

  var Clause = this.Clause = function(name, args) {
    this.name = name
    this.args = args
  }

  var Not = this.Not = function(clause) {
    this.clause = clause
  }

  var Variable = this.Variable = function(name) {
    this.name = name
  }

  var Wildcard = this.Wildcard = function() {
    this.variable = new Variable('_' + Wildcard.count++)
  }
  Wildcard.count = 0

  var Value = this.Value = function(value) {
    this.value = value
  }

  var Aggregate = this.Aggregate = function(name, fn, term) {
    this.name = name
    this.fn = fn
    this.term = term
  }
  Aggregate.dict = {}

  // Constructors for clients

  this.makeRule     = function(head, conditions) { return new Rule(head, conditions) }
  this.makeClause   = function(name, args) { return new Clause(name, args) }
  this.makeNot      = function(clause) { return new Not(clause) }
  this.makeVariable = function(name) { return new Variable(name) }
  this.makeWildcard = function() { return new Wildcard() }
  this.makeValue    = function(value) { return new Value(value) }

  // ----------------------------------------------------------------
  // Misc methods for those data structures
  // ----------------------------------------------------------------

  Database.prototype.factsFor = function(clause) {
    return new Database(
      this.rules.filter(function(rule) {
        if (rule.conditions.length > 0)
          return false
        try {
          rule.head.unify(clause, new Environment())
          return true
        } catch (e) {
          return false
        }
      }))
  }

  objectUtils.defineProperty(
    Rule.prototype,
    'canonicalName',
    {get: function() { return this.head.canonicalName }})

  objectUtils.defineProperty(
    Clause.prototype,
    'canonicalName',
    {get: function() {
       var name = this.name
       this.args.forEach(function(arg) {
         var argInfo = arg instanceof Value ?  ['(', arg, ')'].join('') : '*'
          name = name.replace('@', argInfo)
       })
       return name.replace(/\*/g, '@')
     }})

  objectUtils.defineProperty(
    Not.prototype,
    'canonicalName',
    {get: function() { return this.clause.canonicalName }})

  objectUtils.defineProperty(
    Not.prototype,
    'args',
    {get: function() { return this.clause.args }})

  Rule.prototype.hasAggregates = function() {
    return this.head.hasAggregates()
  }

  Clause.prototype.hasAggregates = function() {
    return this.args.some(function(a) { return a.hasAggregates() })
  }

  Not.prototype.hasAggregates = function() {
    return false
  }

  Variable.prototype.hasAggregates = function() {
    return false
  }

  Wildcard.prototype.hasAggregates = function() {
    return false
  }

  Value.prototype.hasAggregates = function() {
    return false
  }

  Aggregate.prototype.hasAggregates = function() {
    return true
  }

  Rule.prototype.initAggregateMap = function() {
    this.aggregateMap = {}
  }

  Rule.prototype.storeAggregateFacts = function(factsDict) {
    var rule = this
    objectUtils.valuesDo(this.aggregateMap, function(fact) {
      factsDict[fact] = fact
    })
  }

  Aggregate.define = function(name, fn) {
    Aggregate.dict[name] = {name: name, fn: fn}
  }

  Aggregate.get = function(name, arg) {
    var entry = this.dict[name]
    if (entry === undefined)
      throw ['aggregate ', name, ' not supported'].join('')
    else
      return new Aggregate(entry.name, entry.fn, arg)
  }

  // Some useful aggregates

  Aggregate.define(
    'count', 
    function(count, x) {
      if (count === undefined)
        count = 0
      return count + 1
    })

  Aggregate.define(
    'list',
    function(list, x) {
      if (list === undefined)
        list = []
      if (list.indexOf(x) < 0) {
        list.push(x)
        list.sort()
      }
      return list
    })

  Aggregate.define(
    'sum',
    function(sum, x) {
      if (sum === undefined)
        sum = 0
      return sum + x
    })

  Aggregate.define(
    'prod',
    function(prod, x) {
      if (prod === undefined)
        prod = 1
      return prod * x
    })

  Aggregate.define(
    'min',
    function(min, x) {
      if (min === undefined)
        min = x
      return min <= x ? min : x
    })

  Aggregate.define(
    'max',
    function(max, x) {
      if (max === undefined)
        max = x
      return max >= x ? max : x
    })

  // ----------------------------------------------------------------
  // Printing
  // ----------------------------------------------------------------

  Database.prototype.toString = function() {
    return this.rules.join('\n')
  }

  Rule.prototype.toString = function() {
    if (this.conditions.length == 0)
      return this.head.toString() + '.'
    else
      return [this.head, ' :- ', this.conditions.join(', '), '.'].join('')
  }

  Clause.prototype.toString = function() {
    var name = this.name.replace(/@/g, '')
    if (this.args.length == 0)
      return name
    else
      return [name, '(', this.args.join(', '), ')'].join('')
  }

  Not.prototype.toString = function() {
    return '~' + this.clause
  }

  Variable.prototype.toString = function() {
    return this.name
  }

  Wildcard.prototype.toString = function() {
    return '_'
  }

  Value.prototype.toString = function() {
    if (this.value === undefined)
      return 'undefined'
    else if (typeof this.value !== 'string' ||
        typeof this.value === 'string' && /^[a-z][a-zA-Z0-9 ]*$/.test(this.value) && this.value != 'undefined')
      return this.value.toString()
    else
      return ['"', this.value, '"'].join('')
  }

  Aggregate.prototype.toString = function() {
    return [this.name, '(', this.term, ')'].join('')
  }

  // ----------------------------------------------------------------
  // Rewriting
  // ----------------------------------------------------------------

  Clause.prototype.rewrite = function(env) {
    return new Clause(
      this.name,
      this.args.map(function(x) { return x.rewrite(env) }))
  }

  Not.prototype.rewrite = function(env) {
    return new Not(this.clause.rewrite(env))
  }

  Variable.prototype.rewrite = function(env) {
    return env[this.name] !== undefined ? env[this.name] : this
  }

  Wildcard.prototype.rewrite = function(env) {
    return this.variable.rewrite(env)
  }

  Value.prototype.rewrite = function(env) {
    return this
  }

  Aggregate.prototype.rewrite = function(env) {
    return new Aggregate(this.name, this.fn, this.term.rewrite(env))
  }


  // ----------------------------------------------------------------
  // Name mangling
  // ----------------------------------------------------------------

  Database.prototype.withMangledVariableNames = function() {
    var idx = 0
    return new Database(this.rules.map(function(rule) {
      return rule.withMangledVariableNames(idx++)
    }))
  }

  Rule.prototype.withMangledVariableNames = function(mangler) {
    var ans = new Rule(
      this.head.withMangledVariableNames(mangler),
      this.conditions.map(function(clause) {
        return clause.withMangledVariableNames(mangler)
      }))
    return ans
  }

  Clause.prototype.withMangledVariableNames = function(mangler) {
    return new Clause(
      this.name,
      this.args.map(function(x) {
        return x.withMangledVariableNames(mangler)
      }))
  }

  Not.prototype.withMangledVariableNames = function(mangler) {
    return new Not(this.clause.withMangledVariableNames(mangler))
  }

  Variable.prototype.withMangledVariableNames = function(mangler) {
    return new Variable([mangler, '_', this.name].join(''))
  }

  Wildcard.prototype.withMangledVariableNames = function(mangler) {
    return this
  }

  Value.prototype.withMangledVariableNames = function(mangler) {
    return this
  }

  Aggregate.prototype.withMangledVariableNames = function(mangler) {
    return new Aggregate(this.name, this.fn, this.term.withMangledVariableNames(mangler))
  }

  // ----------------------------------------------------------------
  // Unification
  // ----------------------------------------------------------------

  // Environments

  var Environment = this.Environment = function(bindings) {
    if (bindings !== undefined)
      for (var name in bindings)
        this[name] = bindings[name]
  }

  Environment.prototype.addBinding = function(name, value) {
    var env = this
    var subst = new Environment()
    subst[name] = value
    objectUtils.keysDo(this, function(n) {
      env[n] = env[n].rewrite(subst)
    })
    this[name] = value
  }

  Environment.prototype.clone = function() {
    var env = this
    var r = new Environment()
    objectUtils.keysDo(this, function(n) {
      r[n] = env[n]
    })
    return r
  }

  // Unification

  function requireEquals(x, y) {
    if (!equals.deepEquals(x, y))
      throw 'unification failed'
  }

  Clause.prototype.unify = function(that, env) {
    if (that instanceof Clause) {
      requireEquals(this.name, that.name)
      requireEquals(this.args.length, that.args.length)
      for (var idx = 0; idx < this.args.length; idx++)
        this.args[idx].unify(that.args[idx], env)
    } else
      that.unify(this, env)
  }

  Not.prototype.unify = function(that, env) {
    throw 'tried to unify with a Not term'
  }

  Variable.prototype.unify = function(that, env) {
    if (env[this.name])
      env[this.name].unify(that, env)
    else
      env.addBinding(this.name, that.rewrite(env))
  }

  Wildcard.prototype.unify = function(that ,env) {
    this.variable.unify(that, env)
  }

  Value.prototype.unify = function(that, env) {
    if (that instanceof Value)
      requireEquals(this.value, that.value)
    else
      that.unify(this, env)
  }

  Aggregate.prototype.unify = function(that, env) {
    return this.term.unify(that, env)
  }

  // ----------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------

  Database.prototype.query = function(query) {
    return query.conditions.length == 0 ?
      this.answerClauseQuery(query) :
      this.answerRuleQuery(query)
  }

  Database.prototype.answerClauseQuery = function(query) {
    var prunedThis = this.withMangledVariableNames().onlyDependenciesOf(query.head)
    if (query.hasAggregates()) {
      var rule = new Rule(
        new Clause('_' + query.head.name, query.head.args),
        [stripAggregates(query.head)])
      var ans = prunedThis.eval(rule).factsFor(rule.head)
      ans.rules.forEach(function(rule) {
        rule.head.name = rule.head.name.substring(1)
      })
      return ans
    } else
      return prunedThis.eval().factsFor(query.head)
  }

  Database.prototype.answerRuleQuery = function(rule) {
    return new Database(this.rules.concat([rule])).answerClauseQuery(new Rule(stripAggregates(rule.head), []))
  }

  function stripAggregates(clause) {
    return new Clause(
      clause.name,
      clause.args.map(function(arg) {
        return arg instanceof Aggregate ? arg.term : arg
      }))
  }

  // TODO: Clean this up, it's probably more complicated than it needs to be.
  Database.prototype.onlyDependenciesOf = function(clause) {
    if (isBuiltinRule(clause.name))
      return new Database([])

    var deps = []
    function addTransitiveDeps(stratum) {
      stratum.deps.forEach(function(otherStratum) {
        addTransitiveDeps(otherStratum)
      })
      if (deps.indexOf(stratum) < 0)
        deps.push(stratum)
      }

    var allStrata = computeStrata(this.rules)
    var rootStrata = allStrata.filter(function(stratum) {
      return stratum.some(function(rule) {
        try {
          rule.head.unify(clause, new Environment())
          return true
        } catch (e) {
          return false
        }
      })
    })
    rootStrata.forEach(function(stratum) {
      addTransitiveDeps(stratum)
    })

    var rules = []
    deps.forEach(function(stratum) {
      rules = rules.concat(stratum)
    })

    return new Database(rules)
  }

  // ----------------------------------------------------------------
  // Evaluation
  // ----------------------------------------------------------------

  function computeStrata(rules) {
    var dependencyGraph = buildDependencyGraph(rules)
    var strata = stratify(dependencyGraph)
    translateRuleNamesToRules(strata, rules)
    return strata
  }

  Database.prototype.eval = function(/* db1, db2, ... */) {
    var db = this
    for (var idx = 0; idx < arguments.length; idx++)
      db = new Database(db.rules.concat([arguments[idx]]))
    db = db.withMangledVariableNames()

    var knownFacts = {}
    var strata = computeStrata(db.rules)
    ensureProgramIsValid(strata)
    var keepGoing = true
    for (var idx = 0; keepGoing && idx < strata.length; idx++) {
      var stratum = strata[idx]
      //console.log('s' + idx + ':', stratum.ruleNames)
      if (stratum[0].hasAggregates()) {
        meh.sanityCheck('an aggregate rule must be in its own stratum', stratum.length == 1)
        evaluateAggregateRule(knownFacts, stratum[0])
      } else
        keepGoing = evaluateStratum(stratum, knownFacts)
    }
    return new Database(objectUtils.values(knownFacts))
  }

  function ensureProgramIsValid(strata) {
    var errors = []
    strata.forEach(function(rules) {
      rules.forEach(function(rule) {
        checkHeadVarsAreBound(rule, errors)
        checkNegatedGoals(rule, rules.ruleNames, errors)
        if (rule.hasAggregates())
          checkAggregateRule(rule, rules.ruleNames, errors)
      })
    })
    if (errors.length > 0) {
      errors.forEach(function(error) {
        console.log(error)
      })
      throw 'cannot evaluate program because it has errors'
    }
  }

  function checkHeadVarsAreBound(rule, errors) {
    var headVars = {}
    rule.head.args.forEach(function(a) {
      if (a instanceof Wildcard)
        errors.push(['the head of ', rule.canonicalName, ' has one or more wildcards'].join(''))
      if (a instanceof Aggregate)
        a = a.term
      if (a instanceof Variable)
        headVars[a.name] = false
    })

    rule.conditions.forEach(function(clause) {
      if (clause instanceof Not)
        return
      var startIdx = isMemberClause(clause.name) ? 1 : 0
      for (var idx = startIdx; idx < clause.args.length; idx++) {
        var a = clause.args[idx]
        headVars[a.name] = true
      }
    })

    var unboundHeadVars = []
    objectUtils.keysAndValuesDo(headVars, function(name, bound) {
      if (!bound)
        unboundHeadVars.push(name)
    })

    if (unboundHeadVars.length > 0)
      errors.push([rule.canonicalName, ' has unbound head vars: ', unboundHeadVars].join(''))
  }

  function checkNegatedGoals(rule, ruleNamesInSameStratum, errors) {
    var disallowedReferences = []
    rule.conditions.forEach(function(clause) {
      if (clause instanceof Not && ruleNamesInSameStratum.indexOf(clause.canonicalName) >= 0)
        disallowedReferences.push(clause.canonicalName)
    })
    if (disallowedReferences.length > 0)
      errors.push([rule.canonicalName, ' has negated subgoals in same stratum: ', disallowedReferences].join(''))
  }

  function checkAggregateRule(rule, ruleNamesInSameStratum, errors) {
    var disallowedReferences = []
    rule.conditions.forEach(function(clause) {
      if (ruleNamesInSameStratum.indexOf(clause.canonicalName) >= 0)
        disallowedReferences.push(clause.canonicalName)
    })
    if (disallowedReferences.length > 0)
      errors.push(['aggregate rule ', rule.canonicalName, ' has subgoals in same stratum: ', disallowedReferences].join(''))
  }

  function evaluateStratum(stratum, factsDict) {
    var n = 0
    var foundNewFacts
    do {
      if (++n % 1000 == 0) {
        var msg = ['Stratum ', stratum.ruleNames, ' still going after ', n, ' iterations. Keep going?'].join('')
        keepGoing = window.confirm(msg)
        if (!keepGoing)
          return false
      }
      foundNewFacts = false
      stratum.forEach(function(rule) {
        foundNewFacts |= findNewFacts(factsDict, rule, 0, new Environment())
      })
    } while (foundNewFacts)
    return true
  }

  function evaluateAggregateRule(factsDict, rule) {
    rule.initAggregateMap()
    findNewFacts(factsDict, rule, 0, new Environment())
    rule.storeAggregateFacts(factsDict)
  }

  function findNewFacts(factsDict, rule, condIdx, env) {
    if (condIdx >= rule.conditions.length)
      return recordNewFact(factsDict, rule, env)

    var cond = rule.conditions[condIdx++].rewrite(env)

    var isNegativeGoal = false
    if (cond instanceof Not) {
      cond = cond.clause
      isNegativeGoal = true
    }

    var factsIterator = isBuiltinRule(cond.name) ?
      factsIteratorForBuiltinRule(cond) :
      objectUtils.valuesIterator(factsDict)
    var foundNewFacts = false

    if (!isNegativeGoal) {
      factsIterator(function(fact) {
        var envCopy = env.clone()
        try {
          cond.unify(fact.head, envCopy)
          foundNewFacts |= findNewFacts(factsDict, rule, condIdx, envCopy)
        } catch (e) {
          if (e != 'unification failed')
            throw e
        }
      })
    } else {
      var unified = false
      factsIterator(function(fact) {
        try {
          cond.unify(fact.head, env.clone())
          unified = true
        } catch (e) { }
      })
      if (!unified)
        foundNewFacts = findNewFacts(factsDict, rule, condIdx, env)
    }

    return foundNewFacts
  }

  function isMemberClause(name) {
    return name == '@contains@' || name == 'member@@' || isThreeArgMemberClause(name)
  }

  function isThreeArgMemberClause(name) {
    return name == '@at index@is@' || name == 'member@@@'
  }

  function isBuiltinRule(name) {
    return isMemberClause(name)
  }

  function factsIteratorForBuiltinRule(clause) {
    if (isMemberClause(clause.name))
      return factsIteratorForMemberRule(clause)
    else
      throw ['built-in rule ', clause.name, ' is not supported yet'].join('')
  }

  function factsIteratorForMemberRule(clause) {
    if (!clause.args[0] instanceof Value)
      throw [clause.name, ' can only be used when its 1st argument is bound'].join('')

    return function(fn) {
      var listyObject = clause.args[0].value
      if (!(typeof listyObject === 'string' || listyObject instanceof Array))
        return
      for (var idx = 0; idx < listyObject.length; idx++) {
        var args = [clause.args[0], new Value(listyObject[idx])]
        if (isThreeArgMemberClause(clause.name))
          args.splice(clause.name.indexOf('member') == 0 ? 2 : 1, 0, new Value(idx))
        fn(new Rule(new Clause(clause.name, args), []))
      }
    }
  }

  function recordNewFact(factsDict, rule, env) {
    var fact = new Rule(rule.head.rewrite(env), [])
    if (rule.hasAggregates())
      return recordNewAggregateFact(rule, fact)
    else if (factsDict[fact] === undefined) {
      factsDict[fact] = fact
      return true
    } else
      return false
  }

  function recordNewAggregateFact(rule, fact) {
    // Grab the aggregate so far.
    var aggregatedFact
    aggregatedFact = ensureAggregatedFact(rule, fact)

    // Merge this fact with the aggregate.
    var pattern = rule.head.args
    aggregatedFact.head.args = aggregatedFact.head.args.map(function(a, idx) {
      return pattern[idx] instanceof Aggregate ? new Value(pattern[idx].fn(a.value, fact.head.args[idx].term.value)) : a
    })

    return true
  }

  function ensureAggregatedFact(rule, fact) {
    var pattern = rule.head.args
    var nonAggregateValues = []
    for (var idx = 0; idx < pattern.length; idx++)
      if (!(pattern[idx] instanceof Aggregate))
        nonAggregateValues.push(fact.head.args[idx])

    var aggregatedFact = rule.aggregateMap[nonAggregateValues]
    if (aggregatedFact === undefined)
      aggregatedFact = rule.aggregateMap[nonAggregateValues] = new Rule(
        new Clause(
          rule.head.name,
          fact.head.args.map(function(a, idx) {
            return pattern[idx] instanceof Aggregate ? new Value(undefined) : a
          })),
        [])
    return aggregatedFact
  }

  function buildDependencyGraph(rules) {
    var dependencyGraph = {}
    rules.forEach(function(rule) {
      var deps = dependencyGraph[rule.canonicalName]
      if (deps === undefined)
        deps = dependencyGraph[rule.canonicalName] = []
      rule.conditions.forEach(function(clause) {
        if (isBuiltinRule(clause.name))
          return
        rules.forEach(function(otherRule) {
          if (otherRule == rule)
            return
          try {
            clause.unify(otherRule.head, new Environment())
            if (deps.indexOf(otherRule.canonicalName) < 0)
              deps.push(otherRule.canonicalName)
          } catch (e) { }
        })
      })
    })
    return dependencyGraph
  }

  function translateRuleNamesToRules(strata, rules) {
    for (var idx = 0; idx < strata.length; idx++) {
      var ruleNamesInThisStratum = strata[idx]
      var rulesInThisStratum = []
      rules.forEach(function(rule) {
        if (ruleNamesInThisStratum.indexOf(rule.canonicalName) >= 0)
          rulesInThisStratum.push(rule)
      })
      var deps = strata[idx].deps
      strata[idx] = rulesInThisStratum
      strata[idx].ruleNames = ruleNamesInThisStratum
      strata[idx].deps = deps
    }
    strata.forEach(function(stratum) {
      stratum.deps = stratum.deps.map(function(otherStratumName) {
        for (var idx = 0; idx < strata.length; idx++)
          if (strata[idx].ruleNames.indexOf(otherStratumName) >= 0)
            return strata[idx]
        meh.sanityCheck(['stratum ', otherStratumName, ' not found'].join(''), false)
      })
    })
  }

  // Make a few helpers available for testing

  this._findSCCs = findSCCs
  this._stratify = stratify
})
