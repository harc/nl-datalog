var meh = (function() {

  var oldMeh = meh
  var modules = {meh: this}

  // Helper methods

  function objectThatDelegatesTo(obj) {
    function cons() {}
    cons.prototype = obj
    return new cons()
  }

  function error(/* arg1, arg2, ... */) {
    var args = Array.prototype.slice.call(arguments)
    console.error.apply(console, args)
    throw 'error: ' + args.join(' ')
  }

  function getRequiredModulesFor(func, thisModule) {
    var moduleNames = func.toString().match(/\((.*?)\)/)[0].replace(/ /g, '')
    moduleNames = moduleNames.substr(1, moduleNames.length - 2).split(',')
    moduleNames = moduleNames.filter(function(moduleName) { return moduleName != '' })
    return moduleNames.map(function(moduleName) {
      if (moduleName == 'thisModule')
        return thisModule
      else
        return modules[moduleName] || error('missing required module:', moduleName)
    })
  }

  // Public methods

  this.declareModule = function(name, cons) {
    return this.declareSubModule(name, Object.prototype, cons)
  }

  this.declareSubModule = function(name, baseModule, cons) {
    if (modules[name])
      error('duplicate declaration for module', name)
    var module = objectThatDelegatesTo(baseModule)
    this.withModulesDo(cons, module)
    modules[name] = module
  }

  this.withModulesDo = function(func, optionalThis) {
    return func.apply(optionalThis, getRequiredModulesFor(func, optionalThis))
  }

  this.sanityCheck = function sanityCheck(name, condition) {
    if (!condition)
      error('failed sanity check:', name)
  }

  // Same kind of thing as in JQuery
  this.noConflict = function() {
    if (meh === this)
      meh = oldMeh
    return this
  }

  return this
}).call({})

