meh.declareModule('browser', function(thisModule) {

  // --------------------------------------------------------------------
  // Logging
  // --------------------------------------------------------------------

  var subscribed = {}

  this.log = function(subject /* , ... */) {
    if (!subscribed[subject])
      return
    arguments[0] = '[' + subject + ']'
    console.log.apply(console, arguments)
  }

  this.subscribe = function(subject) {
    subscribed[subject] = true
  }

  this.unsubscribe = function(subject) {
    delete showing[subject]
  }

  // --------------------------------------------------------------------
  // Asserts, errors, etc.
  // --------------------------------------------------------------------

  this.error = function(/* arg1, arg2, ... */) {
    var args = Array.prototype.slice.call(arguments)
    console.error.apply(console, args)
    throw 'error: ' + args.join(' ')
  }

  this.sanityCheck = function(name, condition) {
    if (!condition)
      thisModule.error('failed sanity check:', name)
  }

  // --------------------------------------------------------------------
  // DOM utils
  // --------------------------------------------------------------------

  this.prettyPrintNode = function(node, endNode, endOffset) {
    if (node instanceof Text) {
      if (node === endNode)
        return 'text{' + node.data.substr(0, endOffset) + '|' + node.data.substr(endOffset) + '}'
      else
        return 'text{' + node.data + '}'
    }

    var parts = [node.tagName, '{']
    for (var idx = 0; idx < node.childNodes.length; idx++) {
      if (node === endNode && endOffset == idx)
        parts.push('|')
      parts.push(thisModule.prettyPrintNode(node.childNodes.item(idx), endNode, endOffset))
    }
    if (node === endNode && endOffset == node.childNodes.length)
      parts.push('|')
    parts.push('}')
    return parts.join('')
  }
})

