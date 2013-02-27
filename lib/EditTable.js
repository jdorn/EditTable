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

            // The editor overlay
            this._editor_overlay = $("<div/>").css({
                display: 'none',
                background: 'white',
                opacity: '.8',
                position: 'absolute'
            }).appendTo('body');

            var self = this;

            // Edit a cell when it's clicked
            this._table.on('click','td',function(e) {
                e.preventDefault();
                self.edit($(this));
            });

            // Store unformatted version of each cell
            $('td',this._table).each(function() {
                $(this).data('unformatted',$(this).text());
            });

            // Format table
            this.format();
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
         * Apply formatters for a single table cell or the entire table.
         * @param [td] The table cell.  If null or undefined, the entire table will be formatted.
         */
        format: function(td) {
            if(td) {
                var col = this.getColumn(td);
                if(this._columns[col] && this._columns[col].formatters) {
                    var data = td.data('unformatted').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                    for(var i=0;i<this._columns[col].formatters.length; i++) {
                        data = this._columns[col].formatters[i].format(data);
                    }
                    td.html(data);
                }
            }
            else {
                var cols = [];
                var self = this;
                $('th',this._table).each(function(i,el) {
                     cols[i] = $(this).text();
                });
                $('td',this._table).each(function(i,el) {
                    if(self._columns[cols[i%cols.length]] && self._columns[cols[i%cols.length]].formatters) {
                        var data = $(this).data('unformatted');
                        for(var j=0;j<self._columns[cols[i%cols.length]].formatters.length; j++) {
                            data = self._columns[cols[i%cols.length]].formatters[j].format(data);
                        }
                        $(this).html(data);
                    }
                });
            }
        },

        /**
         * Gets the name of a column given a table cell
         * @param td The table cell
         * @return String the name of the column
         */
        getColumn: function(td) {
            var i = td.prevAll('td').length;
            return $("th",this._table).eq(i).text();
        },

        /**
         *
         * @param column
         * @param {EditTable.AbstractColumnFormatter} formatter The formatter object
         * @return {*}
         */
        addFormatter: function(column, formatter) {
            this._columns[column] = this._columns[column] || {};
            this._columns[column].formatters = this._columns[column].formatters || [];
            this._columns[column].formatters.push(formatter);
            return this;
        },

        /**
         * Saves the current editor's value to the table
         * @return this Makes the method chainable
         */
        save: function() {
            if(this._current_editor) {
                if(this._current_td) {
                    var data = this._current_editor.getValue();

                    this._current_td.text(data);
                    this._current_td.data('unformatted',this._current_td.text());

                    // Apply any formatters
                    this.format(this._current_td);
                }
            }
            return this;
        },
        /**
         * Closes and saves the current editor
         * @return this Makes the method chainable
         */
        stopEditing: function(editor) {
            this.save();
            if(editor) {
                editor.hide();
            }
            else if(this._current_editor) {
                this._current_editor.hide();
            }
            this._editor_overlay.hide();

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
            var col = this.getColumn(td);

            var data = td.data('unformatted');

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

            var pos = td.position();
            this._editor_overlay.css({
                top: pos.top,
                left: pos.left,
                width: td.outerWidth(),
                height: td.outerHeight(),
                'z-index': 9999
            }).show();

            // Start the editor
            this._current_td = td;
            this._current_editor = editor;
            editor.position(td);
            editor.show();
            editor.start(data, options);

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
        },
        getRows: function() {
            var rows = [];
            var self = this;
            var header_row = [];
            $("tr",this._table).each(function() {
                if(!header_row.length) {
                    $("td,th",$(this)).each(function() {
                        header_row.push($(this).text());
                    });
                }
                else {
                    var row = {};
                    $("td",$(this)).each(function(i) {
                        row[header_row[i]] = $(this).data('unformatted');
                    });
                    rows.push(row);
                }
            });
            return rows;
        },
        setRows: function(data) {
            var table = this._table;
            table.html('');
            var header = false;
            $.each(data,function(i,el) {
                if(!header) {
                    header = $("<tr></tr>");
                    $.each(el,function(name) {
                        header.append($("<th></th>").text(name));
                    });
                    table.append($("<thead></thead>").append(header));
                }
                var row = $("<tr></tr>");
                $.each(el,function(name,value) {
                    row.append($("<td></td>").text(value).data('unformatted',value));
                });
                table.append(row);
            });
            this.format();
        }
    });

    EditTable.AbstractColumnFormat = Class.extend({
        init: function(options) {
            this.options = options || {};
        },
        format: function(data) {
            return data;
        }
    });

    EditTable.BoldColumnFormat = Class.extend({
        format: function(data) {
            return "<strong>"+data+"</strong>";
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
                'display': 'none',
                'z-index': 99999
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
                self._edit_table.stopEditing(self);
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
                // ENTER
                else if(e.which == 13) {
                    // If the shift key was also pressed, pass through to the input
                    // Otherwise, save the value and stop editing
                    if(!e.shiftKey) {
                        e.preventDefault();
                        self._edit_table.stopEditing();
                    }
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

            // Fill the parent width, keep editor's height, vertically center
            var width = td.outerWidth();
            var height = this.element.outerHeight();
            var top = pos.top + (td.outerHeight() - height)/2;

            this.element.css({
                top: top,
                left: pos.left,
                width: width
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
    EditTable.LongTextEditor = EditTable.TextEditor.extend({
        createElement: function() {
            return $("<textarea></textarea>");
        },
        position: function(td) {
            var pos = td.position();

            // Fill the parent
            this.element.css({
                top: pos.top,
                left: pos.left,
                width: td.outerWidth(),
                height: td.outerHeight()
            });
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

