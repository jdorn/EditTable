(function($) {
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

    /**
     * The main EditTable class
     */
    window.EditTable = Class.extend({
        /**
         * @constructor
         * @param table The table element to make editable
         * @param columns An object where the keys are column names and the value is options for that column
         * @param options Options for the EditTable
         */
        init: function(table, columns, options) {
            this.options = options || {};
            this._table = $(table);
            this._columns = columns;
            
            // The predefined editors
            this.editors = {
                Text: new EditTable.TextEditor(this),
                LongText: new EditTable.LongTextEditor(this),
                Select: new EditTable.SelectEditor(this)
            };

            // Any additional editors defined in the options
            for(var i in this.options.editors) {
                this.editors[i] = new this.options.editors[i](this);
            }

            // The default editor to use if one isn't specified for a column
            this._default_editor = this.options.default_editor || 'Text';
            
            // Used to keep track of the current td being edited and which editor is active
            this._current_editor = this._current_td = null;

            var self = this;

            // Edit a cell when it's clicked
            this._table.on('click','td',function(e) {
                e.preventDefault();
                self.edit($(this));
            });
        },
        /**
         * Add an editor
         * @param name The name of the editor
         * @param editor_class The class of the editor.  This must extend EditTable.AbstractEditor
         * @return this - makes the method chainable
         */
        addEditor: function(name, editor_class) {
            this.editors[name] = new editor_class(this);
            return this;
        },
        /**
         * Set a column to use an editor
         * @param column The column
         * @param editor The name of the editor to use
         * @param options Options to pass into the editor
         * @return this Make the method chainable
         */
        setEditor: function(column, editor, options) {
            this._columns[column] = this._columns[column] || {};
            this._columns[column].editor = editor;
            this._columns[column].options = options;
            return this;
        },
        /**
         * Saves the current editor's value to the table
         * @return this Makes the method chainable
         */
        save: function() {
            if(this._current_editor) {
                if(this._current_td) {
                    this._current_td.text(this._current_editor.getValue());
                }
            }
            return this;
        },
        /**
         * Closes and saves the current editor
         * @return this Makes the method chainable
         */
        stopEditing: function() {
            this.save();
            if(this._current_editor) {
                this._current_editor.hide();
            }
            return this;
        },
        /**
         * Edit a table cell
         * @param td The td you want to edit
         * @return this Makes the method chainable
         */
        edit: function(td) {
            this.stopEditing();

            // Determine which column this td belongs to
            var i = td.prevAll('td').length;
            var col = $("th",this._table).eq(i).text();

            // Get the editor to use for this td
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

            // Start the editor
            this._current_td = td;
            this._current_editor = editor;
            editor.position(td);
            editor.show();
            editor.start(td.text(), options);
            
            return this;
        },
        /**
         * Move editing focus down to the cell below the current one
         * @return this Makes the method chainable
         */
        goDown: function() {
            var i = this._current_td.prevAll('td').length;
            var down = this._current_td.parent('tr').next('tr').children('td').eq(i);

            if(down.length) {
                this.edit(down);
            }
            return this;
        },
        /**
         * Move editing focus up to the cell above the current one
         * @return this Makes the method chainable
         */
        goUp: function() {
            var i = this._current_td.prevAll('td').length;
            var up = this._current_td.parent('tr').prev('tr').children('td').eq(i);

            if(up.length) {
                this.edit(up);
            }
            
            return this;
        },
        /**
         * Move editing focus left to the cell before the current one
         * @return this Makes the method chainable
         */
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
            
            return this;
        },
        /**
         * Move editing focus right to the cell after the current one
         * @return this Makes the method chainable
         */
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
            
            return this;
        }
    });

    /**
     * All editors should extend this base class
     */
    EditTable.AbstractEditor = Class.extend({
        /**
         * Override in child classes if needed.
         * @constructor
         * @param edit_table The instance of EditTable this editor belongs to
         */
        init: function(edit_table) {
            this._edit_table = edit_table;

            this.element = this.createElement().css({
                'position': 'absolute',
                'display': 'none'
            }).appendTo('body');

            this.initEvents();
        },
        /**
         * Create the main editor element and return it
         * @return The editor DOM element
         */
        createElement: function() {
            return $('<input type="text"/>');
        },
        /**
         * Start any event listeners for the editor
         */
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
        /**
         * Starts the editor and sets the starting value
         * Override in child classes if needed
         * @param value The starting value for the editor
         * @param options An array of options
         */
        start: function(value, options) {
            this.element.val(value).focus();
        },
        /**
         * Gets the editor's value
         * Override in child classes if needed
         * @return The value of the editor
         */
        getValue: function() {
            return this.element.val();
        },
        /**
         * Position the editor relative to a td
         * Override in child classes if needed.
         * @param td The td tag to position the editor relative to
         */
        position: function(td) {
            var pos = td.position();

            this.element.css({
                top: pos.top,
                left: pos.left,
                width: td.outerWidth(),
                height: td.outerHeight()
            });
        },
        /**
         * Show the editor
         * Override in child classes if needed.
         */
        show: function() {
            this.element.show();
        },
        /**
         * Hide the editor
         * Override in child classes if needed.
         */
        hide: function() {
            this.element.hide();
        }
    });

    /**
     * A simple text input editor.
     */
    EditTable.TextEditor = EditTable.AbstractEditor.extend({
        start: function(value, options) {
            this.element.val(value).focus().select();
        }
    });
    
    /**
     * A Textarea editor
     */
    EditTable.LongTextEditor = EditTable.AbstractEditor.extend({
        createElement: function() {
            return $("<textarea></textarea>");
        },
        start: function(value, options) {
            this.element.val(value).focus().select();
        }
    });
    
    /**
     * A select box editor
     */
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
})(jQuery);
