/*
 * dc-lite: a very small template runtime for Deductly's pages.
 *
 * Each page has an <x-dc> element holding its markup, and a script that defines
 * `class Component extends DCLogic` and calls `DC.mount(Component)`.
 *
 * Markup supported:
 *   {{ name }} / {{ a.b.c }}   a lookup in the object returned by renderVals() (text and attributes)
 *   <sc-if value="{{ flag }}">…</sc-if>
 *   <sc-for list="{{ items }}" as="item">…</sc-for>
 *   onClick / onChange         set to {{ fn }}; handled by one delegated listener on the page
 *   <helmet>…</helmet>         its <link>/<style> children are moved into <head>
 *
 * Holes are lookups only, never expressions, so pages compute flags in renderVals().
 * The page re-renders after setState() / forceUpdate() and updates the DOM in place
 * with morphdom, so focus and scroll position survive typing.
 */
(function () {
  'use strict';

  var HOLE = /\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}/g;
  var SOLE = /^\s*\{\{\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\}\}\s*$/;
  // Attributes that are on when present and off when absent
  var BOOLEAN_ATTRS = { disabled: 1, readonly: 1, checked: 1, hidden: 1, required: 1 };
  var SKIP_ATTRS = { 'hint-placeholder-val': 1, 'hint-placeholder-count': 1 };

  function lookup(path, scope) {
    var parts = path.split('.');
    var cur = scope[parts[0]];
    for (var i = 1; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function interpolate(str, scope) {
    return str.replace(HOLE, function (_, path) {
      var v = lookup(path, scope);
      return v == null ? '' : String(v);
    });
  }

  function textOf(v) {
    return v == null ? '' : String(v);
  }

  // ---- base class for page logic ------------------------------------------------
  function DCLogic() {
    this.state = {};
    this._runtime = null;
  }
  DCLogic.prototype.setState = function (patch) {
    var next = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = Object.assign({}, this.state, next);
    if (this._runtime) this._runtime.update();
  };
  DCLogic.prototype.forceUpdate = function () {
    if (this._runtime) this._runtime.update();
  };

  // ---- runtime ------------------------------------------------------------------
  function Runtime(logic, host) {
    this.logic = logic;
    this.host = host;
    this.handlers = [];
    this.rendering = false;
    this.dirty = false;
    this.template = null;
    logic._runtime = this;
  }

  Runtime.prototype.start = function () {
    var host = this.host;

    // Move <helmet> contents into <head>
    Array.prototype.slice.call(host.querySelectorAll('helmet')).forEach(function (h) {
      Array.prototype.slice.call(h.children).forEach(function (el) {
        document.head.appendChild(el);
      });
      h.parentNode.removeChild(h);
    });

    // The remaining children are the template
    this.template = document.createDocumentFragment();
    while (host.firstChild) this.template.appendChild(host.firstChild);

    var self = this;
    ['click', 'input', 'change'].forEach(function (type) {
      host.addEventListener(type, function (e) {
        self.dispatch(type, e);
      });
    });

    this.render();
    host.setAttribute('data-ready', '');
    if (typeof this.logic.componentDidMount === 'function') this.logic.componentDidMount();
    window.addEventListener('pagehide', function () {
      if (typeof self.logic.componentWillUnmount === 'function') self.logic.componentWillUnmount();
    });
  };

  Runtime.prototype.dispatch = function (type, e) {
    var attr = 'data-ev-' + type;
    var el = e.target;
    while (el && el !== this.host) {
      if (el.nodeType === 1 && el.hasAttribute(attr)) {
        if (el.disabled) return;
        var fn = this.handlers[parseInt(el.getAttribute(attr), 10)];
        if (typeof fn === 'function') fn(e);
        return;
      }
      el = el.parentNode;
    }
  };

  Runtime.prototype.update = function () {
    if (this.rendering) {
      this.dirty = true;
      return;
    }
    this.render();
  };

  Runtime.prototype.render = function () {
    this.rendering = true;
    try {
      var guard = 0;
      do {
        this.dirty = false;
        var vals = this.logic.renderVals();
        this.handlers = [];
        var next = document.createElement(this.host.tagName);
        this.buildChildren(this.template, { $vals: vals }, vals, next);
        window.morphdom(this.host, next, { childrenOnly: true });
      } while (this.dirty && ++guard < 5);
    } finally {
      this.rendering = false;
    }
  };

  Runtime.prototype.buildChildren = function (srcParent, scope, vals, out) {
    var self = this;
    Array.prototype.forEach.call(srcParent.childNodes, function (node) {
      self.buildNode(node, scope, vals, out);
    });
  };

  // Look a name up first in loop variables, then in renderVals()
  function scoped(scope, vals) {
    var merged = Object.create(vals);
    Object.keys(scope).forEach(function (k) {
      if (k !== '$vals') merged[k] = scope[k];
    });
    return merged;
  }

  Runtime.prototype.buildNode = function (node, scope, vals, out) {
    var look = scoped(scope, vals);

    if (node.nodeType === 3) {
      out.appendChild(document.createTextNode(interpolate(node.nodeValue, look)));
      return;
    }
    if (node.nodeType !== 1) return; // drop comments

    var tag = node.localName;

    if (tag === 'sc-if') {
      var cond = this.attrValue(node.getAttribute('value'), look);
      if (cond) this.buildChildren(node, scope, vals, out);
      return;
    }

    if (tag === 'sc-for') {
      var list = this.attrValue(node.getAttribute('list'), look) || [];
      var name = node.getAttribute('as') || 'item';
      for (var i = 0; i < list.length; i++) {
        var inner = Object.assign({}, scope);
        inner[name] = list[i];
        inner.index = i;
        this.buildChildren(node, inner, vals, out);
      }
      return;
    }

    var el =
      node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
        ? document.createElementNS(node.namespaceURI, node.localName)
        : document.createElement(node.localName);

    var isTextarea = tag === 'textarea';
    var textareaValue = null;

    for (var a = 0; a < node.attributes.length; a++) {
      var attr = node.attributes[a];
      var n = attr.name;
      if (SKIP_ATTRS[n]) continue;
      var raw = attr.value;

      // Events: onclick="{{ fn }}", onchange="{{ fn }}"
      if (n.indexOf('on') === 0 && SOLE.test(raw)) {
        var fn = this.attrValue(raw, look);
        if (typeof fn === 'function') {
          var evt = n.slice(2);
          if (evt === 'change') {
            var type = (node.getAttribute('type') || 'text').toLowerCase();
            evt =
              tag === 'textarea' ||
              (tag === 'input' && /^(text|search|tel|url|email|password|number)$/.test(type))
                ? 'input'
                : 'change';
          }
          el.setAttribute('data-ev-' + evt, String(this.handlers.push(fn) - 1));
        }
        continue;
      }

      var value = SOLE.test(raw) ? this.attrValue(raw, look) : interpolate(raw, look);

      if (BOOLEAN_ATTRS[n.toLowerCase()]) {
        if (value && value !== 'false') el.setAttribute(n, '');
        continue;
      }
      if (value === true) value = 'true';
      else if (value === false) value = 'false';
      else if (value == null) value = '';

      if (isTextarea && n === 'value') {
        textareaValue = String(value);
        continue;
      }
      el.setAttribute(n, String(value));
    }

    if (isTextarea) {
      el.appendChild(document.createTextNode(textareaValue == null ? '' : textareaValue));
    } else {
      this.buildChildren(node, scope, vals, el);
    }
    out.appendChild(el);
  };

  // A lone {{ hole }} keeps its type (function, boolean, array); anything else becomes a string
  Runtime.prototype.attrValue = function (raw, look) {
    if (raw == null) return undefined;
    var m = SOLE.exec(raw);
    if (m) return lookup(m[1], look);
    return interpolate(raw, look);
  };

  // ---- public API ---------------------------------------------------------------
  var style = document.createElement('style');
  style.textContent = 'x-dc{display:block}x-dc:not([data-ready]){visibility:hidden}';
  document.head.appendChild(style);

  window.DCLogic = DCLogic;
  window.DC = {
    mount: function (Component, host) {
      host = host || document.querySelector('x-dc');
      if (!host) throw new Error('dc-lite: no <x-dc> element on this page');
      if (!window.morphdom) throw new Error('dc-lite: morphdom is not loaded');
      var logic = new Component();
      new Runtime(logic, host).start();
      return logic;
    },
  };
})();
