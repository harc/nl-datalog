meh.declareModule('editor', function(customElement, objectUtils) {

  function indexOf(child) {
    var parent = child.parentNode
    var idx = 0
    while (idx < parent.childNodes.length)
      if (parent.childNodes.item(idx) === child)
        return idx
      else
        idx++
    return -1
  }

  function getStyleProperty(node, property) {
    if (node instanceof Text)
      return undefined
    else if (node.computedStyle)
      return node.computedStyle[property]
    else
      return (node.computedStyle = getComputedStyle(node))[property]
  }

  function isEmpty(node) {
    if (node instanceof Text)
      return node.data.length == 0
    else if (node.tagName == 'BR')
      return false
    else if (getStyleProperty(node, 'display') == 'none')
      return true
    else {
      for (var child = node.firstChild; child; child = child.nextSibling)
        if (!isEmpty(child))
          return false
      return true
    }
  }

  // Leaves cursor pointing at next valid position.
  // Cursor should be {container: ..., offset: ...}
  function adjustCursor(cursor, editor) {
    while (true) {
      if (cursor.container instanceof Text) {
        var data = cursor.container.data
        if (data.length > 0 && cursor.offset <= data.length)
          return true
        else {
          cursor.offset = indexOf(cursor.container) + 1
          cursor.container = cursor.container.parentElement
        }
      } else {
        if (cursor.offset < cursor.container.childNodes.length) {
          var node = cursor.container.childNodes.item(cursor.offset)
          if (node.tagName == 'BR')
            return true
          else if (getStyleProperty(node, 'display') == 'none')
            cursor.offset++
          else {
            cursor.container = node
            cursor.offset = 0
          }
        } else if (cursor.container === editor) {
          return false
        } else {
          cursor.offset = indexOf(cursor.container) + 1
          cursor.container = cursor.container.parentElement
        }
      }
    }
  }

  function incrementCursor(cursor, editor) {
    var oldContainer = cursor.container, oldOffset = cursor.offset
    cursor.offset++
    if (adjustCursor(cursor, editor))
      return true
    else {
      cursor.container = oldContainer
      cursor.offset = oldOffset
      return false
    }
  }

  function handleEnterPress(editor) {
    var selection = document.getSelection()
    var deleteRange = selection.getRangeAt(0)
    var range = deleteRange.cloneRange()
    range.collapse(false)
    deleteRange.deleteContents()

    var endContainer = range.endContainer
    var endOffset = range.endOffset

    if (endContainer instanceof Text) {
      if (endOffset == 0) {
        endOffset = indexOf(endContainer)
        endContainer = endContainer.parentElement
      } else if (endOffset == endContainer.data.length) {
        endOffset = indexOf(endContainer) + 1
        endContainer = endContainer.parentElement
      } else {
        var beforeText = document.createTextNode(endContainer.data.substr(0, endOffset))
        endContainer.data = endContainer.data.substr(endOffset)
        endContainer.parentElement.insertBefore(beforeText, endContainer)
        endContainer = endContainer.parentElement
        endOffset = indexOf(beforeText) + 1
      }
    }

    var br = document.createElement('br')
    var nodeAfterCursor = endContainer.childNodes.item(endOffset)
    if (nodeAfterCursor)
      endContainer.insertBefore(br, nodeAfterCursor)
    else
      endContainer.appendChild(br)
    endOffset++

    var foundContentDownstream = false
    for (var idx = endOffset; idx < endContainer.childNodes.length; idx++)
      if (!isEmpty(endContainer.childNodes.item(idx)))
        foundContentDownstream = true
    if (!foundContentDownstream)
      endContainer.appendChild(document.createElement('br'))

    selection.removeAllRanges()
    range.setStartAfter(br)
    range.collapse(true)
    selection.addRange(range)
  }

  customElement.newType('editor').withPrototype({

    clear: function() {
      while (this.firstChild)
        this.removeChild(this.firstChild)
    },

    setText: function(text) {
      this.clear()
      this.innerHTML = text
      if (this.oninput)
        this.oninput()
    },

    collectText: function(node, cursor, collectFn, truncated) {
      if (node instanceof Text) {
        if (node !== cursor.container) {
          collectFn(node.data)
          return truncated
        }
        else {
          collectFn(node.data, 0, cursor.offset)
          return true
        }
      } else if (node.tagName == 'BR') {
        if (node !== cursor.container) {
          collectFn(node.nextSibling ? '\n' : '')
          return truncated
        } else
          return true
      } else {
        var len = node === cursor.container ? cursor.offset : node.childNodes.length
        var allChildrenSoFarAreEmpty = true
        for (var idx = 0; idx < len && !truncated; idx++) {
          var child = node.childNodes.item(idx)
          var childIsEmpty = isEmpty(child)
          if (getStyleProperty(child, 'display') == 'block' && !childIsEmpty && !allChildrenSoFarAreEmpty)
            collectFn('\n')
          truncated = this.collectText(child, cursor, collectFn, truncated)
          allChildrenSoFarAreEmpty = allChildrenSoFarAreEmpty && childIsEmpty
        }
        return truncated || node === cursor.container
      }
    },

    getText: function() {
      var sb = new objectUtils.StringBuffer()
      this.collectText(
        this,
        {container: undefined, offset: undefined},
        function(str, optStartIdx, optLength) {
          sb.nextPutAll(optStartIdx !== undefined ? str.substr(optStartIdx, optLength) : str)
        },
        false
      )
      var text = sb.contents()
      // Replace all non-breaking spaces with plain old spaces
      return text.replace(/\xA0/g, ' ')
    },

    getCursorPos: function(optCursor) {
      var cursor
      if (optCursor)
        cursor = optCursor
      else {
        var selection = document.getSelection()
        if (selection.rangeCount == 0)
          return -1
        var range = selection.getRangeAt(0)
        cursor = {container: range.endContainer, offset: range.endOffset}
      }

      var pos = 0
      this.collectText(
        this,
        cursor,
        function(str, optStartIdx, optLength) {
          pos += optLength !== undefined ? optLength : str.length
        },
        false)
      return pos
    },

    setCursorPos: function(pos) {
      var self = this
      var cursor = {container: this, offset: 0}
      adjustCursor(cursor, this)

      while (true) {
        var currPos = this.getCursorPos(cursor)
        if (currPos >= pos || !incrementCursor(cursor, this))
          break
      }

      var selection = document.getSelection()
      selection.removeAllRanges()
      var range = document.createRange()
      range.setStart(cursor.container, cursor.offset)
      range.collapse(true)
      selection.addRange(range)

      this.focus()
    }
  }).withInitializer(function() {
    this.setAttribute('contenteditable', true)

    var ENTER_KEY = 13
    this.onkeydown = function(e) {
      if (e.which == ENTER_KEY) {
        handleEnterPress(this)
        var node = this
        while (node) {
          if (node.oninput)
            node.oninput()
          node = node.parentElement
        }
        return false
      } else
        return true
    }
  })

  // Public methods

  this.create = function() {
    return customElement.create('editor')
  }
})

