meh.declareModule('equals', function() {

  // Helpers

  function doubleEquals(x, y) {
    return x == y
  }

  function tripleEquals(x, y) {
    return x === y
  }

  function isPrimitive(x) {
    var type = typeof x
    return type !== 'object'
  }

  function equals(x, y, deep, eqFn) {
    if (isPrimitive(x))
      return eqFn(x, y)
    for (var p in x)
      if (deep && !equals(x[p], y[p], deep, eqFn) ||
          !deep && !eqFn(x[p], y[p]))
        return false
    for (var p in y)
      if (y[p] !== undefined &&
          x[p] === undefined)
        return false
    return true
  }

  function haveSameContentsInAnyOrder(arr1, arr2, deep, eqFn) {
    if (!arr1 instanceof Array || !arr2 instanceof Array ||
        arr1.length !== arr2.length)
      return false
    for (var idx = 0; idx < arr1.length; idx++) {
      var x = arr1[idx]
      var foundX = arr2.some(function(y) {
        return equals(x, y, deep, eqFn)
      })
      if (!foundX)
        return false
    }
    return true
  }

  // Public methods

  this.equals = function(x, y) {
    return equals(x, y, false, doubleEquals)
  }

  this.deepEquals = function(x, y) {
    return equals(x, y, true, doubleEquals)
  }

  this.strictEquals = function(x, y) {
    return equals(x, y, false, tripleEquals)
  }

  this.strictDeepEquals = function(x, y) {
    return equals(x, y, true, tripleEquals)
  }

  this.haveSameContentsInAnyOrder = function(arr1, arr2) {
    return haveSameContentsInAnyOrder(arr1, arr2, true, doubleEquals)
  }
})

