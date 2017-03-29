meh.declareSubModule('objectUtils', Object, function(thisModule) {

  var self = this

  // Public methods

  this.objectThatDelegatesTo = function(obj, optProperties) {
    function cons() {}
    cons.prototype = obj
    var ans = new cons()
    if (optProperties)
      thisModule.keysAndValuesDo(optProperties, function(k, v) {
        ans[k] = v
      })
    return ans
  }

  this.formals = function(func) {
    return func.
      toString().
      match(/\((.*?)\)/)[0].
      replace(/ /g, '').
      slice(1, -1).
      split(',').
      filter(function(moduleName) { return moduleName != '' })
  }

  this.keysDo = function(object, fn) {
    for (var p in object)
      if (object.hasOwnProperty(p))
        fn(p)
  }

  this.valuesDo = function(object, fn) {
    this.keysDo(object, function(p) { fn(object[p]) })
  }

  this.keysAndValuesDo = function(object, fn) {
    this.keysDo(object, function(p) { fn(p, object[p]) })
  }

  this.keysIterator = function(object) {
    return function(fn) { self.keysDo(object, fn) }
  }

  this.valuesIterator = function(object) {
    return function(fn) { self.valuesDo(object, fn) }
  }

  this.keysAndValuesIterator = function(object) {
    return function(fn) { self.keysAndValuesDo(object, fn) }
  }

  this.values = function(object) {
    var ans = []
    this.keysDo(object, function(p) { ans.push(object[p]) })
    return ans
  }

  this.StringBuffer = function() {
    this.strings = []
    this.lengthSoFar = 0
    for (var idx = 0; idx < arguments.length; idx++)
      this.nextPutAll(arguments[idx])
  }

  this.StringBuffer.prototype = {
    nextPutAll: function(s) {
      this.strings.push(s)
      this.lengthSoFar += s.length
    },

    contents: function()  {
      return this.strings.join('')
    }
  }
})

