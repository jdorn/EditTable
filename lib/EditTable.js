(function() {
    /* Simple JavaScript Inheritance
     * By John Resig http://ejohn.org/
     * MIT Licensed.
     */
    // Inspired by base2 and Prototype
    (function(){
        var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
        // The base Class implementation (does nothing)
        this.Class = function(){};

        // Create a new Class that inherits from this class
        Class.extend = function(prop) {
            var _super = this.prototype;

            // Instantiate a base class (but only create the instance,
            // don't run the init constructor)
            initializing = true;
            var prototype = new this();
            initializing = false;

            // Copy the properties over onto the new prototype
            for (var name in prop) {
                // Check if we're overwriting an existing function
                prototype[name] = typeof prop[name] == "function" &&
                    typeof _super[name] == "function" && fnTest.test(prop[name]) ?
                    (function(name, fn){
                        return function() {
                            var tmp = this._super;

                            // Add a new ._super() method that is the same method
                            // but on the super-class
                            this._super = _super[name];

                            // The method only need to be bound temporarily, so we
                            // remove it when we're done executing
                            var ret = fn.apply(this, arguments);
                            this._super = tmp;

                            return ret;
                        };
                    })(name, prop[name]) :
                    prop[name];
            }

            // The dummy class constructor
            function Class() {
                // All construction is actually done in the init method
                if ( !initializing && this.init )
                    this.init.apply(this, arguments);
            }

            // Populate our constructed prototype object
            Class.prototype = prototype;

            // Enforce the constructor to be what we expect
            Class.prototype.constructor = Class;

            // And make this class extendable
            Class.extend = arguments.callee;

            return Class;
        };
    })();

    window.EditTable = Class.extend({
        init: function(table, columns, options) {
            this.options = options || {};
            this._table = table;
            this._columns = columns;

            this.editors = this.options.editors || {};

            for(var i in this.editors) {
                this.editors[i] = new this.editors[i](this);
            }

            this._default_editor = this.options.default_editor || null;
            this._current_editor = this._current_td = null;

            var self = this;

            this._table.on('click','td',function(e) {
                e.preventDefault();
                self.edit($(this));

            });

        },
        addEditor: function(name, editor) {
            this.editors[name] = editor;
        },
        save: function() {
            if(this._current_editor) {
                if(this._current_td) {
                    this._current_td.text(this._current_editor.getValue());
                }
            }
        },
        stopEditing: function() {
            this.save();
            if(this._current_editor) {
                this._current_editor.hide();
            }
        },
        edit: function(td) {
            this.stopEditing();

            var i = td.prevAll('td').length;
            var col = $("th",this._table).eq(i).text();

            var editor_type = this._default_editor, options = {};

            if(this._columns[col]) {
                if(this._columns[col].editor) {
                    editor_type = this._columns[col].editor;
                }
                if(this._columns[col].options) {
                    options = this._columns[col].options;
                }
            }

            var editor = this.editors[editor_type];

            this._current_td = td;
            this._current_editor = editor;

            editor.position(td);

            editor.show();

            editor.start(td.text(), options);
        },
        goDown: function() {
            var i = this._current_td.prevAll('td').length;
            var down = this._current_td.parent('tr').next('tr').children('td').eq(i);

            if(down.length) {
                this.edit(down);
            }
        },
        goUp: function() {
            var i = this._current_td.prevAll('td').length;
            var up = this._current_td.parent('tr').prev('tr').children('td').eq(i);

            if(up.length) {
                this.edit(up);
            }
        },
        goLeft: function() {
            var prev = this._current_td.prev('td');
            if(prev.length) {
                this.edit(prev);
            }
            else {
                prev = this._current_td.parent('tr').prev('tr').children('td:last');
                if(prev.length) {
                    this.edit(prev);
                }
            }
        },
        goRight: function() {
            var next = this._current_td.next('td');
            if(next.length) {
                this.edit(next);
            }
            else {
                next = this._current_td.parent('tr').next('tr').children('td:first');
                if(next.length) {
                    this.edit(next);
                }
            }
        }
    });

    EditTable.AbstractEditor = Class.extend({
        init: function(edit_table) {
            this._edit_table = edit_table;

            this.element = this.createElement().css({
                'position': 'absolute',
                'display': 'none'
            }).appendTo('body');

            this.initEvents();
        },
        createElement: function() {
            return $('<input type="text"/>');
        },
        initEvents: function() {
            var self = this;
            this.element.on('blur',function() {
                self._edit_table.save();
                self.hide();
            });

            this.element.on('keydown',function(e) {
                // TAB
                if(e.which == 9) {
                    e.preventDefault();

                    // Shift+TAB
                    if(e.shiftKey) {
                        self._edit_table.goLeft();
                    }
                    // TAB
                    else {
                        self._edit_table.goRight();
                    }
                }
                // UP ARROW
                else if(e.which == 38) {
                    e.preventDefault();
                    self._edit_table.goUp();
                }
                // DOWN ARROW
                else if(e.which == 40) {
                    e.preventDefault();
                    self._edit_table.goDown();
                }
            })
        },
        start: function(value, options) {
            this.element.val(value).focus();
        },
        getValue: function() {
            return this.element.val();
        },
        position: function(td) {
            var pos = td.position();

            this.element.css({
                top: pos.top,
                left: pos.left,
                width: td.outerWidth(),
                height: td.outerHeight()
            });
        },
        show: function() {
            this.element.show();
        },
        hide: function() {
            this.element.hide();
        }
    });

    EditTable.TextEditor = EditTable.AbstractEditor.extend({
        start: function(value, options) {
            this.element.val(value).focus().select();
        }
    });
    EditTable.LongTextEditor = EditTable.AbstractEditor.extend({
        createElement: function() {
            return $("<textarea></textarea>");
        },
        start: function(value, options) {
            this.element.val(value).focus().select();
        }
    });
    EditTable.SelectEditor = EditTable.AbstractEditor.extend({
        createElement: function() {
            return $("<select/>");
        },
        start: function(value, options) {
            this.element.html('<option value=""></option>');

            var values = options.values || [];
            for(var i=0; i<values.length; i++) {
               this.element.append('<option value="'+values[i]+'">'+values[i]+'</option>');
            }

            this.element.val(value).focus();
        }
    });
})();