meh.declareModule('customElement', function(browser) {

  var types = {}

  function Type() {}
  Type.prototype = {
    prototype: {},
    initializer: function(optionalText) {
      if (optionalText !== undefined) {
        // Replace all spaces with non-breaking spaces
        var text = optionalText.replace(/ /g, '\xA0')
        this.appendChild(document.createTextNode(text))
      }
    },
    withPrototype: function(prototype) {
      this.prototype = prototype
      return this
    },
    withInitializer: function(initializer) {
      this.initializer = initializer
      return this
    }
  }

  // Public methods

  this.newType = function(name) {
    if (types[name])
      browser.error('duplicate declaration for custom element type', name)
    return types[name] = new Type()
  }

  this.create = function(name /*, arg1, arg2, ... */)  {
    var type = types[name] || browser.error('unknown custom element type', name)
    var node = document.createElement(name)
    Object.keys(type.prototype).forEach(function(propertyName) {
      node[propertyName] = type.prototype[propertyName]
    })
    type.initializer.apply(node, Array.prototype.splice.call(arguments, 1))
    return node
  }
})

